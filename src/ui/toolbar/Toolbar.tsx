import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { audioEngine, audioPipeline } from '@audio/index';
import { PRESETS, type PresetDefinition } from '../../presets/presetLibrary';

export function Toolbar() {
  const { wiringMode, cancelWiring, resetCanvas, addInstance } = useCanvasStore();
  const { exportJSON, importJSON, reset: resetGraph, addComponent, addEdge, solve } = useCircuitStore();
  const [audioActive, setAudioActive] = useState(false);

  async function handleAudioToggle() {
    if (!audioActive) {
      await audioEngine.initialize();
      await audioEngine.resume();
      setAudioActive(true);
      useCircuitStore.getState().solve();
    } else {
      await audioEngine.suspend();
      setAudioActive(false);
    }
  }

  function handlePluck() {
    if (!audioActive) {
      void handleAudioToggle().then(() => {
        audioPipeline.triggerPluck();
      });
    } else {
      audioPipeline.triggerPluck();
    }
  }

  function handleWiringToggle() {
    if (wiringMode) {
      cancelWiring();
    }
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      importJSON(text);
    };
    input.click();
  }

  function handleReset() {
    resetCanvas();
    resetGraph();
  }

  function handleLoadPreset(preset: PresetDefinition) {
    resetCanvas();
    resetGraph();

    for (const comp of preset.components) {
      addInstance({
        id: comp.id,
        type: comp.type,
        label: comp.label,
        x: comp.x,
        y: comp.y,
        width: comp.width,
        height: comp.height,
      });

      addComponent({
        id: comp.id,
        type: comp.type,
        label: comp.label,
        value: comp.value,
      });
    }

    for (const edge of preset.edges) {
      addEdge(edge);
    }

    solve();
  }

  return (
    <header className="toolbar" id="toolbar">
      <div className="toolbar__brand">
        <div className="toolbar__logo">CB</div>
        <span className="toolbar__title">Cords Box</span>
        <span className="toolbar__subtitle">Guitar Wiring Sandbox</span>
      </div>

      <nav className="toolbar__actions">
        {/* Preset Selector Dropdown */}
        <select
          className="btn btn--sm"
          style={{
            backgroundColor: '#18181b',
            color: '#e4e4e7',
            borderColor: '#3f3f46',
            cursor: 'pointer',
            paddingRight: 10,
          }}
          defaultValue=""
          onChange={(e) => {
            const found = PRESETS.find((p) => p.id === e.target.value);
            if (found) {
              handleLoadPreset(found);
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>
            🎸 Load Harness Preset…
          </option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className={`btn btn--sm ${audioActive ? 'btn--primary' : ''}`}
          id="btn-audio-power"
          onClick={handleAudioToggle}
          title="Toggle Web Audio Engine"
        >
          {audioActive ? '🔊 Audio ON' : '🔈 Audio OFF'}
        </button>

        <button
          className="btn btn--sm"
          id="btn-pluck"
          onClick={handlePluck}
          title="Pluck guitar string to test audio DSP pipeline"
        >
          🎵 Pluck String
        </button>

        <button className="btn btn--sm" id="btn-reset" onClick={handleReset}>
          Reset
        </button>
        <button className="btn btn--sm" id="btn-import" onClick={handleImport}>
          Import
        </button>
        <button className="btn btn--sm" id="btn-export" onClick={handleExport}>
          Export
        </button>
        <button
          className={`btn btn--sm ${wiringMode ? 'btn--primary' : ''}`}
          id="btn-wire"
          onClick={handleWiringToggle}
          title="Click lugs on components to draw wires"
        >
          {wiringMode ? '⚡ Wiring…' : '⚡ Wire'}
        </button>
      </nav>
    </header>
  );
}
