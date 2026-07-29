/**
 * Switch State Machine
 *
 * Models lug-connectivity for 3/4/5-way and DPDT switches (FR-1, FR-3).
 */

export interface LugConnection {
  sourceLug: string;
  targetLug: string;
}

export interface SwitchConnectivityMap {
  [position: number]: LugConnection[];
}

/** 4-way switch (2 poles, 4 positions) per SRS §3 reference circuit */
export function create4WaySwitchMap(id: string): SwitchConnectivityMap {
  const a = (l: string) => `${id}_poleA_${l}`;
  const b = (l: string) => `${id}_poleB_${l}`;
  return {
    1: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: b('common'), targetLug: b('pos1') },
    ],
    2: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos1') },
      { sourceLug: b('common'), targetLug: b('pos2') },
    ],
    3: [
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos2') },
    ],
    4: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: b('common'), targetLug: b('pos2') },
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos1') },
    ],
  };
}

/** DPDT toggle/push-pull for phase reversal */
export function createDPDTSwitchMap(id: string): SwitchConnectivityMap {
  const a = (l: string) => `${id}_poleA_${l}`;
  const b = (l: string) => `${id}_poleB_${l}`;
  return {
    0: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: b('common'), targetLug: b('pos1') },
    ],
    1: [
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos2') },
    ],
  };
}

/** 3-way toggle (1 pole, 3 positions) */
export function create3WaySwitchMap(id: string): SwitchConnectivityMap {
  const l = (n: string) => `${id}_${n}`;
  return {
    1: [{ sourceLug: l('common'), targetLug: l('pos1') }],
    2: [
      { sourceLug: l('common'), targetLug: l('pos1') },
      { sourceLug: l('common'), targetLug: l('pos2') },
    ],
    3: [{ sourceLug: l('common'), targetLug: l('pos2') }],
  };
}

/** 5-way blade switch (2 poles, 5 positions) */
export function create5WaySwitchMap(id: string): SwitchConnectivityMap {
  const a = (l: string) => `${id}_poleA_${l}`;
  const b = (l: string) => `${id}_poleB_${l}`;
  return {
    1: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: b('common'), targetLug: b('pos1') },
    ],
    2: [
      { sourceLug: a('common'), targetLug: a('pos1') },
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos1') },
      { sourceLug: b('common'), targetLug: b('pos2') },
    ],
    3: [
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: b('common'), targetLug: b('pos2') },
    ],
    4: [
      { sourceLug: a('common'), targetLug: a('pos2') },
      { sourceLug: a('common'), targetLug: a('pos3') },
      { sourceLug: b('common'), targetLug: b('pos2') },
      { sourceLug: b('common'), targetLug: b('pos3') },
    ],
    5: [
      { sourceLug: a('common'), targetLug: a('pos3') },
      { sourceLug: b('common'), targetLug: b('pos3') },
    ],
  };
}

/** Get active connections for a switch at a given position */
export function getActiveConnections(
  map: SwitchConnectivityMap,
  position: number,
): LugConnection[] {
  return map[position] ?? [];
}
