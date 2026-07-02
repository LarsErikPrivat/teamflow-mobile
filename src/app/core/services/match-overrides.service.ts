import { Injectable, inject, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

import { MatchOverride } from '../models/match-override.model';
import { SeasonsService } from './season.service';
import { ClientService } from './client.service';

@Injectable({
  providedIn: 'root'
})
export class MatchOverridesService {
  private readonly supabase = inject(SupabaseService);
  private readonly seasonsService = inject(SeasonsService);
  private readonly clientService = inject(ClientService);

  readonly overrides = signal<MatchOverride[]>([]);

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.overrides.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('match_overrides')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to load overrides', error);
      this.overrides.set([]);
      return;
    }

    this.overrides.set((data ?? []).map((row) => this.fromRow(row)));
  }

  async clearAll(): Promise<void> {
    if (this.seasonsService.activeSeason()?.archived) {
      console.warn('Cannot modify archived season.');
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.overrides.set([]);
      return;
    }

    const { error } = await this.supabase.client
      .from('match_overrides')
      .delete()
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to clear overrides', error);
      return;
    }

    this.overrides.set([]);
  }

  getOverride(matchId: string): MatchOverride {
    return (
      this.overrides().find((item) => item.matchId === matchId) ?? {
        matchId,
        lockedPlayerIds: [],
        excludedPlayerIds: [],
        notes: {}
      }
    );
  }

  async setOverride(override: MatchOverride): Promise<void> {
    if (this.seasonsService.activeSeason()?.archived) {
      console.warn('Cannot modify archived season.');
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizeOverride({
      ...override,
      seasonId
    });

    const { error } = await this.supabase.client
      .from('match_overrides')
      .upsert(
        {
          ...this.toRow(normalized),
          client_id: clientId
        },
        {
          onConflict: 'client_id,season_id,match_id'
        }
      );

    if (error) {
      console.error('Failed to save override', error);
      return;
    }

    this.overrides.update((current) => {
      const index = current.findIndex(
        (item) =>
          item.matchId === normalized.matchId &&
          item.seasonId === normalized.seasonId
      );

      if (index === -1) {
        return [...current, normalized];
      }

      const updated = [...current];
      updated[index] = normalized;
      return updated;
    });
  }

  async toggleLockedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const locked = new Set(current.lockedPlayerIds);
    const excluded = new Set(current.excludedPlayerIds);

    if (locked.has(playerId)) {
      locked.delete(playerId);
    } else {
      locked.add(playerId);
      excluded.delete(playerId);
    }

    await this.setOverride({
      ...current,
      lockedPlayerIds: [...locked],
      excludedPlayerIds: [...excluded]
    });
  }

  async toggleExcludedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const locked = new Set(current.lockedPlayerIds);
    const excluded = new Set(current.excludedPlayerIds);

    if (excluded.has(playerId)) {
      excluded.delete(playerId);
    } else {
      excluded.add(playerId);
      locked.delete(playerId);
    }

    await this.setOverride({
      ...current,
      lockedPlayerIds: [...locked],
      excludedPlayerIds: [...excluded]
    });
  }

  async addLockedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const locked = new Set(current.lockedPlayerIds);
    const excluded = new Set(current.excludedPlayerIds);

    locked.add(playerId);
    excluded.delete(playerId);

    await this.setOverride({
      ...current,
      lockedPlayerIds: [...locked],
      excludedPlayerIds: [...excluded]
    });
  }

  async removeLockedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const locked = new Set(current.lockedPlayerIds);

    locked.delete(playerId);

    await this.setOverride({
      ...current,
      lockedPlayerIds: [...locked]
    });
  }

  async addExcludedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const locked = new Set(current.lockedPlayerIds);
    const excluded = new Set(current.excludedPlayerIds);

    excluded.add(playerId);
    locked.delete(playerId);

    await this.setOverride({
      ...current,
      lockedPlayerIds: [...locked],
      excludedPlayerIds: [...excluded]
    });
  }

  async removeExcludedPlayer(matchId: string, playerId: string): Promise<void> {
    const current = this.getOverride(matchId);
    const excluded = new Set(current.excludedPlayerIds);

    excluded.delete(playerId);

    await this.setOverride({
      ...current,
      excludedPlayerIds: [...excluded]
    });
  }

  async updateNote(matchId: string, playerId: string, note: string): Promise<void> {
    const current = this.getOverride(matchId);
    const nextNotes = { ...current.notes };

    if (note.trim()) {
      nextNotes[playerId] = note.trim();
    } else {
      delete nextNotes[playerId];
    }

    await this.setOverride({
      ...current,
      notes: nextNotes
    });
  }

  async removeOverride(matchId: string): Promise<void> {
    if (this.seasonsService.activeSeason()?.archived) {
      console.warn('Cannot modify archived season.');
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const { error } = await this.supabase.client
      .from('match_overrides')
      .delete()
      .eq('match_id', matchId)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to remove override', error);
      return;
    }

    this.overrides.update((current) =>
      current.filter((item) => item.matchId !== matchId)
    );
  }

  private fromRow(row: any): MatchOverride {
    return this.normalizeOverride({
      matchId: row.match_id,
      lockedPlayerIds: row.locked_player_ids,
      excludedPlayerIds: row.excluded_player_ids,
      notes: row.notes,
      seasonId: row.season_id
    });
  }

  private toRow(override: MatchOverride): any {
    return {
      match_id: override.matchId,
      locked_player_ids: override.lockedPlayerIds,
      excluded_player_ids: override.excludedPlayerIds,
      notes: override.notes,
      season_id: override.seasonId
    };
  }

  private normalizeOverride(value: Partial<MatchOverride>): MatchOverride {
    return {
      matchId: value.matchId ?? '',
      lockedPlayerIds: this.uniqueStrings(value.lockedPlayerIds),
      excludedPlayerIds: this.uniqueStrings(value.excludedPlayerIds),
      notes: value.notes ?? {},
      seasonId: value.seasonId
    };
  }

  private uniqueStrings(values: string[] | undefined | null): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
  }
}
