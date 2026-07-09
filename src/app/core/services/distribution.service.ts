import { Injectable } from '@angular/core';
import { DistributedMatch, DistributionWarning } from '../models/distributed-match.model';
import { Match } from '../models/match.model';
import { MatchOverride } from '../models/match-override.model';
import { Player } from '../models/player.model';
import { TeamRule, AppSettings } from '../models/settings.model';
import {
  BucketType,
  BucketCounters,
  createBucketCounters,
  getBucketForMatch,
  canPlayForBucket,
  getTargetForBucket,
  getBucketCount,
  incrementBucketCount,
  getBucketDeficit
} from '../utils/bucket.utils';

@Injectable({
  providedIn: 'root'
})
export class DistributionService {

  generate(
    matches: Match[],
    players: Player[],
    settings: AppSettings,
    teams: { id: string; isHospiteringTeam?: boolean }[],
    overrides: MatchOverride[],
    options?: { randomizePlayers?: boolean }
  ): DistributedMatch[] {
    const weeklyPlayerCount = new Map<string, number>();
    const totalPlayerCount = new Map<string, number>();
    const counters = createBucketCounters();
    const assignedMatchDatesByPlayer = new Map<string, Date[]>();

    const availablePlayers = players.filter((p) => p.available !== false);

    const orderedPlayers = options?.randomizePlayers
      ? this.shufflePlayers(availablePlayers)
      : [...availablePlayers].sort((a, b) => a.name.localeCompare(b.name, 'no'));

    const playerIndex = new Map<string, number>();
    orderedPlayers.forEach((player, index) => playerIndex.set(player.id, index));

    const orderedMatches = [...matches].sort(
      (a, b) => this.getMatchDateTime(a).getTime() - this.getMatchDateTime(b).getTime()
    );

    return orderedMatches.map((match) => {
      const warnings: DistributionWarning[] = [];
      const selectedPlayers: Player[] = [];

      const team = teams.find((item) => item.id === match.teamId);
      const isHospiteringTeam = team?.isHospiteringTeam ?? false;

      // Hospitant players may only play for own-team matches, never hospitering teams
      const matchEligiblePlayers = isHospiteringTeam
        ? orderedPlayers.filter((p) => !p.isHospitant)
        : orderedPlayers;

      const rule = settings.teamRules.find((item) => item.teamId === match.teamId);

      const override = overrides.find((item) => item.matchId === match.id) ?? {
        matchId: match.id,
        lockedPlayerIds: [],
        excludedPlayerIds: [],
        notes: {}
      };

      const excludedIds = new Set(override.excludedPlayerIds);
      const lockedIds = new Set(
        override.lockedPlayerIds.filter((id) => !excludedIds.has(id))
      );

      const bucket = getBucketForMatch(match, isHospiteringTeam);
      const totalRequired = this.getRequiredPlayersForMatch(match, isHospiteringTeam, settings, rule);
      const squadTeamId = settings.useSquadPriority ? match.teamId : null;

      if (totalRequired === 0) {
        return {
          match,
          players: [],
          warnings: [{ severity: 'info', message: 'Denne kampen krever 0 spillere.' }],
          lockedPlayerIds: [...lockedIds],
          excludedPlayerIds: [...excludedIds]
        };
      }

      const lockedPlayers = matchEligiblePlayers
        .filter((player) => lockedIds.has(player.id))
        .filter((player) => !excludedIds.has(player.id));

      selectedPlayers.push(...lockedPlayers);

      for (const player of lockedPlayers) {
        const validForMatch = isHospiteringTeam
          ? canPlayForBucket(player, bucket)
          : this.canPlayAnyOwnMatch(player);

        if (!validForMatch) {
          warnings.push({
            severity: 'warning',
            playerId: player.id,
            message: `${player.name} er låst til kampen selv om spilleren ikke matcher vanlig logikk.`
          });
        }

        if (!this.hasMinimumRestBetweenMatches(player.id, match, assignedMatchDatesByPlayer, settings.minimumDaysBetweenMatches)) {
          warnings.push({
            severity: 'warning',
            playerId: player.id,
            message: `${player.name} er låst til kampen selv om spilleren ikke har minst én fridag mellom kamper.`
          });
        }
      }

      if (settings.usePositionsInDistribution && rule?.positionRules?.length) {
        const positionRules = rule.positionRules.filter((item) => item.requiredCount > 0);

        for (const positionRule of positionRules) {
          const alreadySelectedForPosition = selectedPlayers.filter((player) =>
            this.hasPosition(player, positionRule.positionId)
          ).length;

          const neededForPosition = Math.max(
            positionRule.requiredCount - alreadySelectedForPosition,
            0
          );

          if (neededForPosition === 0) {
            continue;
          }

          let positionCandidates = matchEligiblePlayers
            .filter((player) => canPlayForBucket(player, bucket))
            .filter((player) => this.hasPosition(player, positionRule.positionId))
            .filter((player) => !excludedIds.has(player.id))
            .filter((player) => !selectedPlayers.some((selected) => selected.id === player.id))
            .filter((player) =>
              this.isAllowedByFallbackLoadRules(
                player, match, settings, weeklyPlayerCount, totalPlayerCount,
                assignedMatchDatesByPlayer, bucket, counters
              )
            );

          positionCandidates = [...positionCandidates].sort((a, b) =>
            this.comparePlayersForPosition(
              a, b, positionRule.positionId, bucket, match,
              counters, totalPlayerCount, weeklyPlayerCount, playerIndex, squadTeamId
            )
          );

          const pickedForPosition = positionCandidates.slice(0, neededForPosition);
          selectedPlayers.push(...pickedForPosition);

          if (pickedForPosition.length < neededForPosition) {
            warnings.push({
              severity: 'warning',
              message: `Mangler ${neededForPosition - pickedForPosition.length} spiller(e) for posisjon ${positionRule.positionId}.`
            });
          }

          if (selectedPlayers.length >= totalRequired) {
            break;
          }
        }
      }

      const remainingNeeded = Math.max(totalRequired - selectedPlayers.length, 0);

      if (remainingNeeded > 0) {
        let strictCandidates = matchEligiblePlayers
          .filter((player) => canPlayForBucket(player, bucket))
          .filter((player) => !excludedIds.has(player.id))
          .filter((player) => !selectedPlayers.some((selected) => selected.id === player.id))
          .filter((player) =>
            this.isAllowedByStrictLoadRules(
              player, match, settings, weeklyPlayerCount, totalPlayerCount,
              assignedMatchDatesByPlayer, bucket, counters
            )
          );

        const stillNeedThisBucket = strictCandidates.filter(
          (player) => getBucketDeficit(player, bucket, counters) > 0
        );

        if (stillNeedThisBucket.length > 0) {
          strictCandidates = stillNeedThisBucket;
        }

        strictCandidates = [...strictCandidates].sort((a, b) =>
          this.comparePlayersForBucket(
            a, b, bucket, match, counters, totalPlayerCount, weeklyPlayerCount, playerIndex, squadTeamId
          )
        );

        let picked = strictCandidates.slice(0, remainingNeeded);

        if (picked.length < remainingNeeded) {
          let fallbackCandidates = matchEligiblePlayers
            .filter((player) => canPlayForBucket(player, bucket))
            .filter((player) => !excludedIds.has(player.id))
            .filter((player) => !selectedPlayers.some((selected) => selected.id === player.id))
            .filter((player) => !picked.some((selected) => selected.id === player.id))
            .filter((player) =>
              this.isAllowedByFallbackLoadRules(
                player, match, settings, weeklyPlayerCount, totalPlayerCount,
                assignedMatchDatesByPlayer, bucket, counters
              )
            );

          fallbackCandidates = [...fallbackCandidates].sort((a, b) =>
            this.comparePlayersForBucketFallback(
              a, b, bucket, match, counters, totalPlayerCount, weeklyPlayerCount, playerIndex, squadTeamId
            )
          );

          const fallbackNeeded = remainingNeeded - picked.length;
          const fallbackPicked = fallbackCandidates.slice(0, fallbackNeeded);

          if (fallbackPicked.length > 0) {
            warnings.push({
              severity: 'warning',
              message: `Fylte ${fallbackPicked.length} spiller(e) med fallback-regler.`
            });

            for (const player of fallbackPicked) {
              warnings.push({
                severity: 'warning',
                playerId: player.id,
                message: `${player.name} ble satt inn med fallback-regler.`
              });
            }
          }

          picked = [...picked, ...fallbackPicked];
        }

        selectedPlayers.push(...picked);
      }

      if (!isHospiteringTeam && selectedPlayers.length < settings.ownMatchMinimumPlayers) {
        const extraNeeded = settings.ownMatchMinimumPlayers - selectedPlayers.length;

        let topUpCandidates = matchEligiblePlayers
          .filter((player) => this.canPlayAnyOwnMatch(player))
          .filter((player) => !excludedIds.has(player.id))
          .filter((player) => !selectedPlayers.some((selected) => selected.id === player.id))
          .filter((player) =>
            this.isAllowedByFallbackLoadRules(
              player, match, settings, weeklyPlayerCount, totalPlayerCount,
              assignedMatchDatesByPlayer
            )
          );

        topUpCandidates = [...topUpCandidates].sort((a, b) => {
          if (squadTeamId) {
            const aSquad = a.teamId === squadTeamId ? 0 : 1;
            const bSquad = b.teamId === squadTeamId ? 0 : 1;
            if (aSquad !== bSquad) return aSquad - bSquad;
          }

          const aTotal = totalPlayerCount.get(a.id) ?? 0;
          const bTotal = totalPlayerCount.get(b.id) ?? 0;

          if (aTotal !== bTotal) return aTotal - bTotal;

          const aWeekly = this.getWeeklyCount(weeklyPlayerCount, a.id, match);
          const bWeekly = this.getWeeklyCount(weeklyPlayerCount, b.id, match);

          if (aWeekly !== bWeekly) return aWeekly - bWeekly;

          return (playerIndex.get(a.id) ?? 0) - (playerIndex.get(b.id) ?? 0);
        });

        const extraPicked = topUpCandidates.slice(0, extraNeeded);

        if (extraPicked.length > 0) {
          warnings.push({
            severity: 'warning',
            message: `La til ${extraPicked.length} ekstra spiller(e) for å fylle opp til ${settings.ownMatchMinimumPlayers}.`
          });

          for (const player of extraPicked) {
            warnings.push({
              severity: 'warning',
              playerId: player.id,
              message: `${player.name} ble lagt til for å fylle opp laget.`
            });
          }
        }

        selectedPlayers.push(...extraPicked);
      }

      const uniquePlayers = selectedPlayers.filter(
        (player, index, arr) => arr.findIndex((item) => item.id === player.id) === index
      );

      const finalPlayers = uniquePlayers.filter((player) => !excludedIds.has(player.id));

      for (const player of finalPlayers) {
        this.incrementWeeklyCount(weeklyPlayerCount, player.id, match);
        this.incrementTotalCount(totalPlayerCount, player.id);
        incrementBucketCount(counters, player.id, bucket);
        this.addAssignedMatchDate(assignedMatchDatesByPlayer, player.id, match);
      }

      if (!isHospiteringTeam && finalPlayers.length < settings.ownMatchMinimumPlayers) {
        warnings.push({
          severity: 'error',
          message: `Kunne bare fylle ${finalPlayers.length} av ${settings.ownMatchMinimumPlayers} spillere på egen kamp.`
        });
      }

      if (isHospiteringTeam && finalPlayers.length < totalRequired) {
        warnings.push({
          severity: 'error',
          message: `Kunne bare fylle ${finalPlayers.length} av ${totalRequired} spillere.`
        });
      }

      return {
        match,
        players: finalPlayers,
        warnings,
        lockedPlayerIds: [...lockedIds],
        excludedPlayerIds: [...excludedIds]
      };
    });
  }

  private getRequiredPlayersForMatch(
    match: Match,
    isHospiteringTeam: boolean,
    settings: AppSettings,
    rule?: TeamRule
  ): number {
    if (isHospiteringTeam) {
      if (match.required2014Players != null) {
        return Number(match.required2014Players);
      }
      return Number(rule?.requiredPlayerCount ?? 0);
    }
    return settings.ownMatchMinimumPlayers;
  }

  private getPositionPriority(player: Player, positionId: string): number {
    const index = player.positions?.indexOf(positionId) ?? -1;
    return index === -1 ? 999 : index;
  }

  private hasPosition(player: Player, positionId: string): boolean {
    return this.getPositionPriority(player, positionId) < 999;
  }

  private canPlayAnyOwnMatch(player: Player): boolean {
    return (
      player.matchMatrix.ownLevel1Target > 0 ||
      player.matchMatrix.ownLevel2Target > 0 ||
      player.matchMatrix.ownLevel3Target > 0
    );
  }

  private comparePlayersForPosition(
    a: Player,
    b: Player,
    positionId: string,
    bucket: BucketType,
    match: Match,
    counters: BucketCounters,
    totalPlayerCount: Map<string, number>,
    weeklyPlayerCount: Map<string, number>,
    playerIndex: Map<string, number>,
    squadTeamId: string | null
  ): number {
    const positionCompare =
      this.getPositionPriority(a, positionId) - this.getPositionPriority(b, positionId);

    if (positionCompare !== 0) {
      return positionCompare;
    }

    return this.comparePlayersForBucket(
      a, b, bucket, match, counters, totalPlayerCount, weeklyPlayerCount, playerIndex, squadTeamId
    );
  }

  private comparePlayersForBucket(
    a: Player,
    b: Player,
    bucket: BucketType,
    match: Match,
    counters: BucketCounters,
    totalPlayerCount: Map<string, number>,
    weeklyPlayerCount: Map<string, number>,
    playerIndex: Map<string, number>,
    squadTeamId: string | null = null
  ): number {
    if (squadTeamId) {
      const aSquad = a.teamId === squadTeamId ? 0 : 1;
      const bSquad = b.teamId === squadTeamId ? 0 : 1;
      if (aSquad !== bSquad) return aSquad - bSquad;
    }

    const aCurrent = getBucketCount(counters, a.id, bucket);
    const bCurrent = getBucketCount(counters, b.id, bucket);

    const aTarget = getTargetForBucket(a.matchMatrix, bucket);
    const bTarget = getTargetForBucket(b.matchMatrix, bucket);

    const aDeficit = Math.max(aTarget - aCurrent, 0);
    const bDeficit = Math.max(bTarget - bCurrent, 0);

    const aNeedsBucket = aDeficit > 0 ? 0 : 1;
    const bNeedsBucket = bDeficit > 0 ? 0 : 1;

    if (aNeedsBucket !== bNeedsBucket) return aNeedsBucket - bNeedsBucket;
    if (aDeficit !== bDeficit) return bDeficit - aDeficit;

    const aRatio = aCurrent / Math.max(aTarget, 1);
    const bRatio = bCurrent / Math.max(bTarget, 1);

    if (aRatio !== bRatio) return aRatio - bRatio;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;

    const aTotal = totalPlayerCount.get(a.id) ?? 0;
    const bTotal = totalPlayerCount.get(b.id) ?? 0;

    if (aTotal !== bTotal) return aTotal - bTotal;

    const aWeekly = this.getWeeklyCount(weeklyPlayerCount, a.id, match);
    const bWeekly = this.getWeeklyCount(weeklyPlayerCount, b.id, match);

    if (aWeekly !== bWeekly) return aWeekly - bWeekly;

    return (playerIndex.get(a.id) ?? 0) - (playerIndex.get(b.id) ?? 0);
  }

  private comparePlayersForBucketFallback(
    a: Player,
    b: Player,
    bucket: BucketType,
    match: Match,
    counters: BucketCounters,
    totalPlayerCount: Map<string, number>,
    weeklyPlayerCount: Map<string, number>,
    playerIndex: Map<string, number>,
    squadTeamId: string | null = null
  ): number {
    if (squadTeamId) {
      const aSquad = a.teamId === squadTeamId ? 0 : 1;
      const bSquad = b.teamId === squadTeamId ? 0 : 1;
      if (aSquad !== bSquad) return aSquad - bSquad;
    }

    const aCurrent = getBucketCount(counters, a.id, bucket);
    const bCurrent = getBucketCount(counters, b.id, bucket);

    const aTarget = getTargetForBucket(a.matchMatrix, bucket);
    const bTarget = getTargetForBucket(b.matchMatrix, bucket);

    const aOverBy = Math.max(aCurrent - aTarget, 0);
    const bOverBy = Math.max(bCurrent - bTarget, 0);

    if (aOverBy !== bOverBy) return aOverBy - bOverBy;

    const aRatio = aCurrent / Math.max(aTarget, 1);
    const bRatio = bCurrent / Math.max(bTarget, 1);

    if (aRatio !== bRatio) return aRatio - bRatio;

    const aTotal = totalPlayerCount.get(a.id) ?? 0;
    const bTotal = totalPlayerCount.get(b.id) ?? 0;

    if (aTotal !== bTotal) return aTotal - bTotal;

    const aWeekly = this.getWeeklyCount(weeklyPlayerCount, a.id, match);
    const bWeekly = this.getWeeklyCount(weeklyPlayerCount, b.id, match);

    if (aWeekly !== bWeekly) return aWeekly - bWeekly;

    return (playerIndex.get(a.id) ?? 0) - (playerIndex.get(b.id) ?? 0);
  }

  private isAllowedByStrictLoadRules(
    player: Player,
    match: Match,
    settings: AppSettings,
    weeklyPlayerCount: Map<string, number>,
    totalPlayerCount: Map<string, number>,
    assignedMatchDatesByPlayer: Map<string, Date[]>,
    bucket?: BucketType,
    counters?: BucketCounters
  ): boolean {
    if (!this.hasMinimumRestBetweenMatches(player.id, match, assignedMatchDatesByPlayer, settings.minimumDaysBetweenMatches)) {
      return false;
    }

    if (player.level === 3 && bucket && counters) {
      const totalCount = totalPlayerCount.get(player.id) ?? 0;
      if (totalCount >= settings.level3StrictMaxMatches) {
        if (getBucketDeficit(player, bucket, counters) <= 0) {
          return false;
        }
      }
    }

    const weeklyCount = this.getWeeklyCount(weeklyPlayerCount, player.id, match);
    return weeklyCount < settings.weeklyMaxMatchesPerPlayer;
  }

  private isAllowedByFallbackLoadRules(
    player: Player,
    match: Match,
    settings: AppSettings,
    weeklyPlayerCount: Map<string, number>,
    totalPlayerCount: Map<string, number>,
    assignedMatchDatesByPlayer: Map<string, Date[]>,
    bucket?: BucketType,
    counters?: BucketCounters
  ): boolean {
    if (!this.hasMinimumRestBetweenMatches(player.id, match, assignedMatchDatesByPlayer, settings.minimumDaysBetweenMatches)) {
      return false;
    }

    if (player.level === 3 && bucket && counters) {
      const totalCount = totalPlayerCount.get(player.id) ?? 0;
      if (totalCount >= settings.level3FallbackMaxMatches) {
        if (getBucketDeficit(player, bucket, counters) <= 0) {
          return false;
        }
      }
    }

    // Fallback uses the same weekly cap as strict — the configured max is a hard limit.
    const weeklyCount = this.getWeeklyCount(weeklyPlayerCount, player.id, match);
    return weeklyCount < settings.weeklyMaxMatchesPerPlayer;
  }

  private hasMinimumRestBetweenMatches(
    playerId: string,
    match: Match,
    assignedMatchDatesByPlayer: Map<string, Date[]>,
    minimumDaysBetweenMatches: number
  ): boolean {
    const existingDates = assignedMatchDatesByPlayer.get(playerId) ?? [];
    const currentDate = this.getMatchCalendarDate(match);

    return existingDates.every((assignedDate) => {
      const diffDays = this.getCalendarDayDifference(assignedDate, currentDate);
      return diffDays > minimumDaysBetweenMatches;
    });
  }

  private addAssignedMatchDate(
    assignedMatchDatesByPlayer: Map<string, Date[]>,
    playerId: string,
    match: Match
  ): void {
    const current = assignedMatchDatesByPlayer.get(playerId) ?? [];
    assignedMatchDatesByPlayer.set(playerId, [...current, this.getMatchCalendarDate(match)]);
  }

  private getMatchCalendarDate(match: Match): Date {
    const date = new Date(`${match.date}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getCalendarDayDifference(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.abs(Math.round((a.getTime() - b.getTime()) / msPerDay));
  }

  private shufflePlayers(players: Player[]): Player[] {
    const copy = [...players];

    for (let index = copy.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }

    return copy;
  }

  private getMatchDateTime(match: Match): Date {
    return new Date(`${match.date}T${match.time}`);
  }

  // ISO 8601 week key — consistent with getWeekNumber in the component.
  private getWeekKey(match: Match): string {
    const date = new Date(`${match.date}T00:00:00`);
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstDayNum = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
    const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
    return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private getPlayerWeekMapKey(playerId: string, match: Match): string {
    return `${playerId}__${this.getWeekKey(match)}`;
  }

  private getWeeklyCount(store: Map<string, number>, playerId: string, match: Match): number {
    return store.get(this.getPlayerWeekMapKey(playerId, match)) ?? 0;
  }

  private incrementWeeklyCount(store: Map<string, number>, playerId: string, match: Match): void {
    const key = this.getPlayerWeekMapKey(playerId, match);
    store.set(key, (store.get(key) ?? 0) + 1);
  }

  private incrementTotalCount(store: Map<string, number>, playerId: string): void {
    store.set(playerId, (store.get(playerId) ?? 0) + 1);
  }
}
