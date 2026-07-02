import { Injectable, inject, signal } from '@angular/core';

import { PlayerPosition } from '../models/player.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PositionsService {
  private readonly supabase = inject(SupabaseService);

  readonly positions = signal<PlayerPosition[]>([]);

  async load(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('player_positions')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    this.positions.set(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order
      }))
    );
  }

  async add(position: PlayerPosition): Promise<void> {
    const { error } = await this.supabase.client
      .from('player_positions')
      .insert({
        id: position.id,
        name: position.name,
        sort_order: position.sortOrder
      });

    if (error) throw error;

    await this.load();
  }

  async update(position: PlayerPosition): Promise<void> {
    const { error } = await this.supabase.client
      .from('player_positions')
      .update({
        name: position.name,
        sort_order: position.sortOrder
      })
      .eq('id', position.id);

    if (error) throw error;

    await this.load();
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('player_positions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await this.load();
  }
}
