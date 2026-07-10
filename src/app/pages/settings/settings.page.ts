import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonButton, IonButtons,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, personCircleOutline, informationCircleOutline, calendarOutline, chevronDownOutline, checkmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SeasonsService } from '../../core/services/season.service';
import { SettingsService } from '../../core/services/settings.service';
import { TeamsService } from '../../core/services/teams.service';
import { PlayersService } from '../../core/services/players.service';
import { MatchesService } from '../../core/services/matches.service';
import { ClientService } from '../../core/services/client.service';
import { MatchOverridesService } from '../../core/services/match-overrides.service';
import { PositionsService } from '../../core/services/positions.service';
import { APP_VERSION } from '../../../environments/environments/version';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonButton, IonButtons,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Profil</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="logout()">
            <ion-icon name="log-out-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="page-body">

        <!-- Sesong -->
        <div class="section-label">Sesong</div>
        <div class="season-list">
          @for (s of seasons.seasons(); track s.id) {
            <button
              class="season-row"
              [class.active]="s.id === seasons.activeSeason()?.id"
              [class.archived]="s.archived"
              (click)="selectSeason(s.id)"
            >
              <span class="season-name">{{ s.name }}</span>
              @if (s.archived) {
                <span class="season-badge archived">Arkivert</span>
              } @else if (s.id === seasons.activeSeason()?.id) {
                <ion-icon name="checkmark-outline" class="season-check" />
              }
            </button>
          }
        </div>

        <!-- Super admin: klientvelger -->
        @if (clientSvc.isSuperAdmin()) {
          <div class="section-label">Klient</div>
          <div class="season-list">
            @for (c of clientSvc.clients(); track c.id) {
              <button
                class="season-row"
                [class.active]="c.id === clientSvc.clientId()"
                (click)="selectClient(c.id)"
              >
                <span class="season-name">{{ c.name }}</span>
                @if (c.id === clientSvc.clientId()) {
                  <ion-icon name="checkmark-outline" class="season-check" />
                }
              </button>
            }
          </div>
        }

        <!-- Konto -->
        <div class="section-label">Konto</div>
        <ion-list class="card-list">
          <ion-item class="card-item" lines="none">
            <ion-icon name="person-circle-outline" slot="start" class="item-icon" />
            <ion-label>
              <h2>Innlogget som</h2>
              <ion-note>{{ auth.user()?.email ?? '—' }}</ion-note>
            </ion-label>
          </ion-item>
          <ion-item class="card-item" lines="none">
            <ion-icon name="information-circle-outline" slot="start" class="item-icon" />
            <ion-label>
              <h2>Versjon</h2>
              <ion-note>v{{ appVersion }}</ion-note>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-button expand="block" fill="outline" color="danger" class="logout-btn" (click)="logout()">
          <ion-icon name="log-out-outline" slot="start" />
          Logg ut
        </ion-button>

      </div>
    </ion-content>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .page-content { --background: #0F172A; }
    .page-body { padding: 20px 16px 40px; display: flex; flex-direction: column; gap: 8px; }

    .section-label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
      color: #475569; text-transform: uppercase; padding: 12px 4px 6px;
    }

    .season-list { display: flex; flex-direction: column; gap: 4px; }
    .season-row {
      display: flex; align-items: center; gap: 12px;
      background: #1E293B; border: 1.5px solid #334155; border-radius: 12px;
      padding: 14px 16px; cursor: pointer; width: 100%; text-align: left;
      transition: background 0.1s;
    }
    .season-row:active { background: #263548; }
    .season-row.active { border-color: #10B981; background: color-mix(in srgb, #10B981 8%, #1E293B); }
    .season-row.archived { opacity: 0.5; }
    .season-name { flex: 1; font-size: 15px; font-weight: 600; color: #F8FAFC; }
    .season-badge { font-size: 11px; font-weight: 700; color: #F59E0B; background: #F59E0B18; padding: 2px 8px; border-radius: 999px; }
    .season-check { font-size: 18px; color: #10B981; }

    .card-list { background: #1E293B; border-radius: 14px; margin: 0; overflow: hidden; }
    .card-item {
      --background: transparent; --color: #F8FAFC; --border-color: #334155;
      --padding-start: 16px; --inner-padding-end: 16px;
    }
    .card-item + .card-item { border-top: 1px solid #334155; }
    h2 { font-size: 14px; font-weight: 500; color: #F8FAFC; }
    ion-note { color: #64748B; font-size: 12px; }
    .item-icon { color: #10B981; font-size: 22px; }

    .logout-btn { margin-top: 24px; --border-radius: 12px; }
  `]
})
export class SettingsPage {
  readonly appVersion = APP_VERSION;
  readonly auth       = inject(AuthService);
  readonly seasons    = inject(SeasonsService);
  readonly clientSvc  = inject(ClientService);
  private settingsSvc = inject(SettingsService);
  private teamsSvc    = inject(TeamsService);
  private playersSvc  = inject(PlayersService);
  private matchesSvc  = inject(MatchesService);
  private positionsSvc = inject(PositionsService);
  private overridesSvc = inject(MatchOverridesService);
  private router      = inject(Router);
  private alert       = inject(AlertController);
  private toast       = inject(ToastController);

  constructor() {
    addIcons({ logOutOutline, personCircleOutline, informationCircleOutline, calendarOutline, chevronDownOutline, checkmarkOutline });
  }

  async selectSeason(id: string) {
    if (id === this.seasons.activeSeason()?.id) return;
    this.seasons.setActiveSeason(id);
    await Promise.all([
      this.settingsSvc.load(),
      this.teamsSvc.load(),
      this.playersSvc.load(),
      this.matchesSvc.load(),
    ]);
    const t = await this.toast.create({ message: 'Sesong byttet', duration: 1500, color: 'success', position: 'top' });
    await t.present();
  }

  async selectClient(clientId: string) {
    if (clientId === this.clientSvc.clientId()) return;
    const client = this.clientSvc.clients().find(c => c.id === clientId);
    if (!client) return;
    await this.clientSvc.setActiveClient(client);
    await this.seasons.load();
    await Promise.all([
      this.settingsSvc.load(),
      this.teamsSvc.load(),
      this.playersSvc.load(),
      this.matchesSvc.load(),
      this.positionsSvc.load(),
      this.overridesSvc.load(),
    ]);
    const t = await this.toast.create({ message: `Byttet til ${client.name}`, duration: 2000, color: 'success', position: 'top' });
    await t.present();
  }

  async logout() {
    const a = await this.alert.create({
      cssClass: 'dark-alert',
      header: 'Logg ut',
      message: 'Er du sikker?',
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Logg ut', role: 'destructive', handler: async () => {
          await this.auth.logout();
          this.router.navigate(['/login']);
        }}
      ]
    });
    await a.present();
  }
}
