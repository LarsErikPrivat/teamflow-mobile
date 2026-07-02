import { Injectable, computed, inject, signal } from '@angular/core';

import { Season, SeasonHalf } from '../models/season.model';
import { SupabaseService } from './supabase.service';
import { ClientService } from './client.service';

const ACTIVE_SEASON_KEY = 'activeSeasonId';

@Injectable({ providedIn: 'root' })
export class SeasonsService {
  private readonly supabase = inject(SupabaseService);
  private readonly clientService = inject(ClientService);

  readonly seasons = signal<Season[]>([]);
  readonly activeSeason = signal<Season | null>(null);

  readonly isActiveSeasonArchived = computed(
    () => this.activeSeason()?.archived ?? false
  );

  ensureSeasonWritable(): boolean {
    if (this.activeSeason()?.archived) {
      alert('Arkiverte sesonger er skrivebeskyttet.');
      return false;
    }

    return true;
  }

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('seasons')
      .select('id, year, half, name, archived')
      .eq('client_id', clientId)
      .order('year', { ascending: false })
      .order('half', { ascending: true });

    if (error) {
      throw error;
    }

    const seasons = (data ?? []).map((row) => this.fromRow(row));

    this.seasons.set(seasons);

    const savedActiveSeasonId = localStorage.getItem(
      this.activeSeasonKey(clientId)
    );

    const savedSeason =
      seasons.find((season) => season.id === savedActiveSeasonId) ?? null;

    this.activeSeason.set(savedSeason);

    if (savedSeason) {
      localStorage.setItem(
        this.activeSeasonKey(clientId),
        savedSeason.id
      );
    } else {
      localStorage.removeItem(this.activeSeasonKey(clientId));
    }
  }

  async create(year: number, half: SeasonHalf): Promise<void> {
    const id = `${year}-${half.toLowerCase()}`;

    await this.add({
      id,
      year,
      half,
      name: `${year} ${half === 'SPRING' ? 'vår' : 'høst'}`,
      archived: false
    });

    this.setActiveSeason(id);
  }

  async add(season: Season): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { error } = await this.supabase.client
      .from('seasons')
      .insert({
        ...this.toRow(season),
        client_id: clientId
      });

    if (error) {
      throw error;
    }

    await this.load();
  }

  async update(season: Season): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { error } = await this.supabase.client
      .from('seasons')
      .update(this.toRow(season))
      .eq('id', season.id)
      .eq('client_id', clientId);

    if (error) {
      throw error;
    }

    await this.load();
  }

  async archive(id: string): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { error } = await this.supabase.client
      .from('seasons')
      .update({ archived: true })
      .eq('id', id)
      .eq('client_id', clientId);

    if (error) {
      throw error;
    }

    await this.load();
  }

  setActiveSeason(id: string): void {
    const season = this.seasons().find((item) => item.id === id);
    const clientId = this.clientService.requireClientId();

    if (!season) {
      return;
    }

    this.activeSeason.set(season);
    localStorage.setItem(this.activeSeasonKey(clientId), id);
  }

  async reactivate(id: string): Promise<void> {
    const clientId = this.clientService.requireClientId();

    const { error } = await this.supabase.client
      .from('seasons')
      .update({ archived: false })
      .eq('id', id)
      .eq('client_id', clientId);

    if (error) {
      throw error;
    }

    await this.load();
  }

  async deleteSeason(seasonId: string): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const isDeletingActiveSeason = this.activeSeason()?.id === seasonId;

    const tables = [
      'match_overrides',
      'settings',
      'matches',
      'teams',
      'players'
    ];

    for (const table of tables) {
      const { error } = await this.supabase.client
        .from(table)
        .delete()
        .eq('season_id', seasonId)
        .eq('client_id', clientId);

      if (error) {
        console.error(`Failed to delete ${table} for season ${seasonId}`, error);
        throw error;
      }
    }

    const { data, error: seasonError } = await this.supabase.client
      .from('seasons')
      .delete()
      .eq('id', seasonId)
      .eq('client_id', clientId)
      .select('id');

    if (seasonError) {
      console.error('Failed to delete season row', seasonError);
      throw seasonError;
    }

    if (!data || data.length === 0) {
      throw new Error(
        `Season ${seasonId} was not deleted. Check Supabase RLS delete policy on seasons.`
      );
    }

    this.seasons.update((current) =>
      current.filter((season) => season.id !== seasonId)
    );

    if (isDeletingActiveSeason) {
      this.activeSeason.set(null);
      localStorage.removeItem(this.activeSeasonKey(clientId));
    }

    await this.load();
  }

  private activeSeasonKey(clientId: string): string {
    return `${ACTIVE_SEASON_KEY}:${clientId}`;
  }

  private fromRow(row: any): Season {
    return {
      id: row.id,
      year: row.year,
      half: row.half,
      name: row.name,
      archived: row.archived
    };
  }

  private toRow(season: Season): any {
    return {
      id: season.id,
      year: season.year,
      half: season.half,
      name: season.name,
      archived: season.archived
    };
  }
}
