import { Component, inject, computed, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons,
  IonIcon, IonSegment, IonSegmentButton, IonLabel, IonBadge,
  IonSpinner, IonModal, IonList, IonItem, IonNote, IonCheckbox,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  refreshOutline, syncOutline, checkmarkCircleOutline, warningOutline,
  lockClosedOutline, lockOpenOutline, banOutline, calendarOutline,
  chevronDownOutline, chevronUpOutline, personOutline, swapHorizontalOutline,
  copyOutline, listOutline
} from 'ionicons/icons';
import { FormsModule } from '@angular/forms';
import { DistributionService } from '../../core/services/distribution.service';
import { MatchesService } from '../../core/services/matches.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { SettingsService } from '../../core/services/settings.service';
import { MatchOverridesService } from '../../core/services/match-overrides.service';
import { SeasonsService } from '../../core/services/season.service';
import { DistributedMatch } from '../../core/models/distributed-match.model';
import { Player } from '../../core/models/player.model';

@Component({
  selector: 'app-distribution',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons,
    IonIcon, IonSegment, IonSegmentButton, IonLabel, IonBadge,
    IonSpinner, IonModal, IonList, IonItem, IonNote, IonCheckbox
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Kampfordeling</ion-title>
        <ion-buttons slot="end">
          <ion-button [disabled]="generating() || seasonsSvc.isActiveSeasonArchived()" (click)="regenerate()" title="Oppdater">
            <ion-icon name="refresh-outline" />
          </ion-button>
          <ion-button [disabled]="generating() || seasonsSvc.isActiveSeasonArchived()" (click)="confirmFresh()" title="Ny fordeling">
            <ion-icon name="sync-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="viewMode">
          <ion-segment-button value="matches"><ion-label>Kamper</ion-label></ion-segment-button>
          <ion-segment-button value="players"><ion-label>Spillere</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      @if (seasonsSvc.isActiveSeasonArchived()) {
        <div class="archived-banner">
          <ion-icon name="lock-closed-outline" />
          <span>Arkivert sesong – fordeling er skrivebeskyttet</span>
        </div>
      }
      @if (generating()) {
        <div class="center-state">
          <ion-spinner name="crescent" />
          <p>Genererer fordeling...</p>
        </div>
      } @else if (distribution().length === 0) {
        <div class="center-state">
          <ion-icon name="calendar-outline" class="big-icon" />
          <h3>Ingen kamper å fordele</h3>
          <p>Legg til kamper og trykk oppdater.</p>
          <ion-button (click)="regenerate()" color="success" [disabled]="seasonsSvc.isActiveSeasonArchived()">Generer fordeling</ion-button>
        </div>
      } @else if (viewMode === 'matches') {
        <div class="match-list">
          @for (item of distribution(); track item.match.id) {
            <div class="dist-card" [class.has-warnings]="item.warnings.length > 0">
              <!-- Header row -->
              <div class="card-header" (click)="toggleExpanded(item.match.id)">
                <div class="header-left">
                  <span class="team-name">{{ getTeamName(item.match.teamId) }}</span>
                  <span class="match-date">{{ item.match.date }} · {{ item.match.time }}</span>
                </div>
                <div class="header-right">
                  @if (getMissing(item) > 0) {
                    <ion-badge color="danger">-{{ getMissing(item) }}</ion-badge>
                  } @else {
                    <ion-icon name="checkmark-circle-outline" class="ok-icon" />
                  }
                  <ion-icon [name]="isExpanded(item.match.id) ? 'chevron-up-outline' : 'chevron-down-outline'" class="chevron" />
                </div>
              </div>

              <!-- Fixture -->
              <div class="fixture">
                {{ item.match.homeTeam }} <span class="vs">–</span> {{ item.match.awayTeam }}
              </div>

              <!-- Count bar -->
              <div class="count-bar">
                <span class="count-chip">{{ item.players.length }}/{{ getRequired(item) }} spillere</span>
                @for (w of item.warnings.slice(0,2); track w.message) {
                  <span class="warn-chip">{{ w.message }}</span>
                }
                <ion-button fill="clear" size="small" class="copy-btn" (click)="openJoblist(item); $event.stopPropagation()" title="Jobliste">
                  <ion-icon name="list-outline" slot="icon-only" />
                </ion-button>
                <ion-button fill="clear" size="small" class="edit-btn" (click)="openOverride(item); $event.stopPropagation()">
                  Rediger
                </ion-button>
              </div>

              <!-- Expanded player list -->
              @if (isExpanded(item.match.id)) {
                <div class="player-chips">
                  @for (p of item.players; track p.id) {
                    <span class="player-chip"
                      [class.locked]="isLocked(item.match.id, p.id)"
                      [style.--level-color]="levelColor(p.level)">
                      @if (isLocked(item.match.id, p.id)) {
                        <ion-icon name="lock-closed-outline" class="lock-icon" />
                      }
                      {{ p.name }}
                    </span>
                  }
                  @if (item.players.length === 0) {
                    <span class="no-players">Ingen spillere fordelt</span>
                  }
                </div>
              }
            </div>
          }
        </div>

      } @else {
        <!-- Players summary view -->
        <div class="summary-list">
          @for (row of playerSummary(); track row.id) {
            <div class="summary-card">
              <div class="summary-avatar" [style.background]="levelColor(row.level)">
                {{ row.name.charAt(0) }}
              </div>
              <div class="summary-info">
                <span class="summary-name">{{ row.name }}</span>
                <span class="summary-sub">Nivå {{ row.level }}</span>
              </div>
              <div class="summary-right">
                <span class="count-pill">{{ row.total }} kamper</span>
                @if (row.locked > 0) {
                  <span class="locked-pill">{{ row.locked }} låst</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </ion-content>

    <!-- Joblist modal -->
    <ion-modal [isOpen]="joblistModal()" (didDismiss)="closeJoblist()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ getTeamName(joblistItem()?.match?.teamId ?? '') }}</ion-title>
            <ion-buttons slot="start">
              <ion-button (click)="closeJoblist()">Lukk</ion-button>
            </ion-buttons>
            <ion-buttons slot="end">
              <ion-button (click)="copyJoblist()" title="Kopier">
                <ion-icon name="copy-outline" slot="icon-only" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          @if (joblistItem(); as item) {
            <div class="jl-match-info">
              <span class="jl-fixture">{{ item.match.homeTeam }} – {{ item.match.awayTeam }}</span>
              <span class="jl-date">{{ item.match.date }} · {{ item.match.time }}</span>
            </div>
            <div class="jl-progress">
              <div class="jl-progress-bar" [style.width.%]="joblistProgress()"></div>
            </div>
            <div class="jl-count">{{ joblistCheckedCount() }} / {{ item.players.length }} lagt inn i Spond</div>
            <ion-list class="jl-list">
              @for (p of item.players; track p.id; let i = $index) {
                <ion-item class="jl-item" lines="none" (click)="toggleJoblistCheck(p.id)">
                  <ion-checkbox
                    slot="start"
                    [checked]="isJoblistChecked(p.id)"
                    (ionChange)="toggleJoblistCheck(p.id)"
                    color="success"
                  />
                  <ion-label [class.jl-done]="isJoblistChecked(p.id)">
                    <span class="jl-num">{{ i + 1 }}.</span> {{ p.name }}
                  </ion-label>
                  <ion-note slot="end" class="jl-level">Nivå {{ p.level }}</ion-note>
                </ion-item>
              }
            </ion-list>
            @if (joblistCheckedCount() === item.players.length && item.players.length > 0) {
              <div class="jl-done-banner">
                <ion-icon name="checkmark-circle-outline" />
                Alle spillere lagt inn i Spond!
              </div>
            }
          }
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- Swap player modal -->
    <ion-modal [isOpen]="swapModal()" (didDismiss)="swapModal.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Bytt spiller</ion-title>
            <ion-buttons slot="start">
              <ion-button (click)="swapModal.set(false)">Avbryt</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="override-section-label">Velg erstatter for {{ swapFromPlayer()?.name }}</div>
          <ion-list class="override-list">
            @for (p of availableForSwap(); track p.id) {
              <ion-item class="override-item" lines="none" (click)="doSwap(p.id)" button detail="false">
                <div class="ov-avatar" slot="start" [style.background]="levelColor(p.level)">{{ p.name.charAt(0) }}</div>
                <ion-label>
                  <h2>{{ p.name }}</h2>
                  <ion-note>Nivå {{ p.level }}</ion-note>
                </ion-label>
              </ion-item>
            }
            @if (availableForSwap().length === 0) {
              <ion-item lines="none"><ion-label><ion-note>Ingen tilgjengelige spillere</ion-note></ion-label></ion-item>
            }
          </ion-list>
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- Override modal -->
    <ion-modal [isOpen]="overrideModal()" (didDismiss)="overrideModal.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ overrideItem()?.match?.homeTeam }} – {{ overrideItem()?.match?.awayTeam }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="overrideModal.set(false)">Ferdig</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="override-section-label">Fordelte spillere</div>
          <ion-list class="override-list">
            @for (p of overrideItem()?.players ?? []; track p.id) {
              <ion-item class="override-item" lines="none">
                <div class="ov-avatar" slot="start" [style.background]="levelColor(p.level)">{{ p.name.charAt(0) }}</div>
                <ion-label>
                  <h2>{{ p.name }}</h2>
                  <ion-note>Nivå {{ p.level }}</ion-note>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button fill="clear" size="small" color="primary" (click)="openSwap(overrideItem()!.match.id, p.id)">
                    <ion-icon name="swap-horizontal-outline" slot="icon-only" />
                  </ion-button>
                  <ion-button fill="clear" size="small" (click)="toggleLock(overrideItem()!.match.id, p.id)"
                    [color]="isLocked(overrideItem()!.match.id, p.id) ? 'warning' : 'medium'">
                    <ion-icon [name]="isLocked(overrideItem()!.match.id, p.id) ? 'lock-closed-outline' : 'lock-open-outline'" slot="icon-only" />
                  </ion-button>
                  <ion-button fill="clear" size="small" color="danger" (click)="excludePlayer(overrideItem()!.match.id, p.id)">
                    <ion-icon name="ban-outline" slot="icon-only" />
                  </ion-button>
                </ion-buttons>
              </ion-item>
            }
            @if ((overrideItem()?.players?.length ?? 0) === 0) {
              <ion-item lines="none"><ion-label><ion-note>Ingen spillere fordelt</ion-note></ion-label></ion-item>
            }
          </ion-list>

          @if (excludedForMatch().length > 0) {
            <div class="override-section-label" style="margin-top:16px">Ekskluderte spillere</div>
            <ion-list class="override-list">
              @for (p of excludedForMatch(); track p.id) {
                <ion-item class="override-item" lines="none">
                  <div class="ov-avatar excluded" slot="start">{{ p.name.charAt(0) }}</div>
                  <ion-label><h2 class="excluded-name">{{ p.name }}</h2></ion-label>
                  <ion-button slot="end" fill="clear" size="small" color="success" (click)="unexcludePlayer(overrideItem()!.match.id, p.id)">
                    Gjenopprett
                  </ion-button>
                </ion-item>
              }
            </ion-list>
          }

          <div style="padding: 16px;">
            <ion-button expand="block" color="success" (click)="applyAndRegenerate()" [disabled]="seasonsSvc.isActiveSeasonArchived()">
              Regenerer med endringer
            </ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>

  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    ion-segment { --background: #1E293B; }
    ion-segment-button {
      --color: #94A3B8;
      --color-checked: #F8FAFC;
      --indicator-color: #10B981;
      --indicator-height: 3px;
    }
    ion-segment-button ion-label { color: inherit; }
    .page-content { --background: #0F172A; }

    .center-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 60vh; gap: 12px;
      color: #64748B; text-align: center; padding: 24px;
    }
    .big-icon { font-size: 48px; color: #334155; }
    h3 { color: #F8FAFC; margin: 0; }

    .match-list { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .dist-card {
      background: #1E293B; border-radius: 14px; padding: 14px;
      border-left: 3px solid #334155;
    }
    .dist-card.has-warnings { border-left-color: #F59E0B; }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; cursor: pointer; }
    .header-left { display: flex; flex-direction: column; }
    .header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .team-name { font-size: 12px; font-weight: 700; color: #10B981; }
    .match-date { font-size: 11px; color: #64748B; }
    .ok-icon { color: #10B981; font-size: 20px; }
    .chevron { color: #64748B; font-size: 16px; }

    .fixture { font-size: 15px; font-weight: 600; color: #F8FAFC; margin-bottom: 8px; }
    .vs { color: #64748B; margin: 0 4px; }

    .count-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .count-chip { font-size: 11px; font-weight: 600; background: #10B98120; color: #10B981; border-radius: 6px; padding: 2px 8px; }
    .warn-chip  { font-size: 11px; background: #F59E0B20; color: #F59E0B; border-radius: 6px; padding: 2px 8px; flex: 1; }
    .edit-btn   { --color: #64748B; font-size: 12px; margin-left: auto; height: 24px; }

    .player-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #334155; }
    .player-chip {
      font-size: 12px; padding: 4px 10px; border-radius: 20px;
      background: color-mix(in srgb, var(--level-color, #10B981) 15%, transparent);
      color: var(--level-color, #10B981);
      display: flex; align-items: center; gap: 4px;
    }
    .player-chip.locked { outline: 1px solid #F59E0B; color: #F59E0B; background: #F59E0B15; }
    .lock-icon { font-size: 11px; }
    .no-players { font-size: 12px; color: #475569; font-style: italic; }

    .summary-list { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .summary-card { background: #1E293B; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
    .summary-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: white; flex-shrink: 0; }
    .summary-info { flex: 1; }
    .summary-name { font-size: 14px; font-weight: 600; color: #F8FAFC; display: block; }
    .summary-sub  { font-size: 12px; color: #64748B; }
    .summary-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .count-pill  { font-size: 12px; font-weight: 700; background: #10B98120; color: #10B981; border-radius: 8px; padding: 3px 8px; }
    .locked-pill { font-size: 11px; font-weight: 600; background: #F59E0B20; color: #F59E0B; border-radius: 8px; padding: 2px 6px; }

    .archived-banner {
      display: flex; align-items: center; gap: 8px;
      background: #F59E0B18; border-bottom: 1px solid #F59E0B40;
      color: #F59E0B; font-size: 13px; font-weight: 600;
      padding: 10px 16px;
    }
    .archived-banner ion-icon { font-size: 16px; flex-shrink: 0; }
    .modal-content { --background: #0F172A; }
    .copy-btn { --color: #64748B; height: 24px; }
    .jl-match-info { padding: 16px 16px 4px; display: flex; flex-direction: column; gap: 2px; }
    .jl-fixture { font-size: 16px; font-weight: 700; color: #F8FAFC; }
    .jl-date { font-size: 13px; color: #64748B; }
    .jl-progress { height: 4px; background: #1E293B; margin: 12px 16px 0; border-radius: 2px; overflow: hidden; }
    .jl-progress-bar { height: 100%; background: #10B981; border-radius: 2px; transition: width 0.3s ease; }
    .jl-count { font-size: 12px; color: #64748B; padding: 6px 16px 12px; }
    .jl-list { background: transparent; padding: 0 12px; }
    .jl-item {
      --background: #1E293B; --color: #F8FAFC;
      --padding-start: 14px; --inner-padding-end: 14px;
      border-radius: 12px; margin-bottom: 8px;
      --min-height: 52px;
    }
    .jl-num { color: #475569; font-size: 13px; margin-right: 2px; }
    ion-label.jl-done { text-decoration: line-through; color: #475569 !important; }
    .jl-level { font-size: 12px; color: #475569; }
    .jl-done-banner {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin: 16px; padding: 14px; border-radius: 14px;
      background: #10B98120; color: #10B981; font-weight: 700; font-size: 15px;
    }
    .jl-done-banner ion-icon { font-size: 22px; }
    .override-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 1px; padding: 16px 16px 6px; }
    .override-list { background: #1E293B; border-radius: 14px; margin: 0 12px; overflow: hidden; }
    .override-item { --background: transparent; --color: #F8FAFC; --padding-start: 12px; }
    .override-item + .override-item { border-top: 1px solid #334155; }
    .ov-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: white; margin-right: 10px; }
    .ov-avatar.excluded { background: #334155; }
    h2 { font-size: 14px; font-weight: 500; color: #F8FAFC; }
    h2.excluded-name { color: #64748B; }
    ion-note { color: #64748B; font-size: 12px; }
  `]
})
export class DistributionPage {
  private distSvc      = inject(DistributionService);
  private matchesSvc   = inject(MatchesService);
  private playersSvc   = inject(PlayersService);
  private teamsSvc     = inject(TeamsService);
  private settingsSvc  = inject(SettingsService);
  private overridesSvc = inject(MatchOverridesService);
  readonly seasonsSvc  = inject(SeasonsService);
  private toast        = inject(ToastController);
  private alert        = inject(AlertController);

  distribution  = signal<DistributedMatch[]>([]);
  generating    = signal(false);
  viewMode      = 'matches';
  expandedRows  = signal<Record<string, boolean>>({});
  overrideModal = signal(false);
  overrideItem  = signal<DistributedMatch | null>(null);
  swapModal     = signal(false);
  joblistModal  = signal(false);
  joblistItem   = signal<DistributedMatch | null>(null);
  joblistChecked = signal<Set<string>>(new Set());
  swapMatchId   = signal('');
  swapFromId    = signal('');

  swapFromPlayer = computed(() =>
    this.playersSvc.players().find(p => p.id === this.swapFromId()) ?? null
  );

  availableForSwap = computed(() => {
    const item = this.overrideItem();
    if (!item) return [];
    const inMatch = new Set(item.players.map(p => p.id));
    const excIds  = new Set(this.overridesSvc.getOverride(item.match.id).excludedPlayerIds);
    return this.playersSvc.players().filter(p => !inMatch.has(p.id) && !excIds.has(p.id));
  });

  joblistCheckedCount = computed(() => this.joblistChecked().size);
  joblistProgress = computed(() => {
    const total = this.joblistItem()?.players.length ?? 0;
    return total === 0 ? 0 : (this.joblistChecked().size / total) * 100;
  });

  constructor() {
    addIcons({
      refreshOutline, syncOutline, checkmarkCircleOutline, warningOutline,
      lockClosedOutline, lockOpenOutline, banOutline, calendarOutline,
      chevronDownOutline, chevronUpOutline, personOutline, swapHorizontalOutline,
      copyOutline, listOutline
    });
  }

  // Auto-generate when page becomes visible
  ionViewWillEnter() {
    if (this.distribution().length === 0 && this.matchesSvc.matches().length > 0) {
      this.runGenerate(false);
    }
  }

  // --- Generation ---
  async regenerate() {
    await this.runGenerate(false);
  }

  async confirmFresh() {
    const a = await this.alert.create({ cssClass: 'dark-alert',
      header: 'Ny fordeling',
      message: 'Dette nullstiller alle manuelle endringer. Fortsette?',
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Fortsett', role: 'destructive', handler: async () => {
          await this.overridesSvc.clearAll();
          await this.runGenerate(true);
        }}
      ]
    });
    await a.present();
  }

  private async runGenerate(fresh: boolean) {
    this.generating.set(true);
    try {
      await new Promise(r => setTimeout(r, 0)); // let spinner render
      const result = this.distSvc.generate(
        this.matchesSvc.matches(),
        this.playersSvc.players(),
        this.settingsSvc.settings(),
        this.teamsSvc.teams(),
        fresh ? [] : this.overridesSvc.overrides(),
        { randomizePlayers: fresh }
      );
      this.distribution.set(result);
      const t = await this.toast.create({
        message: `${result.length} kamper fordelt`, duration: 2000, color: 'success', position: 'top'
      });
      await t.present();
    } catch (e: any) {
      console.error(e);
      const a = await this.alert.create({ cssClass: 'dark-alert', header: 'Feil', message: e?.message ?? 'Noe gikk galt', buttons: ['OK'] });
      await a.present();
    } finally {
      this.generating.set(false);
    }
  }

  // --- Expand/collapse ---
  toggleExpanded(matchId: string) {
    this.expandedRows.update(r => ({ ...r, [matchId]: !r[matchId] }));
  }
  isExpanded(matchId: string) { return !!this.expandedRows()[matchId]; }

  // --- Override modal ---
  openOverride(item: DistributedMatch) {
    this.overrideItem.set(item);
    this.overrideModal.set(true);
  }

  excludedForMatch = computed(() => {
    const item = this.overrideItem();
    if (!item) return [];
    const excIds = new Set(this.overridesSvc.getOverride(item.match.id).excludedPlayerIds);
    return this.playersSvc.players().filter(p => excIds.has(p.id));
  });

  isLocked(matchId: string, playerId: string): boolean {
    return this.overridesSvc.getOverride(matchId).lockedPlayerIds.includes(playerId);
  }

  async toggleLock(matchId: string, playerId: string) {
    await this.overridesSvc.toggleLockedPlayer(matchId, playerId);
    // refresh the item shown in modal
    const updated = this.distribution().find(d => d.match.id === matchId);
    if (updated) this.overrideItem.set({ ...updated });
  }

  async excludePlayer(matchId: string, playerId: string) {
    await this.overridesSvc.toggleExcludedPlayer(matchId, playerId);
  }

  async unexcludePlayer(matchId: string, playerId: string) {
    await this.overridesSvc.toggleExcludedPlayer(matchId, playerId);
  }

  openSwap(matchId: string, playerId: string) {
    this.swapMatchId.set(matchId);
    this.swapFromId.set(playerId);
    this.swapModal.set(true);
  }

  async doSwap(newPlayerId: string) {
    const matchId   = this.swapMatchId();
    const oldId     = this.swapFromId();
    // Exclude old player, lock new player for this match
    await this.overridesSvc.toggleExcludedPlayer(matchId, oldId);
    await this.overridesSvc.toggleLockedPlayer(matchId, newPlayerId);
    this.swapModal.set(false);
    await this.applyAndRegenerate();
  }

  async applyAndRegenerate() {
    this.overrideModal.set(false);
    await this.runGenerate(false);
  }

  // --- Helpers ---
  getTeamName(teamId: string) {
    return this.teamsSvc.teams().find(t => t.id === teamId)?.name ?? teamId;
  }

  getRequired(item: DistributedMatch): number {
    const settings = this.settingsSvc.settings();
    const team = this.teamsSvc.teams().find(t => t.id === item.match.teamId);
    const rule = settings.teamRules.find(r => r.teamId === item.match.teamId);
    if (team?.isHospiteringTeam) {
      return rule?.requiredPlayerCount ?? 0;
    }
    return rule?.requiredPlayerCount ?? settings.ownMatchMinimumPlayers;
  }

  getMissing(item: DistributedMatch) {
    return Math.max(this.getRequired(item) - item.players.length, 0);
  }

  openJoblist(item: DistributedMatch) {
    this.joblistItem.set(item);
    this.joblistChecked.set(new Set());
    this.joblistModal.set(true);
  }

  closeJoblist() {
    this.joblistModal.set(false);
    this.joblistItem.set(null);
    this.joblistChecked.set(new Set());
  }

  isJoblistChecked(playerId: string): boolean {
    return this.joblistChecked().has(playerId);
  }

  toggleJoblistCheck(playerId: string) {
    const s = new Set(this.joblistChecked());
    s.has(playerId) ? s.delete(playerId) : s.add(playerId);
    this.joblistChecked.set(s);
  }

  async copyJoblist() {
    const item = this.joblistItem();
    if (!item) return;
    const teamName = this.getTeamName(item.match.teamId);
    const lines = [
      `${teamName} – ${item.match.date} ${item.match.time}`,
      `${item.match.homeTeam} – ${item.match.awayTeam}`,
      '',
      ...item.players.map((p, i) => `${i + 1}. ${p.name}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    const t = await this.toast.create({
      message: 'Kopiert til utklippstavle', duration: 1800, color: 'success', position: 'top'
    });
    await t.present();
  }

  async copyMatch(item: DistributedMatch) {
    const teamName = this.getTeamName(item.match.teamId);
    const lines = [
      `${teamName} – ${item.match.date} ${item.match.time}`,
      `${item.match.homeTeam} – ${item.match.awayTeam}`,
      '',
      ...item.players.map((p, i) => `${i + 1}. ${p.name}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    const t = await this.toast.create({
      message: 'Kopiert til utklippstavle', duration: 1800, color: 'success', position: 'top'
    });
    await t.present();
  }

  levelColor(level: number) {
    return level === 1 ? '#10B981' : level === 2 ? '#3B82F6' : '#A855F7';
  }

  playerSummary = computed(() => {
    const result: Record<string, { id: string; name: string; level: number; total: number; locked: number }> = {};
    this.playersSvc.players().forEach(p => {
      result[p.id] = { id: p.id, name: p.name, level: p.level, total: 0, locked: 0 };
    });
    this.distribution().forEach(item => {
      item.players.forEach(p => {
        if (result[p.id]) {
          result[p.id].total++;
          if (this.isLocked(item.match.id, p.id)) result[p.id].locked++;
        }
      });
    });
    return Object.values(result)
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
  });
}
