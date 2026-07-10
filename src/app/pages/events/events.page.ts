import { Component, inject, signal, computed, OnInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { MatchEventsService } from '../../core/services/match-events.service';
import { DistributionSnapshotsService } from '../../core/services/distribution-snaphsot.service';
import { SeasonsService } from '../../core/services/season.service';
import { TeamsService } from '../../core/services/teams.service';
import { MatchEvent } from '../../core/models/match-event.model';
import { DistributedMatch } from '../../core/models/distributed-match.model';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Hendelser</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-body">
        @if (groupedEvents().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Ingen hendelser ennå</h3>
            <p>Hendelser du registrerer under kamp vil vises her for etterregistering i NFF.</p>
          </div>
        } @else {
          @for (group of groupedEvents(); track group.matchId) {
            <div class="match-group">
              <div class="match-group-header">
                <span class="match-title">{{ group.matchTitle }}</span>
                <span class="match-date">{{ group.matchDate }}</span>
              </div>
              <div class="event-list">
                @for (event of group.events; track event.id) {
                  <div class="event-row">
                    <span class="event-icon">{{ eventIcon(event) }}</span>
                    <div class="event-body">
                      <span class="event-type">{{ eventLabel(event) }}</span>
                      @if (event.eventType === 'emergency_replacement' || event.eventType === 'substitution') {
                        <span class="event-player">{{ event.note }}</span>
                      } @else if (event.playerName) {
                        <span class="event-player">{{ event.playerName }}</span>
                      }
                    </div>
                    @if (event.minute) {
                      <span class="event-minute">{{ event.minute }}'</span>
                    }
                    <span class="event-time">{{ formatTime(event.createdAt) }}</span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .page-content { --background: #0F172A; }

    .page-body { padding: 16px; display: flex; flex-direction: column; gap: 20px; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; height: 60vh;
      color: #64748B; text-align: center; padding: 24px;
    }
    .empty-icon { font-size: 48px; }
    .empty-state h3 { margin: 0; color: #F8FAFC; font-size: 18px; }
    .empty-state p { margin: 0; font-size: 14px; line-height: 1.6; }

    .match-group { display: flex; flex-direction: column; gap: 8px; }

    .match-group-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 4px;
    }
    .match-title { font-size: 13px; font-weight: 800; color: #F8FAFC; }
    .match-date { font-size: 11px; color: #64748B; }

    .event-list { display: flex; flex-direction: column; gap: 6px; }

    .event-row {
      display: flex; align-items: center; gap: 10px;
      background: #1E293B; border-radius: 12px; padding: 12px 14px;
      border: 1px solid #334155;
    }
    .event-icon { font-size: 20px; flex-shrink: 0; }
    .event-body { flex: 1; min-width: 0; }
    .event-type { display: block; font-size: 13px; font-weight: 700; color: #F8FAFC; }
    .event-player { display: block; font-size: 12px; color: #94A3B8; }
    .event-note { display: block; font-size: 11px; color: #64748B; margin-top: 2px; }
    .event-minute { font-size: 14px; font-weight: 800; color: #10B981; flex-shrink: 0; }
    .event-time { font-size: 11px; color: #475569; flex-shrink: 0; }
  `]
})
export class EventsPage implements OnInit {
  private readonly eventsService = inject(MatchEventsService);
  private readonly snapshotSvc = inject(DistributionSnapshotsService);
  private readonly seasonsSvc = inject(SeasonsService);

  readonly allMatches = signal<DistributedMatch[]>([]);

  readonly groupedEvents = computed(() => {
    const events = this.eventsService.events();
    const matches = this.allMatches();

    const byMatch = new Map<string, MatchEvent[]>();
    for (const e of events) {
      const arr = byMatch.get(e.matchId) ?? [];
      arr.push(e);
      byMatch.set(e.matchId, arr);
    }

    return [...byMatch.entries()].map(([matchId, evts]) => {
      const m = matches.find(x => x.match.id === matchId);
      return {
        matchId,
        matchTitle: m ? `${m.match.homeTeam} – ${m.match.awayTeam}` : matchId,
        matchDate: m ? `${m.match.date} ${m.match.time}` : '',
        events: evts.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)),
      };
    }).sort((a, b) => b.matchDate.localeCompare(a.matchDate));
  });

  async ngOnInit() {
    const matches = await this.snapshotSvc.load();
    this.allMatches.set(matches);
    // Load from Supabase only if signal is empty (first launch, not coming from match-detail)
    if (this.eventsService.events().length === 0) {
      await this.seasonsSvc.load();
      await this.eventsService.load();
    }
  }

  async refresh(event: any) {
    await this.seasonsSvc.load();
    const [matches] = await Promise.all([
      this.snapshotSvc.load(),
      this.eventsService.load(),
    ]);
    this.allMatches.set(matches);
    event.target.complete();
  }

  eventIcon(event: MatchEvent): string {
    switch (event.eventType) {
      case 'goal': return '⚽';
      case 'yellow_card': return '🟨';
      case 'red_card': return '🟥';
      case 'substitution': return '🔄';
      case 'emergency_replacement': return '⚠️';
      default: return '•';
    }
  }

  eventLabel(event: MatchEvent): string {
    switch (event.eventType) {
      case 'goal': return event.note === 'home' ? 'Mål hjem' : 'Mål borte';
      case 'yellow_card': return 'Gult kort';
      case 'red_card': return 'Rødt kort';
      case 'substitution': return 'Innbytte';
      case 'emergency_replacement': return 'Forfall';
      default: return event.eventType;
    }
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  }
}
