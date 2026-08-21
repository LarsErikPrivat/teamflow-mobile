import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ClientService } from './client.service';
import { SeasonsService } from './season.service';

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

  async load(matchId: string): Promise<string[]> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('match_lineups')
      .select('player_ids')
      .eq('client_id', clientId)
      .eq('match_id', matchId)
      .maybeSingle();

    if (error) { console.error('Failed to load match lineup', error); return []; }
    return (data?.player_ids as string[]) ?? [];
  }

  async loadAll(): Promise<Map<string, string[]>> {
    const clientId = this.clientService.requireClientId();

    const { data, error } = await this.supabase.client
      .from('match_lineups')
      .select('match_id, player_ids')
      .eq('client_id', clientId);

    if (error) { console.error('Failed to load match lineups', error); return new Map(); }
    return new Map((data ?? []).map(row => [row.match_id as string, row.player_ids as string[]]));
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
