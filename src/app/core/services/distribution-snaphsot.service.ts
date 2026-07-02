import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SeasonsService } from './season.service';
import { ClientService } from './client.service';
import { DistributedMatch } from '../models/distributed-match.model';

@Injectable({ providedIn: 'root' })
export class DistributionSnapshotsService {
  private readonly supabase = inject(SupabaseService);
  private readonly seasonsService = inject(SeasonsService);
  private readonly clientService = inject(ClientService);

  async load(): Promise<DistributedMatch[]> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('distribution_snapshots')
      .select('data')
      .eq('client_id', clientId)
      .eq('season_id', seasonId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load distribution snapshot', error);
      return [];
    }

    return Array.isArray(data?.data) ? data.data : [];
  }

  async save(distribution: DistributedMatch[]): Promise<void> {
    if (!this.seasonsService.ensureSeasonWritable()) {
      return;
    }

    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      return;
    }

    const { error } = await this.supabase.client
      .from('distribution_snapshots')
      .upsert(
        {
          client_id: clientId,
          season_id: seasonId,
          data: distribution,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'client_id,season_id'
        }
      );

    if (error) {
      console.error('Failed to save distribution snapshot', error);
    }
  }

  async clear(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;

    if (!seasonId) {
      return;
    }

    await this.supabase.client
      .from('distribution_snapshots')
      .delete()
      .eq('client_id', clientId)
      .eq('season_id', seasonId);
  }
}
