import { Injectable, inject, signal } from '@angular/core';

import { Match } from '../models/match.model';
import { SupabaseService } from './supabase.service';
import { SeasonsService } from './season.service';
import { ClientService } from './client.service';

@Injectable({
  providedIn: 'root'
})
export class MatchesService {
  private readonly supabase = inject(SupabaseService);
  private readonly seasonsService = inject(SeasonsService);
  private readonly clientService = inject(ClientService);

  readonly matches = signal<Match[]>([]);

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.matches.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('matches')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', seasonId)
      .order('date')
      .order('time');

    if (error) {
      console.error('Failed to load matches', error);
      this.matches.set([]);
      return;
    }

    this.matches.set((data ?? []).map((row) => this.fromRow(row)));
  }

  async add(match: Match): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizeMatch({
      ...match,
      seasonId
    });

    const { error } = await this.supabase.client
      .from('matches')
      .insert({
        ...this.toRow(normalized),
        client_id: clientId
      });

    if (error) {
      console.error('Failed to add match', error);
      return;
    }

    this.matches.update((current) =>
      [...current, normalized].sort(
        (a, b) => this.getDateTime(a).getTime() - this.getDateTime(b).getTime()
      )
    );
  }

  async update(match: Match): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizeMatch({
      ...match,
      seasonId: match.seasonId ?? seasonId
    });

    const { error } = await this.supabase.client
      .from('matches')
      .update(this.toRow(normalized))
      .eq('id', normalized.id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to update match', error);
      return;
    }

    this.matches.update((current) =>
      current
        .map((item) => (item.id === normalized.id ? normalized : item))
        .sort(
          (a, b) => this.getDateTime(a).getTime() - this.getDateTime(b).getTime()
        )
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
      .from('matches')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to remove match', error);
      return;
    }

    this.matches.update((current) => current.filter((item) => item.id !== id));
  }

  async removeByTeamId(teamId: string): Promise<void> {
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
      .from('matches')
      .delete()
      .eq('team_id', teamId)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to remove matches for team', error);
      return;
    }

    this.matches.update((current) =>
      current.filter((match) => match.teamId !== teamId)
    );
  }

  async reset(): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.matches.set([]);
      return;
    }

    const { error } = await this.supabase.client
      .from('matches')
      .delete()
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to reset matches', error);
      return;
    }

    this.matches.set([]);
  }

  private fromRow(row: any): Match {
    return this.normalizeMatch({
      id: row.id,
      teamId: row.team_id,
      date: row.date,
      time: row.time,
      matchLevel: row.match_level,
      homeTeam: row.home_team ?? '',
      awayTeam: row.away_team ?? '',
      homeGame: row.home_game ?? undefined,
      required2014Players: row.required2014players ?? undefined,
      seasonId: row.season_id
    });
  }

  private toRow(match: Match): any {
    return {
      id: match.id,
      team_id: match.teamId,
      date: match.date,
      time: match.time,
      match_level: match.matchLevel,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      home_game: match.homeGame ?? null,
      required2014players: match.required2014Players ?? null,
      season_id: match.seasonId
    };
  }

  private normalizeMatch(match: Match): Match {
    return {
      ...match,
      homeTeam: match.homeTeam ?? '',
      awayTeam: match.awayTeam ?? '',
      matchLevel: this.normalizeMatchLevel(match.matchLevel),
      required2014Players:
        match.required2014Players == null
          ? undefined
          : Number(match.required2014Players)
    };
  }

  private normalizeMatchLevel(value: number | string): 1 | 2 | 3 {
    const normalized = Number(value);

    if (normalized === 2 || normalized === 3) {
      return normalized;
    }

    return 1;
  }

  private getDateTime(match: Match): Date {
    return new Date(`${match.date}T${match.time}`);
  }
}
