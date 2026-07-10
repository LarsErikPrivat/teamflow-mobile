import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon,
  IonSpinner, IonButton, IonRefresher, IonRefresherContent, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, footballOutline, timeOutline, locationOutline, lockClosedOutline, shirtOutline, closeOutline } from 'ionicons/icons';
import { DistributionSnapshotsService } from '../../core/services/distribution-snaphsot.service';
import { MatchEventsService } from '../../core/services/match-events.service';
import { TeamsService } from '../../core/services/teams.service';
import { SeasonsService } from '../../core/services/season.service';
import { MatchesService } from '../../core/services/matches.service';
import { DistributedMatch } from '../../core/models/distributed-match.model';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon,
    IonSpinner, IonButton, IonRefresher, IonRefresherContent, IonModal
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>I dag</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (loading()) {
        <div class="center-state">
          <ion-spinner name="crescent" />
          <span>Laster kamper...</span>
        </div>
      } @else if (todayMatches().length === 0) {
        <div class="center-state">
          <div class="empty-icon"><ion-icon name="calendar-outline" /></div>
          <h3>Ingen kamper i dag</h3>
          <p>{{ upcomingMatches().length > 0 ? 'Neste kamp er i morgen.' : 'Ingen kommende kamper funnet i fordelingen.' }}</p>
        </div>
      } @else {
        <div class="match-list">
          <div class="section-label">DAGENS KAMPER</div>

          @for (item of todayMatches(); track item.match.id) {
            @let team = getTeam(item.match.teamId);
            <div
              class="match-card"
              [class.match-now]="isNow(item.match)"
              [style.--team-color]="team?.color ?? '#10B981'"
              (click)="openMatch(item)"
            >
              @if (isNow(item.match)) {
                <div class="now-badge">LIVE</div>
              }
              <div class="match-card-header">
                <span class="match-time">{{ item.match.time }}</span>
                <span class="match-team-name" [style.color]="team?.color ?? '#10B981'">
                  {{ team?.name ?? '' }}
                </span>
                <span class="match-player-count">{{ item.players.length }} sp.</span>
              </div>
              <div class="match-vs">
                <span class="match-home">{{ item.match.homeTeam }}</span>
                <span class="match-score">
                  @if (hasGoals(item.match.id)) {
                    {{ homeGoals(item.match.id, item.match.homeTeam) }} – {{ awayGoals(item.match.id, item.match.homeTeam) }}
                  } @else {
                    vs
                  }
                </span>
                <span class="match-away">{{ item.match.awayTeam }}</span>
              </div>
              <div class="match-card-footer">
                <span class="match-level">Nivå {{ item.match.matchLevel }}</span>
                <button class="squad-btn" (click)="openSquad(item, $event)">
                  <ion-icon name="shirt-outline" />
                  <span>Tropp</span>
                </button>
              </div>
            </div>
          }

          @if (upcomingMatches().length > 0) {
            <div class="section-label" style="margin-top: 1.5rem">KOMMENDE</div>
            @for (item of upcomingMatches(); track item.match.id) {
              @let team = getTeam(item.match.teamId);
              <div class="match-card upcoming" [style.--team-color]="team?.color ?? '#10B981'" (click)="openMatch(item)">
                <div class="match-card-header">
                  <span class="match-time">{{ formatDate(item.match.date) }} {{ item.match.time }}</span>
                  <span class="match-team-name" [style.color]="team?.color ?? '#10B981'">{{ team?.name ?? '' }}</span>
                </div>
                <div class="match-vs">
                  <span class="match-home">{{ item.match.homeTeam }}</span>
                  <span class="match-score muted">vs</span>
                  <span class="match-away">{{ item.match.awayTeam }}</span>
                </div>
                <div class="match-card-footer">
                  <span class="match-level">Nivå {{ item.match.matchLevel }}</span>
                  <button class="squad-btn" (click)="openSquad(item, $event)">
                    <ion-icon name="shirt-outline" />
                    <span>Tropp</span>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }
    </ion-content>

    <!-- TROPP MODAL -->
    <ion-modal
      [isOpen]="squadModalOpen()"
      [breakpoints]="[0, 0.6, 0.9]"
      [initialBreakpoint]="0.6"
      (didDismiss)="squadModalOpen.set(false)"
    >
      @if (squadMatch()) {
        @let sTeam = getTeam(squadMatch()!.match.teamId);
        <div class="squad-sheet">
          <div class="squad-handle"></div>
          <div class="squad-header">
            <span class="squad-title" [style.color]="sTeam?.color ?? '#10B981'">{{ sTeam?.name ?? '' }}</span>
            <span class="squad-subtitle">{{ squadMatch()!.match.homeTeam }} – {{ squadMatch()!.match.awayTeam }}</span>
            <button class="squad-close" (click)="squadModalOpen.set(false)">
              <ion-icon name="close-outline" />
            </button>
          </div>
          <div class="squad-list">
            @for (player of squadMatch()!.players; track player.id) {
              <div class="squad-player">
                <div class="squad-avatar">
                  @if (player.number) {
                    <span class="squad-shirt">
                      <ion-icon name="shirt-outline" class="squad-shirt-icon" />
                      <span class="squad-shirt-num">{{ player.number }}</span>
                    </span>
                  } @else {
                    {{ player.name.charAt(0) }}
                  }
                </div>
                <span class="squad-name">{{ player.name }}</span>
              </div>
            }
          </div>
        </div>
      }
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .page-content { --background: #0F172A; }

    .center-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; height: 60vh;
      color: #64748B; text-align: center; padding: 24px;
    }
    .center-state h3 { margin: 0; color: #F8FAFC; font-size: 18px; }
    .center-state p { margin: 0; font-size: 14px; }
    .empty-icon { font-size: 48px; color: #334155; }

    .match-list { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .section-label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
      color: #475569; text-transform: uppercase; padding: 0 4px;
    }

    .match-card {
      background: #1E293B;
      border-radius: 16px;
      padding: 16px;
      border: 1.5px solid #334155;
      border-left: 4px solid var(--team-color);
      position: relative;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .match-card:active { transform: scale(0.98); }
    .match-card.match-now {
      border-color: var(--team-color);
      background: color-mix(in srgb, var(--team-color) 8%, #1E293B);
      box-shadow: 0 0 0 1px var(--team-color), 0 8px 24px rgba(0,0,0,0.3);
    }
    .match-card.upcoming { opacity: 0.7; }

    .now-badge {
      position: absolute; top: 12px; right: 12px;
      background: #EF4444; color: white;
      font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
      padding: 2px 8px; border-radius: 999px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .match-card-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .match-time { font-size: 13px; font-weight: 700; color: #94A3B8; }
    .match-team-name { font-size: 12px; font-weight: 800; margin-left: auto; }
    .match-player-count { font-size: 11px; color: #64748B; }

    .match-vs {
      display: grid; grid-template-columns: 1fr auto 1fr;
      align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .match-home { font-size: 15px; font-weight: 700; color: #F8FAFC; text-align: left; }
    .match-away { font-size: 15px; font-weight: 700; color: #F8FAFC; text-align: right; }
    .match-score {
      font-size: 18px; font-weight: 900; color: #F8FAFC; text-align: center;
      min-width: 40px;
    }
    .match-score.muted { color: #475569; font-size: 13px; }

    .match-card-footer {
      display: flex; align-items: center; justify-content: space-between;
    }
    .match-level {
      font-size: 11px; font-weight: 600; color: #64748B;
      background: #0F172A; padding: 2px 8px; border-radius: 999px;
    }
    .squad-btn {
      display: flex; align-items: center; gap: 4px;
      background: #0F172A; border: 1px solid #334155; border-radius: 999px;
      color: #94A3B8; font-size: 12px; font-weight: 600;
      padding: 4px 10px; cursor: pointer;
    }
    .squad-btn ion-icon { font-size: 14px; }
    .squad-btn:active { background: #1E293B; }

    .squad-sheet {
      padding: 12px 16px 32px; display: flex; flex-direction: column; gap: 0;
      background: #0F172A; height: 100%;
    }
    .squad-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: #334155; margin: 0 auto 16px;
    }
    .squad-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px; position: relative;
    }
    .squad-title { font-size: 14px; font-weight: 800; }
    .squad-subtitle { font-size: 13px; color: #64748B; flex: 1; }
    .squad-close {
      background: none; border: none; color: #475569; font-size: 22px;
      cursor: pointer; padding: 0; line-height: 1;
    }
    .squad-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
    .squad-player {
      display: flex; align-items: center; gap: 12px;
      background: #1E293B; border-radius: 10px; padding: 10px 14px;
    }
    .squad-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: #0F172A; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #64748B; flex-shrink: 0;
    }
    .squad-shirt { position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; }
    .squad-shirt-icon { font-size: 28px; color: #475569; }
    .squad-shirt-num { position: absolute; font-size: 10px; font-weight: 900; color: #F8FAFC; margin-top: 4px; }
    .squad-name { font-size: 14px; font-weight: 600; color: #F8FAFC; }
  `]
})
export class TodayPage implements OnInit {
  private readonly snapshotSvc = inject(DistributionSnapshotsService);
  private readonly teamsSvc = inject(TeamsService);
  readonly eventsService = inject(MatchEventsService);
  private readonly seasonsSvc = inject(SeasonsService);
  private readonly matchesSvc = inject(MatchesService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly allMatches = signal<DistributedMatch[]>([]);
  readonly squadModalOpen = signal(false);
  readonly squadMatch = signal<DistributedMatch | null>(null);

  readonly todayMatches = computed(() => {
    const today = this.todayStr();
    return this.allMatches()
      .filter(m => m.match.date === today)
      .sort((a, b) => a.match.time.localeCompare(b.match.time));
  });

  readonly upcomingMatches = computed(() => {
    const today = this.todayStr();
    return this.allMatches()
      .filter(m => m.match.date > today)
      .sort((a, b) => a.match.date.localeCompare(b.match.date) || a.match.time.localeCompare(b.match.time))
      .slice(0, 5);
  });

  constructor() {
    addIcons({ calendarOutline, footballOutline, timeOutline, locationOutline, lockClosedOutline, shirtOutline, closeOutline });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    const [matches] = await Promise.all([
      this.snapshotSvc.load(),
      this.teamsSvc.load(),
      this.eventsService.load(),
      this.matchesSvc.load(),
    ]);
    // Patch date/time from live matches table so changes take effect without re-running fordeling
    const liveMatches = this.matchesSvc.matches();
    const patched = matches.map(dm => {
      const live = liveMatches.find(m => m.id === dm.match.id);
      if (!live) return dm;
      return { ...dm, match: { ...dm.match, date: live.date, time: live.time } };
    });
    this.allMatches.set(patched);
    this.loading.set(false);
  }

  async refresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  getTeam(teamId: string) {
    return this.teamsSvc.teams().find(t => t.id === teamId);
  }

  isNow(match: { date: string; time: string }): boolean {
    const now = new Date();
    const matchDate = match.date === this.todayStr();
    if (!matchDate) return false;
    const [h, m] = match.time.split(':').map(Number);
    const matchStart = new Date();
    matchStart.setHours(h, m, 0, 0);
    const diff = (now.getTime() - matchStart.getTime()) / 60000;
    return diff >= -15 && diff <= 105;
  }

  hasGoals(matchId: string): boolean {
    return this.eventsService.eventsForMatch(matchId).some(e => e.eventType === 'goal');
  }

  homeGoals(matchId: string, homeTeam: string): number {
    return this.eventsService.eventsForMatch(matchId)
      .filter(e => e.eventType === 'goal' && e.note === 'home').length;
  }

  awayGoals(matchId: string, homeTeam: string): number {
    return this.eventsService.eventsForMatch(matchId)
      .filter(e => e.eventType === 'goal' && e.note === 'away').length;
  }

  openMatch(item: DistributedMatch) {
    this.router.navigate(['/match', item.match.id], { state: { item } });
  }

  openSquad(item: DistributedMatch, event: Event) {
    event.stopPropagation();
    this.squadMatch.set(item);
    this.squadModalOpen.set(true);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', weekday: 'short' });
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
