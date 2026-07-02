import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent,
  IonIcon, IonButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, calendarOutline, gitNetworkOutline,
  logOutOutline, sparklesOutline
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { PlayersService } from '../../core/services/players.service';
import { MatchesService } from '../../core/services/matches.service';
import { TeamsService } from '../../core/services/teams.service';
import { SeasonsService } from '../../core/services/season.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent,
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
      <div class="hero">
        <img src="assets/teamflow-logo-mobile.svg" class="hero-logo" alt="TeamFlow" />
        <p class="hero-season">{{ seasonsService.activeSeason()?.name ?? 'Ingen aktiv sesong' }}</p>
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

    .hero {
      padding: 32px 20px 24px;
      background: linear-gradient(160deg, #0F172A 0%, #1E293B 100%);
      display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
    }
    .hero-logo { height: 48px; width: auto; }
    .hero-season { color: #64748B; font-size: 14px; margin: 0; }

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
  private auth   = inject(AuthService);
  private router = inject(Router);
  readonly seasonsService = inject(SeasonsService);
  private players = inject(PlayersService);
  private matches = inject(MatchesService);
  private teams   = inject(TeamsService);

  playerCount = computed(() => this.players.players().length);
  matchCount  = computed(() => this.matches.matches().length);
  teamCount   = computed(() => this.teams.teams().length);

  constructor() {
    addIcons({ peopleOutline, calendarOutline, gitNetworkOutline, logOutOutline, sparklesOutline });
  }

  nav(path: string) { this.router.navigate([path]); }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
