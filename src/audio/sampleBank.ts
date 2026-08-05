/**
 * sampleBank.ts — Local real-guitar sample bank loader.
 *
 * Loads the CC0-licensed Karoryfer electric-guitar multisample pack
 * (public/samples/guitar) as raw WAV binary — no script evaluation, no
 * base64 decoding. The manifest maps each zone to a root pitch and
 * velocity layer; lookups pick the closest in-range zone for the target
 * MIDI note and pitch-shift via playbackRate.
 */

export interface SampleZone {
  file: string;
  rootPitch: number;
  lowPitch: number;
  highPitch: number;
  lowVelocity: number;
  highVelocity: number;
}

export interface SampleZoneManifest {
  zones: SampleZone[];
}

const MANIFEST_URL = 'samples/guitar/manifest.json';

export interface FoundSample {
  buffer: AudioBuffer;
  rootMidi: number;
}

export class SampleBank {
  private zones: { buffer: AudioBuffer; rootMidi: number; lowVelocity: number; highVelocity: number }[] = [];
  private pendingLoad: Promise<void> | null = null;
  private ready = false;

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Kick off the bank load. Safe to call repeatedly — concurrent callers
   * share the same in-flight promise.
   */
  startLoad(ctx: AudioContext): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (!this.pendingLoad) {
      this.pendingLoad = this.load(ctx);
    }
    return this.pendingLoad;
  }

  /**
   * Find the closest zone whose velocity layer covers `velocity`, or null
   * when the bank is unavailable. When no layer matches the velocity
   * (e.g. default plucks land between layers), falls back to the closest
   * zone by pitch so playback never goes silent.
   */
  findNote(targetMidi: number, velocity: number): FoundSample | null {
    if (this.zones.length === 0) return null;

    const velocityScaled = velocity * 127;
    let best: FoundSample | null = null;
    let bestDistance = Infinity;
    let fallback: FoundSample | null = null;
    let fallbackDistance = Infinity;

    for (const zone of this.zones) {
      const distance = Math.abs(zone.rootMidi - targetMidi);
      if (distance < fallbackDistance) {
        fallbackDistance = distance;
        fallback = { buffer: zone.buffer, rootMidi: zone.rootMidi };
      }

      if (velocityScaled < zone.lowVelocity || velocityScaled > zone.highVelocity) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { buffer: zone.buffer, rootMidi: zone.rootMidi };
      }
    }

    return best ?? fallback;
  }

  clear(): void {
    this.zones = [];
    this.pendingLoad = null;
    this.ready = false;
  }

  private async load(ctx: AudioContext): Promise<void> {
    try {
      const manifestResponse = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!manifestResponse.ok) {
        throw new Error(`Failed to fetch sample manifest (${manifestResponse.status})`);
      }
      const manifest = (await manifestResponse.json()) as SampleZoneManifest;
      if (!Array.isArray(manifest.zones) || manifest.zones.length === 0) {
        throw new Error('Sample manifest contains no zones');
      }

      const baseUrl = MANIFEST_URL.slice(0, MANIFEST_URL.lastIndexOf('/') + 1);
      const loaded: typeof this.zones = [];

      await Promise.all(
        manifest.zones.map(async (zone) => {
          try {
            const fileName = zone.file.split('/').pop() || zone.file;
            const response = await fetch(`${baseUrl}${fileName}`, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to fetch sample ${fileName} (${response.status})`);
            const audioData = await response.arrayBuffer();
            const buffer = await ctx.decodeAudioData(audioData);
            
            loaded.push({
              buffer,
              rootMidi: zone.rootPitch,
              lowVelocity: zone.lowVelocity,
              highVelocity: zone.highVelocity,
            });
          } catch {
            // Skip individual zone failures; the bank still works if any load.
          }
        }),
      );

      if (loaded.length === 0) {
        throw new Error('No sample zones decoded from local bank');
      }

      this.zones = loaded;
      this.ready = true;
    } catch (err) {
      this.ready = false;
      console.warn('Local guitar sample bank unavailable:', err);
    } finally {
      this.pendingLoad = null;
    }
  }
}
