export interface MatchOverride {
  seasonId?: string;
  matchId: string;
  lockedPlayerIds: string[];
  excludedPlayerIds: string[];
  notes: Record<string, string>;
}
