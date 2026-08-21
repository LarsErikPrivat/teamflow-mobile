import { Component, inject, signal, computed, OnInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shirtOutline, swapHorizontalOutline } from 'ionicons/icons';
import { MatchEventsService } from '../../core/services/match-events.service';
import { DistributionSnapshotsService } from '../../core/services/distribution-snaphsot.service';
import { SeasonsService } from '../../core/services/season.service';
import { TeamsService } from '../../core/services/teams.service';
import { PlayersService } from '../../core/services/players.service';
import { MatchEvent } from '../../core/models/match-event.model';
import { DistributedMatch } from '../../core/models/distributed-match.model';
import { Player } from '../../core/models/player.model';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRefresher, IonRefresherContent, IonIcon
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
                    @if (event.eventType === 'substitution') {
                      @let outId = subOutPlayerIdFromNote(event.note);
                      <ion-icon name="swap-horizontal-outline" class="event-swap-icon" />
                      <span class="sub-shirt">
                        <ion-icon name="shirt-outline" class="shirt-icon" />
                        <span class="shirt-num">{{ playerNumber(event.playerId) ?? '-' }}</span>
                      </span>
                      <span class="sub-name in">{{ playerShortName(event.playerName) }}</span>
                      <span class="sub-arrow">›</span>
                      <span class="sub-shirt out">
                        <ion-icon name="shirt-outline" class="shirt-icon" />
                        <span class="shirt-num">{{ playerNumber(outId) ?? '-' }}</span>
                      </span>
                      <span class="sub-name out">{{ playerShortName(outPlayerName(outId)) }}</span>
                    } @else {
                      <span class="event-icon">{{ eventIcon(event) }}</span>
                      <span class="event-shirt">
                        <ion-icon name="shirt-outline" class="shirt-icon" />
                        <span class="shirt-num">{{ playerNumber(event.playerId) ?? '-' }}</span>
                      </span>
                      <div class="event-body">
                        <span class="event-type">{{ event.eventType === 'goal' ? (event.note === 'home' ? 'Mål · ' + group.homeTeam : 'Mål · ' + group.awayTeam) : eventLabel(event) }}</span>
                        @if (event.playerName) {
                          <span class="event-player">{{ event.playerName }}</span>
                        }
                      </div>
                    }
                    @if (event.minute) {
                      <span class="event-minute">{{ event.minute }}'</span>
                    }
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

    .event-list { display: flex; flex-direction: column; gap: 3px; }

    .event-row {
      display: flex; align-items: center; gap: 8px;
      background: #1E293B; border-radius: 8px; padding: 6px 10px;
    }
    .event-icon { font-size: 15px; flex-shrink: 0; line-height: 1; width: 20px; text-align: center; }
    .event-shirt { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 26px; height: 26px; }
    .event-shirt .shirt-icon { font-size: 26px; color: #475569; }
    .event-shirt .shirt-num { position: absolute; font-size: 8px; font-weight: 900; color: #F8FAFC; margin-top: 4px; }
    .event-body { flex: 1; display: flex; align-items: baseline; gap: 5px; overflow: hidden; }
    .event-type { font-size: 12px; font-weight: 700; color: #F8FAFC; white-space: nowrap; }
    .event-player { font-size: 11px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .event-minute { font-size: 11px; font-weight: 800; color: #10B981; flex-shrink: 0; margin-left: auto; }

    .event-swap-icon { font-size: 15px; color: #10B981; flex-shrink: 0; width: 20px; text-align: center; }
    .sub-shirt { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 22px; height: 22px; }
    .sub-shirt .shirt-icon { font-size: 22px; color: #10B981; }
    .sub-shirt .shirt-num { position: absolute; font-size: 7px; font-weight: 900; color: #F8FAFC; margin-top: 3px; }
    .sub-shirt.out .shirt-icon { color: #475569; }
    .sub-shirt.out .shirt-num { color: #94A3B8; }
    .sub-name { font-size: 11px; font-weight: 700; color: #F8FAFC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
    .sub-name.out { color: #64748B; margin-right: auto; }
    .sub-arrow { font-size: 13px; color: #475569; flex-shrink: 0; }
  `]
})
export class EventsPage implements OnInit {
  private readonly eventsService = inject(MatchEventsService);
  private readonly snapshotSvc = inject(DistributionSnapshotsService);
  private readonly seasonsSvc = inject(SeasonsService);
  private readonly playersSvc = inject(PlayersService);

  private allClientPlayers = signal<Player[]>([]);

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
        homeTeam: m?.match.homeTeam ?? 'Hjemme',
        awayTeam: m?.match.awayTeam ?? 'Borte',
        events: evts.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)),
      };
    }).sort((a, b) => b.matchDate.localeCompare(a.matchDate));
  });

  constructor() { addIcons({ shirtOutline, swapHorizontalOutline }); }

  playerNumber(playerId: string | undefined): number | undefined {
    if (!playerId) return undefined;
    return this.allClientPlayers().find(p => p.id === playerId)?.number;
  }

  subOutPlayerIdFromNote(note: string | undefined): string | undefined {
    if (!note) return undefined;
    return note.match(/^outId:([^|]+)/)?.[1];
  }

  outPlayerName(outId: string | undefined): string | undefined {
    if (!outId) return undefined;
    return this.allClientPlayers().find(p => p.id === outId)?.name;
  }

  playerShortName(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts.slice(1).map(p => p[0].toUpperCase()).join('')}`;
  }

  async ngOnInit() {
    const matches = await this.snapshotSvc.load();
    this.allMatches.set(matches);
    if (this.eventsService.events().length === 0) {
      await this.seasonsSvc.load();
      await this.eventsService.load();
    }
    this.allClientPlayers.set(await this.playersSvc.loadAllForClient());
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
      case 'goal': return event.note === 'home' ? 'Mål hjemme' : 'Mål borte';
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
