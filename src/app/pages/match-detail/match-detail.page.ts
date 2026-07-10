import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonIcon, IonModal, IonButton, IonInput,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  footballOutline, cardOutline, swapHorizontalOutline,
  checkmarkCircle, ellipseOutline, trashOutline,
  personOutline, closeOutline, chevronDownOutline, shirtOutline
} from 'ionicons/icons';
import { MatchEventsService } from '../../core/services/match-events.service';
import { PlayersService } from '../../core/services/players.service';
import { TeamsService } from '../../core/services/teams.service';
import { SeasonsService } from '../../core/services/season.service';
import { MatchesService } from '../../core/services/matches.service';
import { DistributionSnapshotsService } from '../../core/services/distribution-snaphsot.service';
import { DistributedMatch } from '../../core/models/distributed-match.model';
import { Player } from '../../core/models/player.model';
import { MatchEvent, MatchEventType } from '../../core/models/match-event.model';

type EventAction = 'goal_home' | 'goal_away' | 'yellow' | 'red' | 'swap';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonBackButton, IonIcon, IonModal, IonButton, IonInput,
  ],
  template: `
    <ion-header>
      <ion-toolbar [style.--background]="teamColor()">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/today" text="" />
        </ion-buttons>
        <ion-title style="color: white">{{ teamName() }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      @if (item()) {
        <!-- SCOREBOARD -->
        <div class="scoreboard" [style.background]="teamColor()">
          <div class="scoreboard-teams">
            <span class="sb-team home">{{ item()!.match.homeTeam }}</span>
            <div class="sb-score-block">
              <span class="sb-score">{{ homeGoals() }} – {{ awayGoals() }}</span>
              <span class="sb-time">{{ item()!.match.time }} · Nivå {{ item()!.match.matchLevel }}</span>
            </div>
            <span class="sb-team away">{{ item()!.match.awayTeam }}</span>
          </div>
        </div>

        <!-- QUICK ACTIONS -->
        <div class="actions-row">
          <button class="action-btn goal-home" (click)="openEvent('goal_home')">
            <ion-icon name="football-outline" />
            <span>Mål hjemme</span>
          </button>
          <button class="action-btn goal-away" (click)="quickGoal('away')">
            <ion-icon name="football-outline" />
            <span>Mål borte</span>
          </button>
          <button class="action-btn yellow" (click)="openEvent('yellow')">
            <span class="card-icon yellow-card"></span>
            <span>Gult</span>
          </button>
          <button class="action-btn red" (click)="openEvent('red')">
            <span class="card-icon red-card"></span>
            <span>Rødt</span>
          </button>
        </div>

        <!-- SQUAD -->
        <div class="section">
          <div class="section-header" (click)="showOnField.set(!showOnField())">
            <span class="section-title">PÅ BANEN ({{ starters().length }})</span>
            <div style="display:flex;align-items:center;gap:8px" (click)="$event.stopPropagation()">
              <button class="swap-btn" (click)="openSubstitution()">
                <ion-icon name="swap-horizontal-outline" /> Innbytte
              </button>
              <button class="swap-btn forfeit-btn" (click)="openSwap()">
                <ion-icon name="close-outline" /> Meld forfall
              </button>
              <ion-icon name="chevron-down-outline" class="chevron" [class.rotated]="!showOnField()" />
            </div>
          </div>

          @if (showOnField()) {
          <div class="player-list">
            @for (player of starters(); track player.id) {
              @let absent = isAbsent(player.id);
              @let cards = playerStats().get(player.id);
              <div class="player-row starter" [class.absent]="absent" (click)="toggleStarter(player)">
                <div class="player-avatar starter-avatar" [style.background]="absent ? '#EF444422' : '#10B98122'">
                  @if (player.number) {
                    <span class="shirt-number">
                      <ion-icon name="shirt-outline" class="shirt-icon" style="color:#10B981" />
                      <span class="shirt-num" style="color:#10B981">{{ player.number }}</span>
                    </span>
                  } @else {
                    <span style="color: #10B981; font-weight: 700">{{ player.name.charAt(0) }}</span>
                  }
                </div>
                <div class="player-info">
                  <span class="player-name" [class.absent-name]="absent">{{ player.name }}</span>
                  @if (isSwapped(player.id)) { <span class="swap-tag">Byttet ut</span> }
                  @if (absent) { <span class="swap-tag" style="color:#EF4444">Meldt forfall</span> }
                </div>
                @if (cards) {
                  <div class="card-badges">
                    @for (_ of yellowArr(cards.goals); track $index) { <span class="card-badge">⚽</span> }
                    @for (_ of yellowArr(cards.yellow); track $index) { <span class="card-badge">🟨</span> }
                    @for (_ of redArr(cards.red); track $index) { <span class="card-badge">🟥</span> }
                  </div>
                }
              </div>
            }

            @for (swap of swappedInPlayers(); track swap.player.id) {
              @let cards = playerStats().get(swap.player.id);
              <div class="player-row starter">
                <div class="player-avatar starter-avatar" style="background: #10B98122">
                  @if (swap.player.number) {
                    <span class="shirt-number">
                      <ion-icon name="shirt-outline" class="shirt-icon" style="color:#10B981" />
                      <span class="shirt-num" style="color:#10B981">{{ swap.player.number }}</span>
                    </span>
                  } @else {
                    <span style="color: #10B981; font-weight: 700">{{ swap.player.name.charAt(0) }}</span>
                  }
                </div>
                <div class="player-info">
                  <span class="player-name">{{ swap.player.name }}</span>
                  <span class="swap-tag in">Erstatter {{ swap.replacedName }}</span>
                </div>
                @if (cards) {
                  <div class="card-badges">
                    @for (_ of yellowArr(cards.goals); track $index) { <span class="card-badge">⚽</span> }
                    @for (_ of yellowArr(cards.yellow); track $index) { <span class="card-badge">🟨</span> }
                    @for (_ of redArr(cards.red); track $index) { <span class="card-badge">🟥</span> }
                  </div>
                }
              </div>
            }
          </div>
          }
        </div>

        @if (bench().length > 0) {
          <div class="section">
            <div class="section-header" (click)="showBench.set(!showBench())">
              <span class="section-title">PÅ BENK ({{ bench().length }})</span>
              <ion-icon name="chevron-down-outline" class="chevron" [class.rotated]="!showBench()" />
            </div>
            @if (showBench()) {
            <div class="player-list">
              @for (player of bench(); track player.id) {
                @let cards = playerStats().get(player.id);
                <div class="player-row" (click)="toggleStarter(player)">
                  <div class="player-avatar" style="background: #1E293B">
                    @if (player.number) {
                      <span class="shirt-number">
                        <ion-icon name="shirt-outline" class="shirt-icon" />
                        <span class="shirt-num">{{ player.number }}</span>
                      </span>
                    } @else {
                      <span style="color: #94A3B8; font-weight: 700">{{ player.name.charAt(0) }}</span>
                    }
                  </div>
                  <div class="player-info">
                    <span class="player-name">{{ player.name }}</span>
                  </div>
                  @if (cards) {
                    <div class="card-badges">
                      @for (_ of yellowArr(cards.goals); track $index) { <span class="card-badge">⚽</span> }
                      @for (_ of yellowArr(cards.yellow); track $index) { <span class="card-badge">🟨</span> }
                      @for (_ of redArr(cards.red); track $index) { <span class="card-badge">🟥</span> }
                    </div>
                  }
                </div>
              }
            </div>
            }
          </div>
        }

        <!-- EVENT LOG -->
        @let matchEvents = eventsService.eventsForMatch(item()!.match.id);
        @if (matchEvents.length > 0) {
          <div class="section">
            <div class="section-header" (click)="showEvents.set(!showEvents())">
              <span class="section-title">HENDELSER ({{ matchEvents.length }})</span>
              <ion-icon name="chevron-down-outline" class="chevron" [class.rotated]="!showEvents()" />
            </div>
            @if (showEvents()) {
            <div class="event-log">
              @for (event of matchEvents; track event.id) {
                <div class="event-row">
                  <span class="event-icon">{{ eventIcon(event) }}</span>
                  <span class="event-shirt">
                    <ion-icon name="shirt-outline" class="shirt-icon" />
                    @if (playerNumber(event.playerId); as num) {
                      <span class="shirt-num">{{ num }}</span>
                    }
                  </span>
                  <div class="event-info">
                    <span class="event-label">{{ eventLabel(event) }}</span>
                    @if (event.playerName) {
                      <span class="event-player">{{ event.playerName }}</span>
                    }
                  </div>
                  @if (event.minute) {
                    <span class="event-minute">{{ event.minute }}'</span>
                  }
                  <button class="delete-btn" (click)="removeEvent(event)">
                    <ion-icon name="trash-outline" />
                  </button>
                </div>
              }
            </div>
            }
          </div>
        }
      }
    </ion-content>

    <!-- EVENT MODAL (yellow/red card) -->
    <ion-modal [isOpen]="eventModalOpen()" (didDismiss)="eventModalOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ pendingAction() === 'goal_home' ? 'Mål hjemme' : pendingAction() === 'yellow' ? 'Gult kort' : 'Rødt kort' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="eventModalOpen.set(false)">
                <ion-icon name="close-outline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="field-label">Spiller</div>
          <div class="player-picker">
            @for (player of allSquadPlayers(); track player.id) {
              <button
                class="picker-player"
                [class.selected]="selectedPlayerId() === player.id"
                (click)="selectedPlayerId.set(player.id); selectedPlayerName.set(player.name)"
              >
                {{ player.name }}
              </button>
            }
          </div>
          <div class="field-label" style="margin-top: 16px">Minutt (valgfritt)</div>
          <ion-input
            class="minute-input"
            type="number"
            placeholder="f.eks. 34"
            [(ngModel)]="pendingMinute"
            fill="outline"
          />
          <ion-button expand="block" class="confirm-btn" (click)="confirmEvent()">
            Registrer
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- INNBYTTE MODAL (kamphendelse) -->
    <ion-modal [isOpen]="substitutionModalOpen()" (didDismiss)="substitutionModalOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Innbytte</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="substitutionModalOpen.set(false)">
                <ion-icon name="close-outline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="field-label">Spiller ut (på banen)</div>
          <div class="player-picker">
            @for (player of startersNotSwapped(); track player.id) {
              <button class="picker-player" [class.selected]="subOutId() === player.id" (click)="subOutId.set(player.id)">
                {{ player.name }}
              </button>
            }
          </div>
          <div class="field-label" style="margin-top:16px">Spiller inn (på benk)</div>
          <div class="player-picker">
            @for (player of bench(); track player.id) {
              <button class="picker-player" [class.selected]="subInId() === player.id" (click)="subInId.set(player.id)">
                {{ player.name }}
              </button>
            }
          </div>
          <div class="field-label" style="margin-top:16px">Minutt (valgfritt)</div>
          <ion-input class="minute-input" type="number" placeholder="f.eks. 55" [(ngModel)]="subMinute" fill="outline" />
          <ion-button expand="block" class="confirm-btn" [disabled]="!subOutId() || !subInId()" (click)="confirmSubstitution()">
            Registrer innbytte
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>

    <!-- FORFALL MODAL (tropp-endring) -->
    <ion-modal [isOpen]="swapModalOpen()" (didDismiss)="swapModalOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Meld forfall</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="swapModalOpen.set(false)">
                <ion-icon name="close-outline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="field-label">Hvem melder forfall?</div>
          <div class="player-picker">
            @for (player of item()!.players; track player.id) {
              <button
                class="picker-player"
                [class.selected]="swapOutId() === player.id"
                (click)="swapOutId.set(player.id)"
              >
                {{ player.name }}
              </button>
            }
          </div>
          <div class="field-label" style="margin-top: 16px">Erstatt med</div>
          <div class="player-picker">
            @for (player of availableReplacements(); track player.id) {
              <button
                class="picker-player"
                [class.selected]="swapInId() === player.id"
                (click)="swapInId.set(player.id)"
              >
                {{ player.name }}
              </button>
            } @empty {
              <p style="color: #64748B; font-size: 14px">Ingen tilgjengelige spillere funnet.</p>
            }
          </div>
          <ion-button
            expand="block"
            class="confirm-btn"
            [disabled]="!swapOutId() || !swapInId()"
            (click)="confirmSwap()"
          >
            Bekreft forfall og erstatter
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --color: white; }
    .page-content { --background: #0F172A; }

    /* SCOREBOARD */
    .scoreboard {
      padding: 20px 16px 24px;
    }
    .scoreboard-teams {
      display: grid; grid-template-columns: 1fr auto 1fr;
      align-items: center; gap: 12px;
    }
    .sb-team { font-size: 13px; font-weight: 700; color: white; opacity: 0.9; }
    .sb-team.home { text-align: left; }
    .sb-team.away { text-align: right; }
    .sb-score-block { text-align: center; }
    .sb-score { display: block; font-size: 42px; font-weight: 900; color: white; line-height: 1; }
    .sb-time { display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }

    /* ACTIONS */
    .actions-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 8px; padding: 12px 16px;
    }
    .action-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 14px 8px; border-radius: 14px; border: none;
      font-size: 12px; font-weight: 700; cursor: pointer; color: white;
    }
    .action-btn ion-icon { font-size: 22px; }
    .action-btn.goal-home { background: #059669; }
    .action-btn.goal-away { background: #0284c7; }
    .action-btn.yellow { background: #D97706; }
    .action-btn.red { background: #DC2626; }
    .card-icon { display: block; width: 18px; height: 24px; border-radius: 3px; }
    .yellow-card { background: #FCD34D; }
    .red-card { background: #FCA5A5; }

    /* SECTION */
    .section { padding: 0 16px 16px; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0 8px; cursor: pointer; user-select: none;
    }
    .section-title {
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #475569;
    }
    .chevron {
      font-size: 16px; color: #475569;
      transition: transform 0.2s ease;
    }
    .chevron.rotated { transform: rotate(-90deg); }
    .swap-btn {
      display: flex; align-items: center; gap: 4px;
      background: #1E293B; border: 1px solid #334155; border-radius: 999px;
      color: #94A3B8; font-size: 12px; font-weight: 600; padding: 4px 12px;
    }
    .swap-btn ion-icon { font-size: 14px; }
    .forfeit-btn { border-color: #EF4444; color: #EF4444; }

    /* PLAYER LIST */
    .player-list { display: flex; flex-direction: column; gap: 6px; }
    .player-row {
      display: flex; align-items: center; gap: 12px;
      background: #1E293B; border-radius: 12px; padding: 10px 14px;
      border: 1.5px solid #334155; cursor: pointer;
    }
    .player-row.starter { border-color: #059669; }
    .player-row.absent { border-color: #EF4444; opacity: 0.7; }
    .player-row.swap-in { border-color: #0284c7; }
    .player-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 15px;
    }
    .shirt-number { position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; }
    .shirt-icon { font-size: 28px; color: #475569; }
    .shirt-num { position: absolute; font-size: 10px; font-weight: 900; color: #F8FAFC; margin-top: 4px; }
    .player-info { flex: 1; min-width: 0; }
    .player-name { display: block; font-size: 14px; font-weight: 600; color: #F8FAFC; }
    .player-name.absent-name { text-decoration: line-through; color: #64748B; }
    .swap-tag { font-size: 10px; color: #DC2626; font-weight: 700; }
    .swap-tag.in { color: #0284c7; }
    .absent-tag {
      font-size: 10px; font-weight: 700; color: #EF4444;
      background: rgba(239,68,68,0.12); padding: 2px 8px; border-radius: 999px;
      white-space: nowrap;
    }
    .card-badges { display: flex; gap: 2px; flex-shrink: 0; }
    .card-badge { font-size: 16px; line-height: 1; }

    /* EVENT LOG */
    .event-log { display: flex; flex-direction: column; gap: 6px; }
    .event-row {
      display: flex; align-items: center; gap: 10px;
      background: #1E293B; border-radius: 10px; padding: 10px 12px;
    }
    .event-icon { font-size: 20px; flex-shrink: 0; }
    .event-shirt { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; }
    .event-info { flex: 1; }
    .event-label { display: block; font-size: 13px; font-weight: 700; color: #F8FAFC; }
    .event-player { display: block; font-size: 11px; color: #64748B; }
    .event-minute { font-size: 13px; font-weight: 800; color: #94A3B8; }
    .delete-btn {
      background: none; border: none; color: #475569; padding: 4px;
      font-size: 16px; cursor: pointer;
    }

    /* MODALS */
    .modal-content { --background: #0F172A; padding: 16px; }
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .field-label {
      font-size: 11px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.06em; color: #64748B; margin-bottom: 10px;
    }
    .player-picker { display: flex; flex-wrap: wrap; gap: 8px; }
    .picker-player {
      padding: 8px 14px; background: #1E293B; border: 1.5px solid #334155;
      border-radius: 999px; color: #F8FAFC; font-size: 13px; font-weight: 600;
      cursor: pointer;
    }
    .picker-player.selected {
      background: #10B981; border-color: #10B981; color: white;
    }
    .minute-input {
      --background: #1E293B; --color: #F8FAFC; --border-color: #334155;
      --border-width: 1.5px; --border-style: solid; --border-radius: 12px;
      --padding-start: 14px; --highlight-color-focused: #10B981;
      border-radius: 12px; min-height: 48px;
    }
    .confirm-btn { --background: #10B981; margin-top: 20px; }
  `]
})
export class MatchDetailPage implements OnInit {
  readonly eventsService = inject(MatchEventsService);
  private readonly playersSvc = inject(PlayersService);
  private readonly teamsSvc = inject(TeamsService);
  private readonly seasonsSvc = inject(SeasonsService);
  private readonly snapshotSvc = inject(DistributionSnapshotsService);
  private readonly matchesSvc = inject(MatchesService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly item = signal<DistributedMatch | null>(null);
  readonly eventModalOpen = signal(false);
  readonly swapModalOpen = signal(false);
  readonly pendingAction = signal<'yellow' | 'red' | 'goal_home'>('yellow');
  readonly selectedPlayerId = signal('');
  readonly selectedPlayerName = signal('');
  pendingMinute: number | null = null;
  readonly swapOutId = signal('');
  readonly swapInId = signal('');
  readonly substitutionModalOpen = signal(false);
  readonly subOutId = signal('');
  readonly subInId = signal('');
  subMinute: number | null = null;

  readonly starterIds = signal<Set<string>>(new Set());
  private starterStorageKey = '';

  private loadStarterIds(matchId: string) {
    this.starterStorageKey = `starters_${matchId}`;
    const raw = localStorage.getItem(this.starterStorageKey);
    if (raw) {
      try { this.starterIds.set(new Set(JSON.parse(raw))); } catch {}
    }
  }

  private saveStarterIds() {
    if (this.starterStorageKey) {
      localStorage.setItem(this.starterStorageKey, JSON.stringify([...this.starterIds()]));
    }
  }
  readonly showOnField = signal(true);
  readonly showBench = signal(true);
  readonly showEvents = signal(true);
  readonly presentIds = signal<Set<string>>(new Set());
  readonly absentIds = signal<Set<string>>(new Set());
  readonly swappedInPlayers = signal<{ player: Player; replacedName: string }[]>([]);
  private readonly allClientPlayers = signal<Player[]>([]);

  playerNumber(playerId: string | undefined): number | undefined {
    if (!playerId) return undefined;
    return this.allClientPlayers().find(p => p.id === playerId)?.number;
  }

  readonly teamColor = computed(() => {
    const teamId = this.item()?.match.teamId;
    if (!teamId) return '#10B981';
    return this.teamsSvc.teams().find(t => t.id === teamId)?.color ?? '#10B981';
  });

  readonly teamName = computed(() => {
    const teamId = this.item()?.match.teamId;
    if (!teamId) return '';
    return this.teamsSvc.teams().find(t => t.id === teamId)?.name ?? '';
  });

  readonly presentCount = computed(() => this.starterIds().size);

  readonly homeGoals = computed(() =>
    this.eventsService.eventsForMatch(this.item()?.match.id ?? '')
      .filter(e => e.eventType === 'goal' && e.note === 'home').length
  );

  readonly awayGoals = computed(() =>
    this.eventsService.eventsForMatch(this.item()?.match.id ?? '')
      .filter(e => e.eventType === 'goal' && e.note === 'away').length
  );

  readonly playerStats = computed(() => {
    const matchId = this.item()?.match.id ?? '';
    const map = new Map<string, { goals: number; yellow: number; red: number }>();
    for (const e of this.eventsService.eventsForMatch(matchId)) {
      if (!e.playerId) continue;
      const cur = map.get(e.playerId) ?? { goals: 0, yellow: 0, red: 0 };
      if (e.eventType === 'goal') cur.goals++;
      else if (e.eventType === 'yellow_card') cur.yellow++;
      else if (e.eventType === 'red_card') cur.red++;
      map.set(e.playerId, cur);
    }
    return map;
  });

  readonly allSquadPlayers = computed((): Player[] => [
    ...(this.item()?.players ?? []),
    ...this.swappedInPlayers().map(s => s.player)
  ]);

  readonly starters = computed((): Player[] => {
    const ids = this.starterIds();
    return (this.item()?.players ?? []).filter(p => ids.has(p.id));
  });

  readonly bench = computed((): Player[] => {
    const ids = this.starterIds();
    const swappedInIds = new Set(this.swappedInPlayers().map(s => s.player.id));
    return (this.item()?.players ?? []).filter(p => !ids.has(p.id) && !swappedInIds.has(p.id));
  });

  readonly startersNotSwapped = computed((): Player[] => {
    const swappedOutIds = this.absentIds();
    return this.starters().filter(p => !swappedOutIds.has(p.id));
  });

  readonly availableReplacements = computed((): Player[] => {
    const assignedIds = new Set([
      ...(this.item()?.players ?? []).map(p => p.id),
      ...this.swappedInPlayers().map(s => s.player.id)
    ]);
    return this.playersSvc.players().filter(p => !assignedIds.has(p.id) && p.available !== false);
  });

  toggleStarter(player: Player) {
    if (this.isAbsent(player.id)) return;
    this.starterIds.update(s => {
      const next = new Set(s);
      next.has(player.id) ? next.delete(player.id) : next.add(player.id);
      return next;
    });
    this.saveStarterIds();
  }

  constructor() {
    addIcons({
      footballOutline, cardOutline, swapHorizontalOutline,
      checkmarkCircle, ellipseOutline, trashOutline,
      personOutline, closeOutline, chevronDownOutline, shirtOutline
    });
  }

  async ngOnInit() {
    const state = (window.history.state ?? {}) as { item?: DistributedMatch };
    // Route param is always present; history state only exists on first navigation
    const matchId = (this.route.snapshot.paramMap.get('id') ?? state?.item?.match?.id) as string | null;

    // Set item from nav state immediately for fast render while Supabase loads
    if (state?.item) {
      this.item.set(state.item);
    }

    if (matchId) {
      this.loadStarterIds(matchId);
    }

    await Promise.all([
      this.seasonsSvc.load(),
      this.playersSvc.load(),
      this.teamsSvc.load(),
      this.matchesSvc.load(),
    ]);

    // Always reload fresh snapshot from Supabase — picks up forfall changes from previous sessions
    if (matchId) {
      const snapshots = await this.snapshotSvc.load();
      const fresh = snapshots.find(s => s.match.id === matchId);
      if (fresh) {
        // Patch date/time from live matches table so changes take effect without re-running fordeling
        const live = this.matchesSvc.matches().find(m => m.id === matchId);
        this.item.set(live ? { ...fresh, match: { ...fresh.match, date: live.date, time: live.time } } : fresh);
      }
    }

    await this.eventsService.load();

    // Load all players across all seasons/teams so jersey numbers are global
    const allPlayers = await this.playersSvc.loadAllForClient();
    this.allClientPlayers.set(allPlayers);
    this.item.update(current => {
      if (!current) return current;

      // Apply emergency_replacement events to reconstruct the correct player list
      const forfallEvents = this.eventsService.events().filter(
        e => e.matchId === current.match.id && e.eventType === 'emergency_replacement'
      );

      let players = current.players.map(p => {
        // Enrich with jersey number — match by ID first, then by name as fallback
        const full = allPlayers.find(ap => ap.id === p.id)
          ?? allPlayers.find(ap => ap.name === p.name);
        return full?.number != null ? { ...p, number: full.number } : p;
      });

      for (const ev of forfallEvents) {
        // note format: "Inn: Dhiya, Ut: Johanne" — but we have playerId = inPlayer
        const inId = ev.playerId;
        const inFull = allPlayers.find(ap => ap.id === inId)
          ?? allPlayers.find(ap => ap.name === ev.playerName);
        if (!inFull) continue;

        // Parse out-player name from note to find outId
        const utMatch = ev.note?.match(/Ut: (.+)$/);
        const outName = utMatch?.[1]?.trim();
        const outIdx = players.findIndex(p => p.name === outName);

        if (outIdx !== -1) {
          // Replace out-player with in-player
          players = [
            ...players.slice(0, outIdx),
            { ...inFull },
            ...players.slice(outIdx + 1),
          ];
        } else if (!players.some(p => p.id === inId)) {
          // Out-player already gone (prior session saved snapshot), just ensure in-player is present
          players = [...players, { ...inFull }];
        }
      }

      return { ...current, players };
    });
  }

  isPresent(playerId: string): boolean {
    return this.presentIds().has(playerId);
  }

  isAbsent(playerId: string): boolean {
    return this.absentIds().has(playerId);
  }

  isSwapped(playerId: string): boolean {
    return this.absentIds().has(playerId);
  }

  toggleAttendance(player: Player) {
    const pid = player.id;
    if (this.absentIds().has(pid)) return;
    this.presentIds.update(s => {
      const next = new Set(s);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }

  quickGoal(side: 'home' | 'away') {
    const matchId = this.item()?.match.id;
    if (!matchId) return;
    this.eventsService.addOptimistic(matchId, 'goal', { note: side });
    this.showToast(side === 'home' ? '⚽ Mål hjemme!' : '⚽ Mål borte!', 'success');
  }

  private suggestMinute(): number | null {
    const match = this.item()?.match;
    if (!match?.date || !match?.time) return null;
    const start = new Date(`${match.date}T${match.time}`);
    const elapsed = Math.floor((Date.now() - start.getTime()) / 60000);
    return elapsed >= 1 && elapsed <= 120 ? elapsed : null;
  }

  openEvent(type: 'yellow' | 'red' | 'goal_home') {
    this.pendingAction.set(type);
    this.selectedPlayerId.set('');
    this.selectedPlayerName.set('');
    this.pendingMinute = this.suggestMinute();
    this.eventModalOpen.set(true);
  }

  confirmEvent() {
    const matchId = this.item()?.match.id;
    if (!matchId) return;
    const action = this.pendingAction();
    if (action === 'goal_home') {
      this.eventsService.addOptimistic(matchId, 'goal', {
        playerId: this.selectedPlayerId() || undefined,
        playerName: this.selectedPlayerName() || undefined,
        minute: this.pendingMinute ?? undefined,
        note: 'home',
      });
      this.eventModalOpen.set(false);
      this.showToast('⚽ Mål hjemme!', 'success');
      return;
    }
    const type: MatchEventType = action === 'yellow' ? 'yellow_card' : 'red_card';
    this.eventsService.addOptimistic(matchId, type, {
      playerId: this.selectedPlayerId() || undefined,
      playerName: this.selectedPlayerName() || undefined,
      minute: this.pendingMinute ?? undefined,
    });
    this.eventModalOpen.set(false);
    this.showToast(type === 'yellow_card' ? '🟨 Gult kort registrert' : '🟥 Rødt kort registrert', 'warning');
  }

  openSwap() {
    this.swapOutId.set('');
    this.swapInId.set('');
    this.swapModalOpen.set(true);
  }

  openSubstitution() {
    this.subOutId.set('');
    this.subInId.set('');
    this.subMinute = this.suggestMinute();
    this.substitutionModalOpen.set(true);
  }

  confirmSubstitution() {
    const matchId = this.item()?.match.id;
    const outId = this.subOutId();
    const inId = this.subInId();
    if (!matchId || !outId || !inId) return;
    const outPlayer = this.allSquadPlayers().find(p => p.id === outId);
    const inPlayer = this.bench().find(p => p.id === inId);
    if (!inPlayer) return;
    this.eventsService.addOptimistic(matchId, 'substitution', {
      playerId: inId,
      playerName: inPlayer.name,
      minute: this.subMinute ?? undefined,
      note: `Inn: ${inPlayer.name}, Ut: ${outPlayer?.name ?? outId}`,
    });
    // Flytt ut-spiller til benk, inn-spiller til banen
    this.starterIds.update(s => {
      const next = new Set(s);
      next.delete(outId);
      next.add(inId);
      return next;
    });
    this.saveStarterIds();
    this.substitutionModalOpen.set(false);
    this.showToast(`🔄 Inn: ${inPlayer.name} · Ut: ${outPlayer?.name}`, 'primary');
  }

  async confirmSwap() {
    const matchId = this.item()?.match.id;
    const outId = this.swapOutId();
    const inId = this.swapInId();
    if (!matchId || !outId || !inId) return;

    const outPlayer = this.item()!.players.find(p => p.id === outId);
    const inPlayer = this.playersSvc.players().find(p => p.id === inId);
    if (!inPlayer) return;

    const outName = outPlayer?.name ?? outId;

    // 1. Oppdater lokal UI
    this.absentIds.update(s => new Set([...s, outId]));
    this.presentIds.update(s => { const n = new Set(s); n.delete(outId); n.add(inId); return n; });
    this.swappedInPlayers.update(arr => [...arr, { player: inPlayer, replacedName: outName }]);

    // 2. Logg hendelse
    this.eventsService.addOptimistic(matchId, 'emergency_replacement', {
      playerId: inId,
      playerName: inPlayer.name,
      note: `Inn: ${inPlayer.name}, Ut: ${outName}`,
    });

    // 3. Oppdater fordelings-snapshot → desktop viser riktig tropp
    const snapshot = await this.snapshotSvc.load();
    const matchEntry = snapshot.find(m => m.match.id === matchId);
    if (matchEntry) {
      matchEntry.players = matchEntry.players.map(p => p.id === outId ? inPlayer : p);
      await this.snapshotSvc.save(snapshot);
      this.item.update(curr => curr ? {
        ...curr,
        players: curr.players.map(p => p.id === outId ? inPlayer : p)
      } : curr);
    }

    this.swapModalOpen.set(false);
    this.showToast(`⚠️ ${outName} → ${inPlayer.name}`, 'primary');
  }

  async removeEvent(event: MatchEvent) {
    const a = await this.alert.create({
      header: 'Slett hendelse',
      message: 'Vil du slette denne hendelsen?',
      cssClass: 'dark-alert',
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Slett', role: 'destructive', handler: () => this.eventsService.remove(event.id) }
      ]
    });
    await a.present();
  }

  yellowArr(n: number): number[] { return Array(n).fill(0); }
  redArr(n: number): number[] { return Array(n).fill(0); }

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
      case 'substitution': return event.note ?? 'Innbytte';
      case 'emergency_replacement': return 'Forfall: ' + (event.note ?? '');
      default: return event.eventType;
    }
  }

  private async showToast(msg: string, color: string) {
    const t = await this.toast.create({ message: msg, duration: 1800, color, position: 'top' });
    await t.present();
  }
}
