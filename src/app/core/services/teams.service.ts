import { Injectable, inject, signal } from '@angular/core';

import { Team } from '../models/team.model';
import { SupabaseService } from './supabase.service';
import { SeasonsService } from './season.service';
import { MatchesService } from './matches.service';
import { ClientService } from './client.service';

@Injectable({
  providedIn: 'root'
})
export class TeamsService {
  private readonly supabase = inject(SupabaseService);
  private readonly seasonsService = inject(SeasonsService);
  private readonly matchesService = inject(MatchesService);
  private readonly clientService = inject(ClientService);

  readonly teams = signal<Team[]>([]);

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      this.teams.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('teams')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', seasonId)
      .order('name');

    if (error) {
      console.error('Failed to load teams', error);
      this.teams.set([]);
      return;
    }

    this.teams.set((data ?? []).map((row) => this.fromRow(row)));
  }

  async copyFromSeason(fromSeasonId: string, toSeasonId: string): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();

    const { data: sourceTeams, error: sourceError } = await this.supabase.client
      .from('teams')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', fromSeasonId)
      .order('name');

    if (sourceError) {
      console.error('Failed to load source teams', sourceError);
      return;
    }

    const { data: existingTeams, error: existingError } = await this.supabase.client
      .from('teams')
      .select('name')
      .eq('client_id', clientId)
      .eq('season_id', toSeasonId);

    if (existingError) {
      console.error('Failed to load existing teams', existingError);
      return;
    }

    const existingNames = new Set(
      (existingTeams ?? []).map((team) =>
        String(team.name ?? '').trim().toLowerCase()
      )
    );

    const teamsToCopy = (sourceTeams ?? []).filter((team) => {
      const name = String(team.name ?? '').trim().toLowerCase();
      return name && !existingNames.has(name);
    });

    if (teamsToCopy.length === 0) {
      await this.load();
      return;
    }

    const rows = teamsToCopy.map((row) => {
      const team = this.fromRow(row);

      return {
        ...this.toRow({
          ...team,
          id: crypto.randomUUID(),
          seasonId: toSeasonId
        }),
        client_id: clientId
      };
    });

    const { error: insertError } = await this.supabase.client
      .from('teams')
      .insert(rows);

    if (insertError) {
      console.error('Failed to copy teams', insertError);
      return;
    }

    await this.load();
  }

  async add(team: Team): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizeTeam({
      ...team,
      seasonId
    });

    const { error } = await this.supabase.client
      .from('teams')
      .insert({
        ...this.toRow(normalized),
        client_id: clientId
      });

    if (error) {
      console.error('Failed to add team', error);
      return;
    }

    this.teams.update((current) =>
      [...current, normalized].sort((a, b) => a.name.localeCompare(b.name, 'no'))
    );
  }

  async update(team: Team): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      console.error('No active season selected.');
      return;
    }

    const normalized = this.normalizeTeam({
      ...team,
      seasonId: team.seasonId ?? seasonId
    });

    const { error } = await this.supabase.client
      .from('teams')
      .update(this.toRow(normalized))
      .eq('id', normalized.id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to update team', error);
      return;
    }

    this.teams.update((current) =>
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

    await this.matchesService.removeByTeamId(id);

    const { error } = await this.supabase.client
      .from('teams')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId)
      .eq('season_id', seasonId);

    if (error) {
      console.error('Failed to remove team', error);
      return;
    }

    this.teams.update((current) => current.filter((item) => item.id !== id));
  }

 private fromRow(row: any): Team {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    isHospiteringTeam: row.is_hospitering_team,
    color: row.color ?? undefined
  };
}

 private toRow(team: Team): any {
  return {
    id: team.id,
    name: team.name,
    level: team.level,
    is_hospitering_team: team.isHospiteringTeam,
    color: team.color ?? null,
    season_id: team.seasonId
  };
}

  private normalizeTeam(team: Team): Team {
    return {
      ...team,
      name: team.name ?? '',
      isHospiteringTeam: team.isHospiteringTeam ?? false
    };
  }
}
