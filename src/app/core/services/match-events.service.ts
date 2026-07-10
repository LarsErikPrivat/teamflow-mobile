import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ClientService } from './client.service';
import { SeasonsService } from './season.service';
import { MatchEvent, MatchEventType } from '../models/match-event.model';

@Injectable({ providedIn: 'root' })
export class MatchEventsService {
  private readonly supabase = inject(SupabaseService);
  private readonly clientService = inject(ClientService);
  private readonly seasonsService = inject(SeasonsService);

  readonly events = signal<MatchEvent[]>([]);

  async load(): Promise<void> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;
    if (!seasonId) return;

    const { data, error } = await this.supabase.client
      .from('match_events')
      .select('*')
      .eq('client_id', clientId)
      .eq('season_id', seasonId)
      .order('created_at', { ascending: true });

    if (error) { console.error('Failed to load match events', error); return; }

    this.events.set((data ?? []).map(this.fromRow));
  }

  addOptimistic(matchId: string, eventType: MatchEventType, opts: {
    playerId?: string; playerName?: string; minute?: number; note?: string;
  } = {}): void {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id ?? '';
    const tempEvent: MatchEvent = {
      id: 'temp-' + Date.now(),
      clientId, seasonId, matchId, eventType,
      playerId: opts.playerId,
      playerName: opts.playerName,
      minute: opts.minute,
      note: opts.note,
      createdAt: new Date().toISOString(),
    };
    this.events.update(evts => [...evts, tempEvent]);
    this.add(matchId, eventType, opts).then(saved => {
      if (saved) {
        this.events.update(evts => evts.map(e => e.id === tempEvent.id ? saved : e));
      }
    });
  }

  async add(matchId: string, eventType: MatchEventType, opts: {
    playerId?: string;
    playerName?: string;
    minute?: number;
    note?: string;
  } = {}): Promise<MatchEvent | null> {
    const clientId = this.clientService.requireClientId();
    const seasonId = this.seasonsService.activeSeason()?.id;
    if (!seasonId) return null;

    const row = {
      client_id: clientId,
      season_id: seasonId,
      match_id: matchId,
      event_type: eventType,
      player_id: opts.playerId ?? null,
      player_name: opts.playerName ?? null,
      minute: opts.minute ?? null,
      note: opts.note ?? null,
    };

    const { data, error } = await this.supabase.client
      .from('match_events')
      .insert(row)
      .select()
      .single();

    if (error) { console.error('Failed to add match event', error); return null; }

    return this.fromRow(data);
  }

  async remove(eventId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('match_events')
      .delete()
      .eq('id', eventId);

    if (error) { console.error('Failed to remove match event', error); return; }
    this.events.update(evts => evts.filter(e => e.id !== eventId));
  }

  eventsForMatch(matchId: string): MatchEvent[] {
    return this.events().filter(e => e.matchId === matchId);
  }

  private fromRow(row: any): MatchEvent {
    return {
      id: row.id,
      clientId: row.client_id,
      seasonId: row.season_id,
      matchId: row.match_id,
      eventType: row.event_type,
      playerId: row.player_id,
      playerName: row.player_name,
      minute: row.minute,
      note: row.note,
      createdAt: row.created_at,
    };
  }
}
