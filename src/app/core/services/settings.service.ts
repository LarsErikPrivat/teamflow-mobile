import { Injectable, inject, signal } from '@angular/core';
import {
  AppSettings,
  DefaultMatchMatrixSettings,
  TeamRule
} from '../models/settings.model';
import { PlayerMatchMatrix } from '../models/player.model';
import { SupabaseService } from './supabase.service';
import { ClientService } from './client.service';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly supabase = inject(SupabaseService);
  private readonly clientService = inject(ClientService);

  readonly settings = signal<AppSettings>(this.createDefaultSettings());

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('settings')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load settings', error);
      this.settings.set(this.createDefaultSettings());
      return;
    }

    if (!data) {
      await this.replaceAll(this.createDefaultSettings());
      return;
    }

    this.settings.set(this.fromRow(data));
  }

  async update(settings: AppSettings): Promise<void> {
    await this.replaceAll(settings);
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    await this.replaceAll(settings);
  }

  async replaceAll(settings: AppSettings): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const normalized = this.normalizeSettings(settings);

    const { error } = await this.supabase.client
      .from('settings')
      .upsert(this.toRow(normalized, clientId), {
        onConflict: 'client_id'
      });

    if (error) {
      console.error('Failed to save settings', error);
      return;
    }

    this.settings.set(normalized);
  }

  async updateWeeklyMaxMatchesPerPlayer(value: number): Promise<void> {
    await this.replaceAll({
      ...this.settings(),
      weeklyMaxMatchesPerPlayer: this.normalizePositiveInt(value, 2)
    });
  }

  async updateTeamRule(teamId: string, requiredPlayerCount: number): Promise<void> {
  const current = this.settings();
  const existingRule = current.teamRules.find((item) => item.teamId === teamId);

  const normalizedRule: TeamRule = {
    teamId,
    requiredPlayerCount: this.normalizePositiveInt(requiredPlayerCount, 0),
    positionRules: existingRule?.positionRules ?? []
  };

  const existingIndex = current.teamRules.findIndex((item) => item.teamId === teamId);

  const nextRules =
    existingIndex === -1
      ? [...current.teamRules, normalizedRule]
      : current.teamRules.map((item) =>
          item.teamId === teamId ? normalizedRule : item
        );

  await this.replaceAll({
    ...current,
    teamRules: nextRules
  });
}

  async removeTeamRule(teamId: string): Promise<void> {
    await this.replaceAll({
      ...this.settings(),
      teamRules: this.settings().teamRules.filter((item) => item.teamId !== teamId)
    });
  }

  async reset(): Promise<void> {
    await this.replaceAll(this.createDefaultSettings());
  }

  private fromRow(row: any): AppSettings {
  return this.normalizeSettings({
    numberOfLevels: row.number_of_levels,
    weeklyMaxMatchesPerPlayer: row.weekly_max_matches_per_player,
    weeklyMinimumMatchTarget: row.weekly_minimum_match_target,
    maxConsecutiveWeeksWithoutMatch: row.max_consecutive_weeks_without_match,
    minimumDaysBetweenMatches: row.minimum_days_between_matches,
    ownMatchMinimumPlayers: row.own_match_minimum_players,
    level3StrictMaxMatches: row.level3_strict_max_matches,
    level3FallbackMaxMatches: row.level3_fallback_max_matches,
    fallbackExtraWeeklyAllowance: row.fallback_extra_weekly_allowance,
    ownTopUpCanUseAnyOwnLevel: row.own_top_up_can_use_any_own_level,
    usePositionsInDistribution: row.use_positions_in_distribution,
    defaultMatchMatrix: row.default_match_matrix,
    teamRules: row.team_rules,
    numberOfHospiteringLevels: row.number_of_hospitering_levels ?? row.number_of_levels ?? 3,
    useSquadPriority: row.use_squad_priority ?? false,
  });
}

 private toRow(settings: AppSettings, clientId: string): any {
  return {
    client_id: clientId,
    number_of_levels: settings.numberOfLevels,
    weekly_max_matches_per_player: settings.weeklyMaxMatchesPerPlayer,
    weekly_minimum_match_target: settings.weeklyMinimumMatchTarget,
    max_consecutive_weeks_without_match: settings.maxConsecutiveWeeksWithoutMatch,
    minimum_days_between_matches: settings.minimumDaysBetweenMatches,
    own_match_minimum_players: settings.ownMatchMinimumPlayers,
    level3_strict_max_matches: settings.level3StrictMaxMatches,
    level3_fallback_max_matches: settings.level3FallbackMaxMatches,
    fallback_extra_weekly_allowance: settings.fallbackExtraWeeklyAllowance,
    own_top_up_can_use_any_own_level: settings.ownTopUpCanUseAnyOwnLevel,
    use_positions_in_distribution: settings.usePositionsInDistribution,
    default_match_matrix: settings.defaultMatchMatrix,
    team_rules: settings.teamRules,
    number_of_hospitering_levels: settings.numberOfHospiteringLevels,
    use_squad_priority: settings.useSquadPriority,
  };
}

  private createDefaultSettings(): AppSettings {
    return {
      numberOfLevels: 3,
      weeklyMaxMatchesPerPlayer: 2,
      weeklyMinimumMatchTarget: 1,
      maxConsecutiveWeeksWithoutMatch: 1,
      minimumDaysBetweenMatches: 1,
      ownMatchMinimumPlayers: 12,
      level3StrictMaxMatches: 8,
      level3FallbackMaxMatches: 9,
      fallbackExtraWeeklyAllowance: 1,
      ownTopUpCanUseAnyOwnLevel: true,
      defaultMatchMatrix: this.createDefaultMatchMatrixSettings(),
      usePositionsInDistribution: false,
      teamRules: [],
      numberOfHospiteringLevels: 3,
      useSquadPriority: false,
    };
  }

 private createDefaultMatchMatrixSettings(): DefaultMatchMatrixSettings {
  return {
    level1: {
      ownLevel1Target: 5,
      ownLevel2Target: 1,
      ownLevel3Target: 0,
      hospiteringLevel1Target: 3,
      hospiteringLevel2Target: 0,
      hospiteringLevel3Target: 0
    },
    level2: {
      ownLevel1Target: 3,
      ownLevel2Target: 3,
      ownLevel3Target: 0,
      hospiteringLevel1Target: 0,
      hospiteringLevel2Target: 3,
      hospiteringLevel3Target: 0
    },
    level3: {
      ownLevel1Target: 0,
      ownLevel2Target: 0,
      ownLevel3Target: 8,
      hospiteringLevel1Target: 0,
      hospiteringLevel2Target: 0,
      hospiteringLevel3Target: 0
    }
  };
}

  private normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
    return {
      numberOfLevels: this.normalizePositiveInt(
        value?.numberOfLevels,
        2
      ),
      weeklyMaxMatchesPerPlayer: this.normalizePositiveInt(
        value?.weeklyMaxMatchesPerPlayer,
        2
      ),
      weeklyMinimumMatchTarget: this.normalizePositiveInt(
        value?.weeklyMinimumMatchTarget,
        1
      ),
      maxConsecutiveWeeksWithoutMatch: this.normalizePositiveInt(
        value?.maxConsecutiveWeeksWithoutMatch,
        1
      ),
      minimumDaysBetweenMatches: this.normalizePositiveInt(
        value?.minimumDaysBetweenMatches,
        1
      ),
      ownMatchMinimumPlayers: this.normalizePositiveInt(
        value?.ownMatchMinimumPlayers,
        12
      ),
      level3StrictMaxMatches: this.normalizePositiveInt(
        value?.level3StrictMaxMatches,
        8
      ),
      level3FallbackMaxMatches: this.normalizePositiveInt(
        value?.level3FallbackMaxMatches,
        9
      ),
      fallbackExtraWeeklyAllowance: this.normalizePositiveInt(
        value?.fallbackExtraWeeklyAllowance,
        1
      ),
      ownTopUpCanUseAnyOwnLevel:
        typeof value?.ownTopUpCanUseAnyOwnLevel === 'boolean'
          ? value.ownTopUpCanUseAnyOwnLevel
          : true,
      usePositionsInDistribution:
  typeof value?.usePositionsInDistribution === 'boolean'
    ? value.usePositionsInDistribution
    : false,
      defaultMatchMatrix: this.normalizeDefaultMatchMatrix(value?.defaultMatchMatrix),
      numberOfHospiteringLevels: this.normalizePositiveInt(value?.numberOfHospiteringLevels, value?.numberOfLevels ?? 3),
      useSquadPriority: typeof value?.useSquadPriority === 'boolean' ? value.useSquadPriority : false,
     teamRules: Array.isArray(value?.teamRules)
  ? value.teamRules.map((rule) => ({
      teamId: rule.teamId ?? '',
      requiredPlayerCount: this.normalizePositiveInt(rule.requiredPlayerCount, 0),
      positionRules: Array.isArray(rule.positionRules)
        ? rule.positionRules.map((positionRule) => ({
            positionId: positionRule.positionId ?? '',
            requiredCount: this.normalizePositiveInt(positionRule.requiredCount, 0)
          }))
        : []
    }))
  : []
    };
  }

  private normalizeDefaultMatchMatrix(
    value: Partial<DefaultMatchMatrixSettings> | null | undefined
  ): DefaultMatchMatrixSettings {
    const defaults = this.createDefaultMatchMatrixSettings();

    return {
      level1: this.normalizeMatrix(value?.level1, defaults.level1),
      level2: this.normalizeMatrix(value?.level2, defaults.level2),
      level3: this.normalizeMatrix(value?.level3, defaults.level3)
    };
  }

 private normalizeMatrix(
  value: Partial<PlayerMatchMatrix> | null | undefined,
  fallback: PlayerMatchMatrix
): PlayerMatchMatrix {
  return {
    ownLevel1Target: this.normalizePositiveInt(
      value?.ownLevel1Target,
      fallback.ownLevel1Target
    ),
    ownLevel2Target: this.normalizePositiveInt(
      value?.ownLevel2Target,
      fallback.ownLevel2Target
    ),
    ownLevel3Target: this.normalizePositiveInt(
      value?.ownLevel3Target,
      fallback.ownLevel3Target
    ),
    hospiteringLevel1Target: this.normalizePositiveInt(
      value?.hospiteringLevel1Target,
      fallback.hospiteringLevel1Target
    ),
    hospiteringLevel2Target: this.normalizePositiveInt(
      value?.hospiteringLevel2Target,
      fallback.hospiteringLevel2Target
    ),
    hospiteringLevel3Target: this.normalizePositiveInt(
      value?.hospiteringLevel3Target,
      fallback.hospiteringLevel3Target
    )
  };
}

  private normalizePositiveInt(value: number | null | undefined, fallback: number): number {
    const normalized = Number(value);

    if (!Number.isFinite(normalized)) {
      return fallback;
    }

    return Math.max(0, Math.floor(normalized));
  }
}
