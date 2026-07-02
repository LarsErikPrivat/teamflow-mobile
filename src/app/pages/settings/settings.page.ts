import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonToggle, IonIcon, IonButton, IonNote,
  IonButtons, IonModal, IonInput,
  IonSelect, IonSelectOption, IonAccordionGroup, IonAccordion,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, calendarOutline, personCircleOutline, addOutline, pencilOutline, trashOutline, checkmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { SeasonsService } from '../../core/services/season.service';
import { SettingsService } from '../../core/services/settings.service';
import { TeamsService } from '../../core/services/teams.service';
import { PlayersService } from '../../core/services/players.service';
import { MatchesService } from '../../core/services/matches.service';
import { PositionsService } from '../../core/services/positions.service';
import { AppSettings } from '../../core/models/settings.model';
import { PlayerPosition } from '../../core/models/player.model';
import { Season, SeasonHalf } from '../../core/models/season.model';

type Section = 'seasons' | 'general' | 'rules' | 'matrix' | 'positions';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonToggle, IonIcon, IonButton, IonNote,
    IonButtons, IonModal, IonInput,
    IonSelect, IonSelectOption, IonAccordionGroup, IonAccordion
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Innstillinger</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="logout()">
            <ion-icon name="log-out-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Season selector -->
      <ion-toolbar>
        <ion-select
          class="season-select"
          [value]="seasons.activeSeason()?.id"
          (ionChange)="selectSeason($event)"
          interface="action-sheet"
          placeholder="Velg sesong"
        >
          @for (s of seasons.seasons(); track s.id) {
            <ion-select-option [value]="s.id">{{ s.name }}{{ s.archived ? ' (arkivert)' : '' }}</ion-select-option>
          }
        </ion-select>
        <ion-buttons slot="end">
          <ion-button (click)="openNewSeason()">
            <ion-icon name="add-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Section tabs -->
      <ion-toolbar>
        <div class="section-tabs">
          @for (tab of sectionTabs; track tab.value) {
            <button class="section-tab" [class.active]="activeSection() === tab.value" (click)="activeSection.set(tab.value)">
              {{ tab.label }}
            </button>
          }
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">

      <!-- SESONGER -->
      @if (activeSection() === 'seasons') {
        <ion-list class="settings-list">
          @for (s of seasons.seasons(); track s.id) {
            <ion-item class="settings-item" lines="none">
              <div class="season-dot" [class.active]="!s.archived" slot="start"></div>
              <ion-label>
                <h2>{{ s.name }}</h2>
                <ion-note>{{ s.archived ? 'Arkivert' : 'Aktiv' }}</ion-note>
              </ion-label>
              <ion-buttons slot="end">
                <ion-button fill="outline" size="small" [color]="s.archived ? 'warning' : 'medium'" (click)="toggleSeason(s)">
                  {{ s.archived ? 'Aktiver' : 'Arkiver' }}
                </ion-button>
                <ion-button fill="clear" size="small" (click)="deleteSeason(s)">
                  <ion-icon name="trash-outline" slot="icon-only" class="icon-danger" />
                </ion-button>
              </ion-buttons>
            </ion-item>
          } @empty {
            <ion-item lines="none"><ion-label><ion-note>Ingen sesonger</ion-note></ion-label></ion-item>
          }
        </ion-list>
      }

      <!-- GENERELT -->
      @if (activeSection() === 'general') {
        <div class="save-bar">
          <ion-button expand="block" color="success" (click)="saveSettings()" [disabled]="!hasChanges()">
            Lagre endringer
          </ion-button>
        </div>
        <ion-list class="settings-list">
          <ion-item class="settings-item" lines="none">
            <ion-label>Antall nivåer</ion-label>
            <ion-select slot="end" [(ngModel)]="draft().numberOfLevels" (ngModelChange)="onDraftChange('numberOfLevels', $event)" interface="action-sheet">
              <ion-select-option [value]="1">1</ion-select-option>
              <ion-select-option [value]="2">2</ion-select-option>
              <ion-select-option [value]="3">3</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Ukentlig maks kamper</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().weeklyMaxMatchesPerPlayer" (ngModelChange)="onDraftChange('weeklyMaxMatchesPerPlayer', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Minimum kampmål per uke</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().weeklyMinimumMatchTarget" (ngModelChange)="onDraftChange('weeklyMinimumMatchTarget', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Maks uker uten kamp</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().maxConsecutiveWeeksWithoutMatch" (ngModelChange)="onDraftChange('maxConsecutiveWeeksWithoutMatch', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Min. dager mellom kamper</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().minimumDaysBetweenMatches" (ngModelChange)="onDraftChange('minimumDaysBetweenMatches', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Minimum spillere per kamp</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().ownMatchMinimumPlayers" (ngModelChange)="onDraftChange('ownMatchMinimumPlayers', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Nivå 3 maks kamper (streng)</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().level3StrictMaxMatches" (ngModelChange)="onDraftChange('level3StrictMaxMatches', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Nivå 3 maks kamper (fallback)</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().level3FallbackMaxMatches" (ngModelChange)="onDraftChange('level3FallbackMaxMatches', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Ekstra ukentlig fallback</ion-label>
            <ion-input slot="end" type="number" [(ngModel)]="draft().fallbackExtraWeeklyAllowance" (ngModelChange)="onDraftChange('fallbackExtraWeeklyAllowance', $event)" class="number-input" />
          </ion-item>
          <ion-item class="settings-item" lines="none">
            <ion-label>Topp-opp kan bruke alle egne nivåer</ion-label>
            <ion-toggle slot="end" [(ngModel)]="draft().ownTopUpCanUseAnyOwnLevel" (ngModelChange)="onDraftChange('ownTopUpCanUseAnyOwnLevel', $event)" color="success" />
          </ion-item>
        </ion-list>
      }

      <!-- KAMPREGLER (spillere per lag/posisjon) -->
      @if (activeSection() === 'rules') {
        <div class="save-bar">
          <ion-button expand="block" color="success" (click)="saveSettings()" [disabled]="!hasChanges()">
            Lagre endringer
          </ion-button>
        </div>
        <ion-accordion-group class="rules-accordions">
          @for (rule of teamRulesView(); track rule.teamId) {
            <ion-accordion [value]="rule.teamId">
              <ion-item slot="header" class="rule-header" lines="none">
                <ion-label>
                  <h2>{{ rule.teamName }}</h2>
                  <ion-note>{{ rule.isHospiteringTeam ? 'Hospitering' : 'Eget lag' }} · {{ rule.requiredPlayerCount }} spillere</ion-note>
                </ion-label>
              </ion-item>
              <div slot="content" class="rule-content">
                <ion-item class="rule-item" lines="none">
                  <ion-label>Antall spillere totalt</ion-label>
                  <ion-input slot="end" type="number" [ngModel]="rule.requiredPlayerCount" (ngModelChange)="updateTeamRule(rule.teamId, $event)" class="number-input" />
                </ion-item>
                @for (pos of positions.positions(); track pos.id) {
                  <ion-item class="rule-item" lines="none">
                    <ion-label>{{ pos.name }}</ion-label>
                    <ion-input slot="end" type="number" [ngModel]="getPosRule(rule.positionRules, pos.id)" (ngModelChange)="updatePosRule(rule.teamId, pos.id, $event)" class="number-input" />
                  </ion-item>
                }
              </div>
            </ion-accordion>
          }
        </ion-accordion-group>
      }

      <!-- KAMPMATRISE -->
      @if (activeSection() === 'matrix') {
        <div class="save-bar">
          <ion-button expand="block" color="success" (click)="saveSettings()" [disabled]="!hasChanges()">
            Lagre endringer
          </ion-button>
        </div>
        @for (level of matrixLevels(); track level) {
          <div class="section-label">Nivå {{ level }}</div>
          <ion-list class="settings-list">
            <ion-item class="settings-item" lines="none">
              <ion-label>E{{ level }} (egne)</ion-label>
              <ion-input slot="end" type="number" [ngModel]="getMatrixVal(level, 'own')" (ngModelChange)="setMatrixVal(level, 'own', $event)" class="number-input" />
            </ion-item>
            @if (draft().numberOfLevels >= 2) {
              <ion-item class="settings-item" lines="none">
                <ion-label>H{{ level }} (hospitering)</ion-label>
                <ion-input slot="end" type="number" [ngModel]="getMatrixHospVal(level)" (ngModelChange)="setMatrixHospVal(level, $event)" class="number-input" />
              </ion-item>
            }
          </ion-list>
        }
      }

      <!-- POSISJONER -->
      @if (activeSection() === 'positions') {
        <div class="save-bar">
          <ion-button expand="block" (click)="openNewPosition()">
            <ion-icon name="add-outline" slot="start" />
            Legg til posisjon
          </ion-button>
        </div>
        <ion-list class="settings-list">
          @for (pos of positions.positions(); track pos.id) {
            <ion-item class="settings-item" lines="none">
              <ion-label>
                <h2>{{ pos.name }}</h2>
                <ion-note>ID: {{ pos.id }} · Rekkefølge: {{ pos.sortOrder }}</ion-note>
              </ion-label>
              <ion-buttons slot="end">
                <ion-button fill="clear" size="small" (click)="editPosition(pos)">
                  <ion-icon name="pencil-outline" slot="icon-only" class="action-icon" />
                </ion-button>
                <ion-button fill="clear" size="small" (click)="deletePosition(pos.id)">
                  <ion-icon name="trash-outline" slot="icon-only" class="icon-danger" />
                </ion-button>
              </ion-buttons>
            </ion-item>
          } @empty {
            <ion-item lines="none"><ion-label><ion-note>Ingen posisjoner definert</ion-note></ion-label></ion-item>
          }
        </ion-list>
      }

      <!-- Konto -->
      <div class="section-label" style="margin-top:24px">Konto</div>
      <ion-list class="settings-list">
        <ion-item class="settings-item" lines="none">
          <ion-icon name="person-circle-outline" slot="start" class="item-icon" />
          <ion-label>
            <h2>Innlogget som</h2>
            <ion-note>{{ auth.user()?.email ?? '—' }}</ion-note>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <!-- New Season Modal -->
    <ion-modal [isOpen]="newSeasonModal()" (didDismiss)="newSeasonModal.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Ny sesong</ion-title>
            <ion-buttons slot="start"><ion-button (click)="newSeasonModal.set(false)">Avbryt</ion-button></ion-buttons>
            <ion-buttons slot="end"><ion-button (click)="createSeason()" [strong]="true"><ion-icon name="checkmark-outline" slot="icon-only" /></ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="form-section">
            <div class="field-label">År</div>
            <ion-input class="form-input" type="number" [(ngModel)]="newYear" fill="outline" />
          </div>
          <div class="form-section">
            <div class="field-label">Halvår</div>
            <ion-select class="form-select" [(ngModel)]="newHalf" fill="outline" interface="action-sheet">
              <ion-select-option value="SPRING">Vår</ion-select-option>
              <ion-select-option value="AUTUMN">Høst</ion-select-option>
            </ion-select>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- Position Modal -->
    <ion-modal [isOpen]="posModal()" (didDismiss)="posModal.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ posEditMode() ? 'Rediger posisjon' : 'Ny posisjon' }}</ion-title>
            <ion-buttons slot="start"><ion-button (click)="posModal.set(false)">Avbryt</ion-button></ion-buttons>
            <ion-buttons slot="end"><ion-button (click)="savePosition()" [strong]="true"><ion-icon name="checkmark-outline" slot="icon-only" /></ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="form-section">
            <div class="field-label">ID (f.eks. MF, STR)</div>
            <ion-input class="form-input" [(ngModel)]="posForm.id" fill="outline" [disabled]="posEditMode()" />
          </div>
          <div class="form-section">
            <div class="field-label">Navn</div>
            <ion-input class="form-input" [(ngModel)]="posForm.name" fill="outline" />
          </div>
          <div class="form-section">
            <div class="field-label">Rekkefølge</div>
            <ion-input class="form-input" type="number" [(ngModel)]="posForm.sortOrder" fill="outline" />
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .page-content { --background: #0F172A; }
    .season-select { --color: #F8FAFC; --placeholder-color: #64748B; flex: 1; }

    .section-tabs {
      display: flex; overflow-x: auto; gap: 6px; padding: 8px 12px;
      scrollbar-width: none;
    }
    .section-tab {
      flex-shrink: 0; padding: 6px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 600; border: none; cursor: pointer;
      background: #1E293B; color: #64748B; transition: all 0.15s;
    }
    .section-tab.active { background: #10B981; color: #fff; }

    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      color: #64748B; letter-spacing: 1px; padding: 20px 20px 6px;
    }
    .settings-list { background: #1E293B; border-radius: 16px; margin: 0 12px 8px; overflow: hidden; }
    .settings-item {
      --background: transparent; --color: #F8FAFC; --border-color: #334155;
      --padding-start: 16px; --inner-padding-end: 16px;
    }
    .settings-item + .settings-item { border-top: 1px solid #334155; }
    h2 { font-size: 15px; font-weight: 500; color: #F8FAFC; }
    ion-note { color: #64748B; font-size: 12px; }
    .item-icon { color: #10B981; font-size: 22px; }
    .icon-danger { color: #EF4444; font-size: 18px; }
    .action-icon { color: #64748B; font-size: 18px; }
    .season-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 12px; background: #475569; }
    .season-dot.active { background: #10B981; }

    .save-bar { padding: 12px 12px 4px; }
    .number-input { --background: transparent; --color: #F8FAFC; text-align: right; max-width: 80px; font-size: 15px; }

    .rules-accordions { padding: 0 12px; }
    .rule-header { --background: #1E293B; --color: #F8FAFC; border-radius: 12px; margin-bottom: 4px; }
    .rule-content { background: #0F172A; padding: 4px 0 8px; }
    .rule-item { --background: #1E293B; --color: #F8FAFC; margin: 4px 8px; border-radius: 10px; --padding-start: 14px; }

    .modal-content { --background: #0F172A; }
    .form-section { padding: 16px 16px 0; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 1px; margin-bottom: 8px; }
    .form-input, .form-select {
      --background: #1E293B; --color: #F8FAFC;
      --placeholder-color: #64748B; --border-color: #334155;
      border-radius: 10px;
    }
  `]
})
export class SettingsPage {
  readonly auth       = inject(AuthService);
  readonly seasons    = inject(SeasonsService);
  private settingsSvc = inject(SettingsService);
  readonly teams      = inject(TeamsService);
  private playersSvc  = inject(PlayersService);
  private matchesSvc  = inject(MatchesService);
  readonly positions  = inject(PositionsService);
  private router     = inject(Router);
  private alert      = inject(AlertController);
  private toast      = inject(ToastController);

  activeSection = signal<Section>('seasons');
  newSeasonModal = signal(false);
  posModal    = signal(false);
  posEditMode = signal(false);
  newYear  = new Date().getFullYear();
  newHalf: SeasonHalf = 'SPRING';
  posForm: PlayerPosition = { id: '', name: '', sortOrder: 0 };

  readonly sectionTabs: Array<{ label: string; value: Section }> = [
    { label: 'Sesonger', value: 'seasons' },
    { label: 'Generelt', value: 'general' },
    { label: 'Kampregler', value: 'rules' },
    { label: 'Kampmatrise', value: 'matrix' },
    { label: 'Posisjoner', value: 'positions' },
  ];

  private settingsLoaded = false;

  constructor() {
    addIcons({ logOutOutline, calendarOutline, personCircleOutline, addOutline, pencilOutline, trashOutline, checkmarkOutline });
    // Sync draft when settings signal changes (e.g. after load or season switch)
    effect(() => {
      const s = this.settingsSvc.settings();
      if (!this.settingsLoaded) {
        this.draft.set({ ...s });
        this.settingsLoaded = true;
      }
    });
  }

  // --- Draft settings ---
  draft = signal<AppSettings>({ ...this.settingsSvc.settings() });

  hasChanges = computed(() =>
    JSON.stringify(this.draft()) !== JSON.stringify(this.settingsSvc.settings())
  );

  onDraftChange(key: keyof AppSettings, value: any) {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  async saveSettings() {
    try {
      await this.settingsSvc.updateSettings(this.draft());
      const t = await this.toast.create({ message: 'Innstillinger lagret', duration: 2000, color: 'success', position: 'top' });
      await t.present();
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message ?? 'Noe gikk galt', buttons: ['OK'] });
      await a.present();
    }
  }

  // --- Matrix helpers ---
  matrixLevels = computed(() =>
    Array.from({ length: this.draft().numberOfLevels }, (_, i) => i + 1)
  );

  getMatrixVal(level: number, _type: string): number {
    const m = this.draft().defaultMatchMatrix;
    const row = level === 1 ? m.level1 : level === 2 ? m.level2 : m.level3;
    return level === 1 ? row.ownLevel1Target : level === 2 ? row.ownLevel2Target : row.ownLevel3Target;
  }

  setMatrixVal(level: number, _type: string, value: number) {
    const key = level === 1 ? 'level1' : level === 2 ? 'level2' : 'level3';
    const field = level === 1 ? 'ownLevel1Target' : level === 2 ? 'ownLevel2Target' : 'ownLevel3Target';
    this.draft.update(d => ({
      ...d,
      defaultMatchMatrix: {
        ...d.defaultMatchMatrix,
        [key]: { ...d.defaultMatchMatrix[key as keyof typeof d.defaultMatchMatrix], [field]: Math.max(0, Number(value) || 0) }
      }
    }));
  }

  getMatrixHospVal(level: number): number {
    const m = this.draft().defaultMatchMatrix;
    const row = level === 1 ? m.level1 : level === 2 ? m.level2 : m.level3;
    return level === 1 ? row.hospiteringLevel1Target : level === 2 ? row.hospiteringLevel2Target : row.hospiteringLevel3Target;
  }

  setMatrixHospVal(level: number, value: number) {
    const key = level === 1 ? 'level1' : level === 2 ? 'level2' : 'level3';
    const field = level === 1 ? 'hospiteringLevel1Target' : level === 2 ? 'hospiteringLevel2Target' : 'hospiteringLevel3Target';
    this.draft.update(d => ({
      ...d,
      defaultMatchMatrix: {
        ...d.defaultMatchMatrix,
        [key]: { ...d.defaultMatchMatrix[key as keyof typeof d.defaultMatchMatrix], [field]: Math.max(0, Number(value) || 0) }
      }
    }));
  }

  // --- Team rules ---
  teamRulesView = computed(() => {
    const settings = this.draft();
    return this.teams.teams().map(team => {
      const rule = settings.teamRules.find(r => r.teamId === team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        isHospiteringTeam: team.isHospiteringTeam,
        requiredPlayerCount: rule?.requiredPlayerCount ?? settings.ownMatchMinimumPlayers,
        positionRules: rule?.positionRules ?? []
      };
    }).sort((a, b) => a.teamName.localeCompare(b.teamName, 'no'));
  });

  getPosRule(posRules: Array<{ positionId: string; requiredCount: number }>, posId: string): number {
    return posRules.find(r => r.positionId === posId)?.requiredCount ?? 0;
  }

  updateTeamRule(teamId: string, count: number) {
    const val = Math.max(0, Number(count) || 0);
    this.draft.update(d => {
      const existing = d.teamRules.find(r => r.teamId === teamId);
      const teamRules = existing
        ? d.teamRules.map(r => r.teamId === teamId ? { ...r, requiredPlayerCount: val } : r)
        : [...d.teamRules, { teamId, requiredPlayerCount: val, positionRules: [] }];
      return { ...d, teamRules };
    });
  }

  updatePosRule(teamId: string, positionId: string, count: number) {
    const val = Math.max(0, Number(count) || 0);
    this.draft.update(d => {
      const existing = d.teamRules.find(r => r.teamId === teamId);
      const base = existing ?? { teamId, requiredPlayerCount: d.ownMatchMinimumPlayers, positionRules: [] };
      const existingPos = base.positionRules.find(r => r.positionId === positionId);
      const positionRules = existingPos
        ? base.positionRules.map(r => r.positionId === positionId ? { ...r, requiredCount: val } : r)
        : [...base.positionRules, { positionId, requiredCount: val }];
      const nextRule = { ...base, positionRules };
      const teamRules = existing
        ? d.teamRules.map(r => r.teamId === teamId ? nextRule : r)
        : [...d.teamRules, nextRule];
      return { ...d, teamRules };
    });
  }

  // --- Seasons ---
  async selectSeason(ev: any) {
    const id = ev.detail?.value;
    if (!id) return;
    this.seasons.setActiveSeason(id);
    this.settingsLoaded = false;
    await Promise.all([
      this.settingsSvc.load(),
      this.teams.load(),
      this.playersSvc.load(),
      this.matchesSvc.load(),
    ]);
    this.draft.set({ ...this.settingsSvc.settings() });
    this.settingsLoaded = true;
  }

  openNewSeason() {
    this.newYear = new Date().getFullYear();
    this.newHalf = 'SPRING';
    this.newSeasonModal.set(true);
  }

  async createSeason() {
    try {
      await this.seasons.create(this.newYear, this.newHalf);
      this.newSeasonModal.set(false);
      const t = await this.toast.create({ message: 'Sesong opprettet', duration: 2000, color: 'success', position: 'top' });
      await t.present();
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message, buttons: ['OK'] });
      await a.present();
    }
  }

  async toggleSeason(s: Season) {
    try {
      if (s.archived) {
        await this.seasons.reactivate(s.id);
      } else {
        const a = await this.alert.create({
          header: 'Arkiver sesong',
          message: `Arkivere ${s.name}?`,
          buttons: [
            { text: 'Avbryt', role: 'cancel' },
            { text: 'Arkiver', handler: async () => { await this.seasons.archive(s.id); } }
          ]
        });
        await a.present();
      }
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message, buttons: ['OK'] });
      await a.present();
    }
  }

  async deleteSeason(s: Season) {
    const a = await this.alert.create({
      header: 'Slett sesong',
      message: `Slett ${s.name} og all tilhørende data?`,
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Slett', role: 'destructive', handler: async () => {
          await this.seasons.deleteSeason(s.id);
        }}
      ]
    });
    await a.present();
  }

  // --- Positions ---
  openNewPosition() {
    this.posEditMode.set(false);
    this.posForm = { id: '', name: '', sortOrder: this.positions.positions().length + 1 };
    this.posModal.set(true);
  }

  editPosition(pos: PlayerPosition) {
    this.posEditMode.set(true);
    this.posForm = { ...pos };
    this.posModal.set(true);
  }

  async savePosition() {
    if (!this.posForm.id.trim() || !this.posForm.name.trim()) return;
    try {
      const pos: PlayerPosition = {
        id: this.posForm.id.trim().toUpperCase(),
        name: this.posForm.name.trim(),
        sortOrder: Number(this.posForm.sortOrder) || 0
      };
      if (this.posEditMode()) {
        await this.positions.update(pos);
      } else {
        await this.positions.add(pos);
      }
      this.posModal.set(false);
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message, buttons: ['OK'] });
      await a.present();
    }
  }

  async deletePosition(id: string) {
    const a = await this.alert.create({
      header: 'Slett posisjon',
      message: 'Slett denne posisjonen?',
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Slett', role: 'destructive', handler: async () => {
          await this.positions.remove(id);
        }}
      ]
    });
    await a.present();
  }

  // --- Auth ---
  async logout() {
    const a = await this.alert.create({
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
