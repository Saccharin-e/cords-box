import { describe, expect, it } from 'vitest';
import { loadPresetById } from '../../src/presets/presetLibrary';
import { useCircuitStore } from '../../src/store/circuitStore';
import { inferPickupSelection } from '../../src/audio/pipeline';

// Expected selections are the authored neck-first switch truth tables, not
// snapshots generated from the solver. Full transfer-response coverage is M1.
const scenarios = [
  {
    preset: 'std_tele',
    selector: 'switch_3way_tele',
    selections: [['pickup_neck'], ['pickup_neck', 'pickup_bridge'], ['pickup_bridge']],
  },
  {
    preset: 'les_paul_hh',
    selector: 'switch_3way_lp',
    selections: [['pickup_neck'], ['pickup_neck', 'pickup_bridge'], ['pickup_bridge']],
  },
  ...['strat_sss', 'guitar_sound_test_template'].map((preset) => ({
    preset,
    selector: 'switch_5way_strat',
    selections: [
      ['pickup_neck'],
      ['pickup_neck', 'pickup_middle'],
      ['pickup_middle'],
      ['pickup_middle', 'pickup_bridge'],
      ['pickup_bridge'],
    ],
  })),
];

describe('reference preset switch scenarios', () => {
  for (const scenario of scenarios) {
    scenario.selections.forEach((expected, index) => {
      it(`${scenario.preset} position ${index + 1} selects ${expected.join(' + ')}`, () => {
        expect(loadPresetById(scenario.preset)).toBe(true);
        const state = useCircuitStore.getState();
        const switchState = state.graph.getSwitchState(scenario.selector)!;
        state.setSwitchState({ ...switchState, currentPosition: index + 1 });
        const result = inferPickupSelection(state.graph, useCircuitStore.getState().solverResult!);
        expect(result.activePickupIds.toSorted()).toEqual(expected.toSorted());
        expect(result.isSeries).toBe(false);
      });
    });
  }
});
