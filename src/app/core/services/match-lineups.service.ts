import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ClientService } from './client.service';
import { SeasonsService } from './season.service';

export interface MatchLineup {
  playerIds: string[];
  durationMinutes?: number;
}

@Injectable({ providedIn: 'root' })
export class MatchLineupsService {
  private readonly supabase = inject(SupabaseService);
  private readonly clientService = inject(ClientService);
  private readonly seasonsService = inject(SeasonsService);

  async save(matchId: string, playerIds: string[]): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;
    if (!seasonId) return;

    const { error } = await this.supabase.client
      .from('match_lineups')
      .upsert(
        { client_id: clientId, season_id: seasonId, match_id: matchId, player_ids: playerIds, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,match_id' }
      );

    if (error) console.error('Failed to save match lineup', error);
  }

  async saveDuration(matchId: string, durationMinutes: number): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;
    if (!seasonId) return;

    const { error } = await this.supabase.client
      .from('match_lineups')
      .upsert(
        { client_id: clientId, season_id: seasonId, match_id: matchId, duration_minutes: durationMinutes, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,match_id' }
      );

    if (error) console.error('Failed to save match duration', error);
  }

  async load(matchId: string): Promise<MatchLineup> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('match_lineups')
      .select('player_ids, duration_minutes')
      .eq('client_id', clientId)
      .eq('match_id', matchId)
      .maybeSingle();

    if (error) { console.error('Failed to load match lineup', error); return { playerIds: [] }; }
    return {
      playerIds: (data?.player_ids as string[]) ?? [],
      durationMinutes: data?.duration_minutes ?? undefined,
    };
  }

  async loadAll(): Promise<Map<string, MatchLineup>> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('match_lineups')
      .select('match_id, player_ids, duration_minutes')
      .eq('client_id', clientId);

    if (error) { console.error('Failed to load match lineups', error); return new Map(); }
    return new Map((data ?? []).map(row => [
      row.match_id as string,
      { playerIds: row.player_ids as string[], durationMinutes: row.duration_minutes ?? undefined },
    ]));
  }

  async remove(matchId: string): Promise<void> {
    const clientId = this.clientService.requireClientId();
    await this.supabase.client
      .from('match_lineups')
      .delete()
      .eq('client_id', clientId)
      .eq('match_id', matchId);
  }
}
