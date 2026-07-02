import { Match } from './match.model';
import { Player } from './player.model';

export type DistributionWarningSeverity = 'info' | 'warning' | 'error';

export interface DistributionWarning {
  message: string;
  severity: DistributionWarningSeverity;
  playerId?: string;
}

export interface DistributedMatch {
  match: Match;
  players: Player[];
  warnings: DistributionWarning[];
  lockedPlayerIds: string[];
  excludedPlayerIds: string[];
}
