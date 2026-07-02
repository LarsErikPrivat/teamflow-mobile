export type PlayerLevel = 1 | 2 | 3;

export interface PlayerMatchMatrix {
  ownLevel1Target: number;
  ownLevel2Target: number;
  ownLevel3Target: number;
  hospiteringLevel1Target: number;
  hospiteringLevel2Target: number;
  hospiteringLevel3Target: number;
}

export interface PlayerPosition {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Player {
  seasonId?: string;
  id: string;
  name: string;

  /**
   * Legacy single position.
   * Keep until all old data has been migrated.
   */
  position: string;
  /**
   * New multi-position field.
   * Stores position ids from player_positions table.
   */
  positions: string[];

  level: PlayerLevel;
  matchMatrix: PlayerMatchMatrix;

  /** When false the player is skipped by the distribution algorithm entirely. */
  available: boolean;
}
