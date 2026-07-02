import { Injectable, inject, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

import { Player, PlayerLevel, PlayerMatchMatrix } from '../models/player.model';
import { SeasonsService } from './season.service';
import { ClientService } from './client.service';

@Injectable({
  providedIn: 'root'
})
export class PlayersService {
  private readonly supabase = inject(SupabaseService);
  private readonly seasonsService = inject(SeasonsService);
  private readonly clientService = inject(ClientService);

  readonly players = signal<Player[]>([]);

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.players.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('players')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', seasonId)
      .order('name');

    if (error) {
      console.error('Failed to load players', error);
      this.players.set([]);
      return;
    }
    console.log('Players load', {
  clientId,
  seasonId,
});
    const normalized = (data ?? []).map((row) => this.fromRow(row));
    this.players.set(normalized);
  }

  async add(player: Player): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizePlayer({
      ...player,
      seasonId
    });

    const { error } = await this.supabase.client
      .from('players')
      .insert({
        ...this.toRow(normalized),
        client_id: clientId
      });

    if (error) {
      console.error('Failed to add player', error);
      return;
    }

    this.players.update((current) =>
      [...current, normalized].sort((a, b) => a.name.localeCompare(b.name, 'no'))
    );
  }

  async update(player: Player): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizePlayer({
      ...player,
      seasonId: player.seasonId ?? seasonId
    });

    const { error } = await this.supabase.client
      .from('players')
      .update(this.toRow(normalized))
      .eq('id', normalized.id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to update player', error);
      return;
    }

    this.players.update((current) =>
      current
        .map((item) => (item.id === normalized.id ? normalized : item))
        .sort((a, b) => a.name.localeCompare(b.name, 'no'))
    );
  }

  async remove(id: string): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const { error } = await this.supabase.client
      .from('players')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to remove player', error);
      return;
    }

    this.players.update((current) => current.filter((item) => item.id !== id));
  }

  async copyFromSeason(fromSeasonId: string, toSeasonId: string): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();

    const { data: sourcePlayers, error: sourceError } = await this.supabase.client
      .from('players')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', fromSeasonId)
      .order('name');

    if (sourceError) {
      console.error('Failed to load source players', sourceError);
      return;
    }

    const { data: existingPlayers, error: existingError } = await this.supabase.client
      .from('players')
      .select('name')
      .eq('client_id', clientId)
      .eq('season_id', toSeasonId);

    if (existingError) {
      console.error('Failed to load existing players', existingError);
      return;
    }

    const existingNames = new Set(
      (existingPlayers ?? []).map((player) =>
        String(player.name ?? '').trim().toLowerCase()
      )
    );

    const playersToCopy = (sourcePlayers ?? []).filter((player) => {
      const name = String(player.name ?? '').trim().toLowerCase();
      return name && !existingNames.has(name);
    });

    if (playersToCopy.length === 0) {
      await this.load();
      return;
    }

    const rows = playersToCopy.map((row) => {
      const player = this.fromRow(row);

      return {
        ...this.toRow({
          ...player,
          id: crypto.randomUUID(),
          seasonId: toSeasonId
        }),
        client_id: clientId
      };
    });

    const { error: insertError } = await this.supabase.client
      .from('players')
      .insert(rows);

    if (insertError) {
      console.error('Failed to copy players', insertError);
      return;
    }

    await this.load();
  }

  private fromRow(row: any): Player {
    return this.normalizePlayer({
      id: row.id,
      name: row.name,
      position: row.position ?? '',
      positions: Array.isArray(row.positions) ? row.positions : [],
      level: row.level,
      matchMatrix: row.match_matrix,
      seasonId: row.season_id,
      available: row.available ?? true
    });
  }

  private toRow(player: Player): any {
    return {
      id: player.id,
      name: player.name,
      position: player.position,
      positions: player.positions ?? [],
      level: player.level,
      match_matrix: player.matchMatrix,
      season_id: player.seasonId,
      available: player.available ?? true
    };
  }

  private normalizePlayer(player: Player): Player {
    const positions = Array.isArray(player.positions)
      ? player.positions.filter((value) => typeof value === 'string' && value.trim())
      : player.position
        ? [player.position]
        : [];

    const uniquePositions = [...new Set(positions)];

    return {
      id: player.id,
      name: player.name ?? '',
      position: uniquePositions[0] ?? '',
      positions: uniquePositions,
      level: this.normalizeLevel(player.level),
      matchMatrix: this.ensureMatchMatrix(player),
      seasonId: player.seasonId,
      available: player.available ?? true
    };
  }

  private ensureMatchMatrix(player: Player): PlayerMatchMatrix {
    const existing = player.matchMatrix;

    if (existing) {
      return {
        ownLevel1Target: this.normalizeTarget(existing.ownLevel1Target),
        ownLevel2Target: this.normalizeTarget(existing.ownLevel2Target),
        ownLevel3Target: this.normalizeTarget(existing.ownLevel3Target),
        hospiteringLevel1Target: this.normalizeTarget(existing.hospiteringLevel1Target),
        hospiteringLevel2Target: this.normalizeTarget(existing.hospiteringLevel2Target),
        hospiteringLevel3Target: this.normalizeTarget(existing.hospiteringLevel3Target)
      };
    }

    return this.createDefaultMatchMatrix(this.normalizeLevel(player.level));
  }

  private createDefaultMatchMatrix(level: PlayerLevel): PlayerMatchMatrix {
    if (level === 3) {
      return {
        ownLevel1Target: 0,
        ownLevel2Target: 2,
        ownLevel3Target:4,
        hospiteringLevel1Target: 0,
        hospiteringLevel2Target: 0,
        hospiteringLevel3Target: 0
      };
    }
    if (level === 2) {
      return {
        ownLevel1Target: 3,
        ownLevel2Target: 3,
        ownLevel3Target:0,
        hospiteringLevel1Target: 0,
        hospiteringLevel2Target: 3,
        hospiteringLevel3Target: 0
      };
    }

    if (level === 1) {
      return {
        ownLevel1Target: 5,
        ownLevel2Target: 1,
        ownLevel3Target:0,
        hospiteringLevel1Target: 3,
        hospiteringLevel2Target: 0,
        hospiteringLevel3Target: 0
      };
    }

    return {
      ownLevel1Target: 0,
      ownLevel2Target: 8,
      ownLevel3Target: 0,
      hospiteringLevel1Target: 0,
      hospiteringLevel2Target: 0,
      hospiteringLevel3Target: 0
    };
  }

  private normalizeTarget(value: number | null | undefined): number {
    return Math.max(0, Math.floor(value ?? 0));
  }

  private normalizeLevel(value: number | string | undefined | null): PlayerLevel {
    const normalized = Number(value);

    if (normalized === 2 || normalized === 3) {
      return normalized;
    }

    return 1;
  }
}
