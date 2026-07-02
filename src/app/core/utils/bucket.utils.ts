import { Match } from '../models/match.model';
import { Player, PlayerMatchMatrix } from '../models/player.model';

export type BucketType =
  | 'ownLevel1'
  | 'ownLevel2'
  | 'ownLevel3'
  | 'hospiteringLevel1'
  | 'hospiteringLevel2'
  | 'hospiteringLevel3';

export interface BucketCounters {
  ownLevel1: Map<string, number>;
  ownLevel2: Map<string, number>;
  ownLevel3: Map<string, number>;
  hospiteringLevel1: Map<string, number>;
  hospiteringLevel2: Map<string, number>;
  hospiteringLevel3: Map<string, number>;
}

export function createBucketCounters(): BucketCounters {
  return {
    ownLevel1: new Map(),
    ownLevel2: new Map(),
    ownLevel3: new Map(),
    hospiteringLevel1: new Map(),
    hospiteringLevel2: new Map(),
    hospiteringLevel3: new Map()
  };
}

export function getBucketForMatch(match: Match, isHospiteringTeam: boolean): BucketType {
  if (!isHospiteringTeam && match.matchLevel === 1) return 'ownLevel1';
  if (!isHospiteringTeam && match.matchLevel === 2) return 'ownLevel2';
  if (!isHospiteringTeam && match.matchLevel === 3) return 'ownLevel3';
  if (isHospiteringTeam && match.matchLevel === 1) return 'hospiteringLevel1';
  if (isHospiteringTeam && match.matchLevel === 2) return 'hospiteringLevel2';
  return 'hospiteringLevel3';
}

export function canPlayForBucket(player: Player, bucket: BucketType): boolean {
  return getTargetForBucket(player.matchMatrix, bucket) > 0;
}

export function getTargetForBucket(matrix: PlayerMatchMatrix, bucket: BucketType): number {
  switch (bucket) {
    case 'ownLevel1':        return matrix.ownLevel1Target;
    case 'ownLevel2':        return matrix.ownLevel2Target;
    case 'ownLevel3':        return matrix.ownLevel3Target;
    case 'hospiteringLevel1': return matrix.hospiteringLevel1Target;
    case 'hospiteringLevel2': return matrix.hospiteringLevel2Target;
    case 'hospiteringLevel3': return matrix.hospiteringLevel3Target;
  }
}

export function getBucketCount(counters: BucketCounters, playerId: string, bucket: BucketType): number {
  return counters[bucket].get(playerId) ?? 0;
}

export function incrementBucketCount(counters: BucketCounters, playerId: string, bucket: BucketType): void {
  const map = counters[bucket];
  map.set(playerId, (map.get(playerId) ?? 0) + 1);
}

export function getBucketDeficit(player: Player, bucket: BucketType, counters: BucketCounters): number {
  const target = getTargetForBucket(player.matchMatrix, bucket);
  const current = getBucketCount(counters, player.id, bucket);
  return Math.max(target - current, 0);
}

export function getTotalMatchTarget(matrix: PlayerMatchMatrix): number {
  return (
    matrix.ownLevel1Target +
    matrix.ownLevel2Target +
    matrix.ownLevel3Target +
    matrix.hospiteringLevel1Target +
    matrix.hospiteringLevel2Target +
    matrix.hospiteringLevel3Target
  );
}
