import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonCard, IonCardContent,
  IonIcon, IonButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, calendarOutline, gitNetworkOutline,
  logOutOutline, chevronBackOutline, chevronForwardOutline
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { PlayersService } from '../../core/services/players.service';
import { MatchesService } from '../../core/services/matches.service';
import { TeamsService } from '../../core/services/teams.service';
import { SeasonsService } from '../../core/services/season.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonContent, IonCard, IonCardContent,
    IonIcon, IonButton, IonButtons
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <div class="toolbar-logo" slot="start">
          <img src="assets/teamflow-logo-mobile.svg" class="logo-img" alt="TeamFlow" />
        </div>
        <ion-buttons slot="end">
          <ion-button (click)="logout()">
            <ion-icon name="log-out-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="dashboard-content">
      <!-- Season selector hero -->
      <div class="season-hero">
        <div class="season-label">Aktiv sesong</div>
        <div class="season-nav">
          <ion-button fill="clear" class="nav-btn" [disabled]="prevSeasonIndex() < 0" (click)="goToPrevSeason()">
            <ion-icon name="chevron-back-outline" />
          </ion-button>
          <div class="season-name-block">
            <span class="season-name">{{ seasonsService.activeSeason()?.name ?? 'Ingen sesong' }}</span>
            @if (seasonsService.activeSeason()?.archived) {
              <span class="archived-badge">Arkivert</span>
            }
          </div>
          <ion-button fill="clear" class="nav-btn" [disabled]="nextSeasonIndex() < 0" (click)="goToNextSeason()">
            <ion-icon name="chevron-forward-outline" />
          </ion-button>
        </div>
        @if (sortedSeasons().length > 1) {
          <div class="season-dots">
            @for (s of sortedSeasons(); track s.id) {
              <div class="season-dot" [class.active]="s.id === seasonsService.activeSeason()?.id"></div>
            }
          </div>
        }
      </div>

      <div class="stat-row">
        <div class="stat-card">
          <span class="stat-num">{{ playerCount() }}</span>
          <span class="stat-label">Spillere</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ matchCount() }}</span>
          <span class="stat-label">Kamper</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ teamCount() }}</span>
          <span class="stat-label">Lag</span>
        </div>
      </div>

      <div class="quick-actions">
        <ion-card class="action-card" (click)="nav('/tabs/players')">
          <ion-card-content>
            <ion-icon name="people-outline" class="action-icon players" />
            <h3>Spillere</h3>
            <p>Registrer nivå og kampmatrise</p>
          </ion-card-content>
        </ion-card>

        <ion-card class="action-card" (click)="nav('/tabs/matches')">
          <ion-card-content>
            <ion-icon name="calendar-outline" class="action-icon matches" />
            <h3>Kamper</h3>
            <p>Importer og organiser terminlister</p>
          </ion-card-content>
        </ion-card>

        <ion-card class="action-card" (click)="nav('/tabs/distribution')">
          <ion-card-content>
            <ion-icon name="git-network-outline" class="action-icon dist" />
            <h3>Fordeling</h3>
            <p>Generer og eksporter laguttak</p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .toolbar-logo { padding-left: 16px; display: flex; align-items: center; }
    .logo-img { height: 28px; width: auto; }
    .dashboard-content { --background: #0F172A; }

    .season-hero {
      padding: 24px 20px 20px;
      background: linear-gradient(160deg, #0F172A 0%, #162032 100%);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      border-bottom: 1px solid #1E293B;
    }
    .season-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1.5px; color: #475569;
    }
    .season-nav {
      display: flex; align-items: center; gap: 4px; width: 100%;
    }
    .nav-btn {
      --color: #64748B; --padding-start: 4px; --padding-end: 4px;
      flex-shrink: 0;
    }
    .nav-btn[disabled] { opacity: 0.2; }
    .season-name-block {
      flex: 1; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    }
    .season-name {
      font-size: 26px; font-weight: 800; color: #F8FAFC; letter-spacing: -0.5px;
    }
    .archived-badge {
      font-size: 11px; font-weight: 600; background: #F59E0B20;
      color: #F59E0B; border-radius: 6px; padding: 2px 8px;
    }
    .season-dots {
      display: flex; gap: 6px; align-items: center;
    }
    .season-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #334155; transition: all 0.2s;
    }
    .season-dot.active { background: #10B981; width: 18px; border-radius: 3px; }

    .stat-row {
      display: flex; gap: 12px;
      padding: 16px 20px;
    }
    .stat-card {
      flex: 1; background: #1E293B;
      border-radius: 14px; padding: 16px 12px;
      text-align: center;
    }
    .stat-num { display: block; font-size: 28px; font-weight: 800; color: #10B981; }
    .stat-label { font-size: 12px; color: #64748B; }

    .quick-actions { padding: 0 20px 32px; display: flex; flex-direction: column; gap: 12px; }
    .action-card {
      --background: #1E293B; --color: #F8FAFC;
      border-radius: 16px; margin: 0;
      cursor: pointer;
    }
    ion-card-content { display: flex; align-items: center; gap: 16px; padding: 16px !important; }
    .action-icon { font-size: 28px; }
    .action-icon.players { color: #3B82F6; }
    .action-icon.matches { color: #A855F7; }
    .action-icon.dist    { color: #10B981; }
    h3 { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
    p  { font-size: 13px; color: #64748B; margin: 0; }
  `]
})
export class DashboardPage {
  private auth    = inject(AuthService);
  private router  = inject(Router);
  readonly seasonsService = inject(SeasonsService);
  private players  = inject(PlayersService);
  private matches  = inject(MatchesService);
  private teams    = inject(TeamsService);
  private settings  = inject(SettingsService);

  playerCount = computed(() => this.players.players().length);
  matchCount  = computed(() => this.matches.matches().length);
  teamCount   = computed(() => this.teams.teams().length);

  // Oldest first for navigation
  sortedSeasons = computed(() => [...this.seasonsService.seasons()].reverse());

  private activeIndex = computed(() => {
    const id = this.seasonsService.activeSeason()?.id;
    return this.sortedSeasons().findIndex(s => s.id === id);
  });
  prevSeasonIndex = computed(() => this.activeIndex() - 1);
  nextSeasonIndex = computed(() => {
    const next = this.activeIndex() + 1;
    return next < this.sortedSeasons().length ? next : -1;
  });

  constructor() {
    addIcons({ peopleOutline, calendarOutline, gitNetworkOutline, logOutOutline, chevronBackOutline, chevronForwardOutline });
  }

  async switchSeason(idx: number) {
    if (idx < 0) return;
    this.seasonsService.setActiveSeason(this.sortedSeasons()[idx].id);
    await Promise.all([
      this.settings.load(),
      this.teams.load(),
      this.players.load(),
      this.matches.load(),
    ]);
  }

  goToPrevSeason() { this.switchSeason(this.prevSeasonIndex()); }
  goToNextSeason() { this.switchSeason(this.nextSeasonIndex()); }

  nav(path: string) { this.router.navigate([path]); }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
