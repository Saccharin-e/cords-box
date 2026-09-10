import fixtures from './audio-fixtures.json';
import guitarWorkletUrl from '../../src/audio/processor.js?worker&url';
import dspWasmUrl from '../../src/audio/wasm-pkg/dsp_bg.wasm?url';
import { WdfGuitarCircuitSolver } from '../../src/audio/wdf/wdfCircuitSolver.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function measure(samples, rate, from, to) {
  let energy = 0;
  let peak = 0;
  const start = Math.floor(from * rate);
  const end = Math.floor(to * rate);
  for (let i = start; i < end; i++) {
    assert(Number.isFinite(samples[i]), `Non-finite audio at frame ${i}`);
    energy += samples[i] ** 2;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return { rms: Math.sqrt(energy / (end - start)), peak };
}

function waitForReady(node, initialize) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Worklet readiness timed out')), 10000);
    node.onprocessorerror = () => {
      clearTimeout(timeout);
      reject(new Error('Worklet processor failed'));
    };
    node.port.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        clearTimeout(timeout);
        resolve();
      }
      if (data.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(data.reason || 'Worklet error'));
      }
    };
    initialize?.();
  });
}

function runtimeParams(reference) {
  return {
    pickups: [
      {
        inductanceH: reference.pickupInductanceH,
        resistanceR: reference.pickupResistanceOhms,
        windingCapFarads: reference.pickupWindingCapFarads,
        isOutofPhase: false,
        positionFraction: 0.12,
        blendGain: 1,
      },
    ],
    isSeries: false,
    volPotMaxR: reference.volumePotMaxOhms,
    volumePos: reference.volumePotPos,
    volumePotTaper: reference.volumePotTaper,
    tonePotMaxR: reference.tonePotMaxOhms,
    tonePos: reference.tonePotPos,
    tonePotTaper: reference.tonePotTaper,
    toneCapFarads: reference.toneCapFarads,
    trebleBleedCapFarads: reference.trebleBleedCapFarads,
    cableCapFarads: reference.cableCapacitanceFarads,
    ampInputImpedanceOhms: reference.ampInputImpedanceOhms,
  };
}

async function createHarness(rate) {
  const context = new OfflineAudioContext(1, rate * fixtures.durationSeconds, rate);
  await context.audioWorklet.addModule(guitarWorkletUrl);
  const node = new AudioWorkletNode(context, 'guitar-processor', { outputChannelCount: [1] });
  const response = await fetch(dspWasmUrl);
  assert(response.ok, `WASM fetch failed (${response.status})`);
  const wasmBytes = await response.arrayBuffer();
  await waitForReady(node, () => node.port.postMessage({ type: 'init', wasmBytes }, [wasmBytes]));
  node.port.postMessage({ type: 'wdf-update', params: runtimeParams(fixtures.reference) });
  return { context, node };
}

async function runParity(rate) {
  const { context, node } = await createHarness(rate);
  const buffer = context.createBuffer(1, context.length, rate);
  const input = buffer.getChannelData(0);
  for (let i = 0; i < input.length; i++)
    input[i] = 0.2 * Math.sin((2 * Math.PI * fixtures.frequency * i) / rate);
  const reference = new WdfGuitarCircuitSolver(rate);
  reference.buildCircuit(fixtures.reference);
  const expected = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) expected[i] = reference.processSample(input[i]);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(node).connect(context.destination);
  source.start(0);
  const actual = (await context.startRendering()).getChannelData(0);
  let maximumError = 0;
  for (let i = 0; i < actual.length; i++)
    maximumError = Math.max(maximumError, Math.abs(actual[i] - expected[i]));
  assert(
    maximumError <= fixtures.maximumParityError,
    `Browser WDF parity error ${maximumError} at ${rate} Hz`,
  );
  const output = measure(actual, rate, 0, 1);
  assert(output.rms > fixtures.minimumAttackRms, 'Passive worklet produced silence');
  node.port.close();
  return { kind: 'passive-parity', sampleRate: rate, maximumError, ...output };
}

async function runSynth(rate) {
  const { context, node } = await createHarness(rate);
  const tone = new AudioWorkletNode(context, 'tone-stack-processor', { outputChannelCount: [1] });
  await waitForReady(tone);
  node.connect(tone).connect(context.destination);
  node.port.postMessage({
    type: 'pluck',
    string_idx: 0,
    freq: fixtures.frequency,
    velocity: fixtures.velocity,
    pick_position: 0.28,
    pick_hardness: 0.42,
    time: fixtures.pluckTime,
  });
  node.port.postMessage({ type: 'damp', string_idx: 0, amount: 1, time: fixtures.dampTime });
  const samples = (await context.startRendering()).getChannelData(0);
  const full = measure(samples, rate, 0, 1);
  const silence = measure(samples, rate, 0, fixtures.pluckTime);
  const attack = measure(samples, rate, 0.12, 0.4);
  const tail = measure(samples, rate, 0.85, 1);
  assert(silence.peak <= fixtures.silencePeakLimit, 'Scheduled pluck sounded early');
  assert(attack.rms >= fixtures.minimumAttackRms, 'WASM pluck produced silence');
  assert(
    tail.rms / attack.rms <= fixtures.maximumTailRatio,
    'Scheduled damping did not release the voice',
  );
  node.port.close();
  tone.port.close();
  return {
    kind: 'wasm-scheduled-pluck',
    sampleRate: rate,
    full,
    silence,
    attack,
    tail,
    tailRatio: tail.rms / attack.rms,
    samples: Array.from(samples),
  };
}

window.runAudioAcceptance = async () => {
  const results = [];
  for (const rate of fixtures.sampleRates) {
    results.push(await runParity(rate));
    results.push(await runSynth(rate));
  }
  return results;
};
