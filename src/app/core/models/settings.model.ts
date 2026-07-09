import { PlayerMatchMatrix } from "./player.model";

export type PlayerLevel = 1 | 2 | 3;

export interface LevelRequirement {
  level: 1 | 2 | 3;
  count: number;
}
export interface TeamPositionRule {
  positionId: string;
  requiredCount: number;
}
export interface TeamRule {
  teamId: string;
  requiredPlayerCount: number;
  positionRules: TeamPositionRule[];
}

export interface DefaultMatchMatrixSettings {
  level1: PlayerMatchMatrix;
  level2: PlayerMatchMatrix;
  level3: PlayerMatchMatrix;
}

export interface AppSettings {
  numberOfLevels: number;
  weeklyMaxMatchesPerPlayer: number;
  weeklyMinimumMatchTarget: number;
  maxConsecutiveWeeksWithoutMatch: number;
  minimumDaysBetweenMatches: number;
  ownMatchMinimumPlayers: number;
  level3StrictMaxMatches: number;
  level3FallbackMaxMatches: number;
  fallbackExtraWeeklyAllowance: number;
  ownTopUpCanUseAnyOwnLevel: boolean;
  defaultMatchMatrix: DefaultMatchMatrixSettings;
  usePositionsInDistribution: boolean;
  teamRules: TeamRule[];
  numberOfHospiteringLevels: number;
  useSquadPriority: boolean;
}
