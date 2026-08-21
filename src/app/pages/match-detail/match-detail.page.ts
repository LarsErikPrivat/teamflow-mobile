import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
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
  checkmarkCircle, checkmarkCircleOutline, ellipseOutline, trashOutline,
  personOutline, closeOutline, chevronDownOutline, shirtOutline,
  lockClosedOutline, lockOpenOutline, personRemoveOutline,
  pauseOutline, playOutline, timerOutline
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
        @if (phaseLabel()) {
          <div slot="end" class="phase-badge" [class]="'phase-' + currentPhase()">
            @if (currentMatchMinute() !== null) {
              <span class="phase-clock">{{ currentMatchMinute() }}'</span>
            }
            {{ phaseLabel() }}
          </div>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      @if (item()) {
        <!-- SCOREBOARD + ACTIONS -->
        <div class="scoreboard">
          <div class="sb-main">
            <!-- Home side -->
            <div class="sb-side">
              <span class="sb-team-name">{{ item()!.match.homeTeam }}</span>
              <div class="sb-btns">
                <button class="sb-btn goal" (click)="item()!.match.homeGame ? openEvent('goal_home') : quickGoal('home')">⚽</button>
                <button class="sb-btn yellow-card-btn" (click)="item()!.match.homeGame ? openEvent('yellow') : quickCard('home','yellow')">🟨</button>
                <button class="sb-btn red-card-btn" (click)="item()!.match.homeGame ? openEvent('red') : quickCard('home','red')">🟥</button>
              </div>
            </div>
            <!-- Score -->
            <div class="sb-center">
              <span class="sb-score">{{ homeGoals() }} – {{ awayGoals() }}</span>
              <span class="sb-time">{{ item()!.match.time }} · Nivå {{ item()!.match.matchLevel }}</span>
            </div>
            <!-- Away side -->
            <div class="sb-side right">
              <span class="sb-team-name">{{ item()!.match.awayTeam }}</span>
              <div class="sb-btns">
                <button class="sb-btn red-card-btn" (click)="item()!.match.homeGame === false ? openEvent('red') : quickCard('away','red')">🟥</button>
                <button class="sb-btn yellow-card-btn" (click)="item()!.match.homeGame === false ? openEvent('yellow') : quickCard('away','yellow')">🟨</button>
                <button class="sb-btn goal" (click)="item()!.match.homeGame === false ? openEvent('goal_away') : quickGoal('away')">⚽</button>
              </div>
            </div>
          </div>
          <!-- Fulltime -->
          <div class="fulltime-row">
            @if (item()!.match.homeScore == null) {
              <button class="fulltime-btn" (click)="markFullTime()">
                <ion-icon name="checkmark-circle-outline" />
                <span>Sett som ferdigspilt</span>
              </button>
            } @else {
              <div class="fulltime-done">
                <ion-icon name="checkmark-circle" />
                <span>Ferdigspilt · {{ item()!.match.homeScore }} – {{ item()!.match.awayScore }}</span>
              </div>
            }
          </div>
        </div>

        <!-- PERSISTENT ACTION BAR -->
        <div class="action-bar">
          <button class="action-bar-btn" (click)="openSubstitution()">
            <ion-icon name="swap-horizontal-outline" />
            <span>Innbytte</span>
          </button>
          @if (currentPhase() === 'first' || currentPhase() === 'second') {
            <button class="action-bar-btn pause-btn" (click)="manuallyPaused.set(true)">
              <ion-icon name="pause-outline" />
              <span>Pause</span>
            </button>
          }
          @if (currentPhase() === 'break' && manuallyPaused()) {
            <button class="action-bar-btn resume-btn" (click)="manuallyPaused.set(false)">
              <ion-icon name="play-outline" />
              <span>Fortsett</span>
            </button>
          }
          <button class="action-bar-btn settings-btn" (click)="openTimingSettings()">
            <ion-icon name="timer-outline" />
            <span>Tider</span>
          </button>
        </div>

        <!-- EVENTS (shown above squad when events exist) -->
        @let topEvents = eventsService.eventsForMatch(item()!.match.id);
        @if (topEvents.length > 0) {
          <div class="section">
            <div class="section-header" (click)="showEvents.set(!showEvents())">
              <span class="section-title">HENDELSER ({{ topEvents.length }})</span>
              <ion-icon name="chevron-down-outline" class="chevron" [class.rotated]="!showEvents()" />
            </div>
            @if (showEvents()) {
            <div class="event-log">
              @for (event of topEvents.slice().reverse(); track event.id) {
                <div class="event-row">
                  @if (event.eventType === 'substitution') {
                    @let outId = subOutPlayerIdFromNote(event.note);
                    <ion-icon name="swap-horizontal-outline" class="event-swap-icon" />
                    <span class="sub-shirt-inline">
                      <ion-icon name="shirt-outline" class="shirt-icon" />
                      <span class="shirt-num">{{ playerNumber(event.playerId) ?? '-' }}</span>
                    </span>
                    <span class="sub-initials-inline in">{{ playerShortName(event.playerName) }}</span>
                    <span class="sub-arrow">›</span>
                    <span class="sub-shirt-inline out">
                      <ion-icon name="shirt-outline" class="shirt-icon" />
                      <span class="shirt-num">{{ playerNumber(outId) ?? '-' }}</span>
                    </span>
                    <span class="sub-initials-inline out">{{ playerShortName(outPlayerName(outId)) }}</span>
                  } @else {
                    <span class="event-icon">{{ eventIcon(event) }}</span>
                    <span class="event-shirt">
                      <ion-icon name="shirt-outline" class="shirt-icon" />
                      <span class="shirt-num">{{ playerNumber(event.playerId) ?? '-' }}</span>
                    </span>
                    <div class="event-info">
                      <span class="event-label">{{ event.eventType === 'goal' ? (event.note === 'home' ? 'Mål · ' + item()!.match.homeTeam : 'Mål · ' + item()!.match.awayTeam) : eventLabel(event) }}</span>
                      @if (event.playerName) {
                        <span class="event-player">{{ event.playerName }}</span>
                      }
                    </div>
                  }
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

        <!-- SQUAD -->
        <div class="section">
          <div class="section-header" (click)="showOnField.set(!showOnField())">
            <span class="section-title">PÅ BANEN ({{ starters().length }})</span>
            <div style="display:flex;align-items:center;gap:6px;margin-left:auto" (click)="$event.stopPropagation()">
              <button class="squad-action-btn" [class.locked]="lineupLocked()" (click)="lineupLockedManual.set(!lineupLocked())">
                <ion-icon [name]="lineupLocked() ? 'lock-closed-outline' : 'lock-open-outline'" />
              </button>
              <button class="squad-action-btn forfeit-btn" (click)="openSwap()">
                <ion-icon name="person-remove-outline" />
              </button>
            </div>
            <ion-icon name="chevron-down-outline" class="chevron" [class.rotated]="!showOnField()" />
          </div>

          @if (showOnField()) {
          <div class="player-list">
            @for (player of starters(); track player.id) {
              @let absent = isAbsent(player.id);
              @let cards = playerStats().get(player.id);
              <div class="player-row starter" [class.absent]="absent" (click)="toggleStarter(player)">
                <div class="player-avatar starter-avatar">
                  <span class="shirt-number">
                    <ion-icon name="shirt-outline" class="shirt-icon" style="color:#F8FAFC" />
                    <span class="shirt-num" style="color:#F8FAFC">{{ player.number ?? '#' }}</span>
                  </span>
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
                @if (minutesPlayed(player.id); as min) {
                  <span class="player-min-badge">{{ min }}'</span>
                }
              </div>
            }

            @for (swap of swappedInPlayers(); track swap.player.id) {
              @let cards = playerStats().get(swap.player.id);
              <div class="player-row starter">
                <div class="player-avatar starter-avatar">
                  <span class="shirt-number">
                    <ion-icon name="shirt-outline" class="shirt-icon" style="color:#10B981" />
                    <span class="shirt-num" style="color:#10B981">{{ swap.player.number ?? '#' }}</span>
                  </span>
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
                @if (minutesPlayed(swap.player.id); as min) {
                  <span class="player-min-badge">{{ min }}'</span>
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
                    <span class="shirt-number">
                      <ion-icon name="shirt-outline" class="shirt-icon" />
                      <span class="shirt-num">{{ player.number ?? '#' }}</span>
                    </span>
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
                  @if (minutesPlayed(player.id); as min) {
                    <span class="player-min-badge">{{ min }}'</span>
                  }
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
            <ion-title>{{ pendingAction() === 'goal_home' ? 'Mål hjemme' : pendingAction() === 'goal_away' ? 'Mål borte' : pendingAction() === 'yellow' ? 'Gult kort' : 'Rødt kort' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="eventModalOpen.set(false)">
                <ion-icon name="close-outline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="field-label">Spiller</div>
          <div class="player-list-picker">
            @for (player of allSquadPlayers(); track player.id) {
              <button
                class="picker-row"
                [class.selected]="selectedPlayerId() === player.id"
                (click)="selectedPlayerId.set(player.id); selectedPlayerName.set(player.name)"
              >
                <span class="picker-nr">{{ player.number ?? '-' }}</span>
                <span class="picker-name">{{ player.name }}</span>
                @if (minutesPlayed(player.id); as min) {
                  <span class="picker-min">{{ min }}'</span>
                }
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
          <div class="player-list-picker">
            @for (player of startersNotSwapped(); track player.id) {
              <button class="picker-row" [class.selected]="subOutId() === player.id" (click)="subOutId.set(player.id)">
                <span class="picker-nr">{{ player.number ?? '-' }}</span>
                <span class="picker-name">{{ player.name }}</span>
                @if (minutesPlayed(player.id); as min) {
                  <span class="picker-min">{{ min }}'</span>
                }
              </button>
            }
          </div>
          <div class="field-label" style="margin-top:16px">Spiller inn (på benk)</div>
          <div class="player-list-picker">
            @for (player of bench(); track player.id) {
              <button class="picker-row" [class.selected]="subInId() === player.id" (click)="subInId.set(player.id)">
                <span class="picker-nr">{{ player.number ?? '-' }}</span>
                <span class="picker-name">{{ player.name }}</span>
                @if (minutesPlayed(player.id); as min) {
                  <span class="picker-min">{{ min }}'</span>
                }
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
          <div class="player-list-picker">
            @for (player of item()!.players; track player.id) {
              <button
                class="picker-row"
                [class.selected]="swapOutId() === player.id"
                (click)="swapOutId.set(player.id)"
              >
                <span class="picker-nr">{{ player.number ?? '-' }}</span>
                <span class="picker-name">{{ player.name }}</span>
                @if (minutesPlayed(player.id); as min) {
                  <span class="picker-min">{{ min }}'</span>
                }
              </button>
            }
          </div>
          <div class="field-label" style="margin-top: 16px">Erstatt med</div>
          <div class="player-list-picker">
            @for (player of availableReplacements(); track player.id) {
              <button
                class="picker-row"
                [class.selected]="swapInId() === player.id"
                (click)="swapInId.set(player.id)"
              >
                <span class="picker-nr">{{ player.number ?? '-' }}</span>
                <span class="picker-name">{{ player.name }}</span>
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

    <!-- TIMING MODAL -->
    <ion-modal [isOpen]="timingModalOpen()" (didDismiss)="timingModalOpen.set(false)" [breakpoints]="[0,1]" [initialBreakpoint]="1">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Kampvarighet</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="timingModalOpen.set(false)"><ion-icon name="close-outline" /></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="field-label">Omgangens varighet (min)</div>
          <ion-input class="minute-input" type="number" [(ngModel)]="tempHalfDuration" fill="outline" />
          <div class="field-label" style="margin-top:16px">Pausens varighet (min)</div>
          <ion-input class="minute-input" type="number" [(ngModel)]="tempBreakDuration" fill="outline" />
          <ion-button expand="block" class="confirm-btn" style="margin-top:24px" (click)="saveTiming()">
            Lagre
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --color: white; }
    .phase-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 999px; margin-right: 8px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.06em; white-space: nowrap;
      border: 1.5px solid rgba(255,255,255,0.5);
    }
    .phase-clock { font-size: 13px; font-weight: 900; font-variant-numeric: tabular-nums; }
    .phase-first  { background: rgba(16,185,129,0.35); color: #fff; }
    .phase-break  { background: rgba(251,191,36,0.4);  color: #fff; }
    .phase-second { background: rgba(139,92,246,0.4);  color: #fff; }
    .phase-done   { background: rgba(100,116,139,0.3); color: rgba(255,255,255,0.7); }
    .pause-btn { border-color: #FBBF24 !important; color: #FBBF24 !important; }
    .resume-btn { border-color: #10B981 !important; color: #10B981 !important; }
    .settings-btn { border-color: #475569 !important; color: #64748B !important; }
    .squad-action-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 8px;
      background: #1E293B; border: 1px solid #334155; color: #64748B;
      font-size: 16px; cursor: pointer; flex-shrink: 0;
    }
    .squad-action-btn.locked { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.12); }
    .squad-action-btn.forfeit-btn { border-color: #EF4444; color: #EF4444; }
    .page-content { --background: #0F172A; }

    /* SCOREBOARD */
    .scoreboard {
      padding: 16px 16px 14px;
      background: linear-gradient(to right, #059669 0%, #059669 45%, #0284c7 55%, #0284c7 100%);
    }
    .sb-main {
      display: grid; grid-template-columns: 1fr auto 1fr;
      align-items: center; gap: 8px;
    }
    .sb-side { display: flex; flex-direction: column; gap: 8px; }
    .sb-side.right { align-items: flex-end; }
    .sb-team-name { font-size: 12px; font-weight: 700; color: white; opacity: 0.9; }
    .sb-btns { display: flex; gap: 6px; }
    .sb-side.right .sb-btns { flex-direction: row; }
    .sb-btn {
      background: rgba(255,255,255,0.18); border: none; border-radius: 8px;
      width: 36px; height: 36px; font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .sb-center { text-align: center; }
    .sb-score { display: block; font-size: 40px; font-weight: 900; color: white; line-height: 1; }
    .sb-time { display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }

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
    .action-bar {
      display: flex; gap: 8px; padding: 12px 16px 12px;
    }
    .action-bar-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
      background: #1E293B; border: 1px solid #334155; border-radius: 12px;
      color: #94A3B8; font-size: 11px; font-weight: 600; padding: 8px 4px;
      cursor: pointer;
    }
    .action-bar-btn ion-icon { font-size: 20px; }
    .action-bar-btn.locked { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.12); }
    .action-bar-btn.forfeit { border-color: #EF4444; color: #EF4444; }
    .swap-btn {
      display: flex; align-items: center; gap: 4px;
      background: #1E293B; border: 1px solid #334155; border-radius: 999px;
      color: #94A3B8; font-size: 12px; font-weight: 600; padding: 4px 12px;
    }
    .swap-btn ion-icon { font-size: 14px; }

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
    .shirt-number { position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; }
    .shirt-icon { font-size: 46px; color: #475569; }
    .shirt-num { position: absolute; font-size: 13px; font-weight: 900; color: #F8FAFC; margin-top: 6px; }
    .player-info { flex: 1; min-width: 0; }
    .player-name { display: block; font-size: 14px; font-weight: 600; color: #F8FAFC; }
    .player-min-badge { font-size: 11px; font-weight: 700; color: #64748B; margin-left: auto; flex-shrink: 0; padding-left: 6px; }
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
    .event-log { display: flex; flex-direction: column; gap: 3px; }
    .event-row {
      display: flex; align-items: center; gap: 8px;
      background: #1E293B; border-radius: 8px; padding: 6px 10px;
    }
    .event-icon { font-size: 15px; flex-shrink: 0; line-height: 1; }
    .event-shirt { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 26px; height: 26px; }
    .event-shirt .shirt-icon { font-size: 26px; color: #475569; }
    .event-shirt .shirt-num { position: absolute; font-size: 8px; font-weight: 900; color: #F8FAFC; margin-top: 4px; }
    .event-info { flex: 1; display: flex; align-items: baseline; gap: 5px; overflow: hidden; }
    .event-label { font-size: 12px; font-weight: 700; color: #F8FAFC; white-space: nowrap; }
    .event-player { font-size: 11px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .event-minute { font-size: 11px; font-weight: 800; color: #64748B; flex-shrink: 0; }
    .delete-btn {
      background: none; border: none; color: #475569; padding: 2px 4px;
      font-size: 14px; cursor: pointer; flex-shrink: 0;
    }
    /* Substitution event layout — single line */
    .event-swap-icon { font-size: 15px; color: #10B981; flex-shrink: 0; }
    .sub-shirt-inline { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 22px; height: 22px; }
    .sub-shirt-inline .shirt-icon { font-size: 22px; color: #10B981; }
    .sub-shirt-inline .shirt-num { position: absolute; font-size: 7px; font-weight: 900; color: #F8FAFC; margin-top: 3px; }
    .sub-shirt-inline.out .shirt-icon { color: #475569; }
    .sub-shirt-inline.out .shirt-num { color: #94A3B8; }
    .sub-initials-inline { font-size: 11px; font-weight: 700; color: #F8FAFC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
    .sub-initials-inline.out { color: #64748B; margin-right: auto; }
    .sub-arrow { font-size: 13px; color: #475569; flex-shrink: 0; }

    /* FULL TIME */
    .fulltime-row { padding: 12px 0 0; }
    .fulltime-btn {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px; padding: 10px; color: rgba(255,255,255,0.85);
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .fulltime-btn ion-icon { font-size: 16px; }
    .fulltime-done {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);
      border-radius: 10px; padding: 10px; color: #fff;
      font-size: 13px; font-weight: 600;
    }
    .fulltime-done ion-icon { font-size: 16px; color: #10B981; }

    /* MODALS */
    .modal-content { --background: #0F172A; padding: 16px; }
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .field-label {
      font-size: 11px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.06em; color: #64748B; margin-bottom: 10px;
    }
    .player-list-picker { display: flex; flex-direction: column; gap: 4px; }
    .picker-row {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 12px; background: #1E293B; border: 1.5px solid #334155;
      border-radius: 10px; color: #F8FAFC; font-size: 13px; font-weight: 600;
      cursor: pointer; text-align: left;
    }
    .picker-row.selected { background: rgba(16,185,129,0.15); border-color: #10B981; }
    .picker-name { flex: 1; }
    .picker-min { font-size: 11px; font-weight: 700; color: #64748B; margin-left: auto; flex-shrink: 0; }
    .picker-nr {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 24px; height: 20px; padding: 0 5px;
      background: rgba(255,255,255,0.1); border-radius: 5px;
      font-size: 11px; font-weight: 900; flex-shrink: 0;
    }
    .picker-row.selected .picker-nr { background: rgba(16,185,129,0.25); }
    .minute-input {
      --background: #1E293B; --color: #F8FAFC; --border-color: #334155;
      --border-width: 1.5px; --border-style: solid; --border-radius: 12px;
      --padding-start: 14px; --highlight-color-focused: #10B981;
      border-radius: 12px; min-height: 48px;
    }
    .confirm-btn { --background: #10B981; margin-top: 20px; }
  `]
})
export class MatchDetailPage implements OnInit, OnDestroy {
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
  readonly pendingAction = signal<'yellow' | 'red' | 'goal_home' | 'goal_away'>('yellow');
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
  readonly lineupLockedManual = signal<boolean | null>(null);
  readonly lineupLocked = computed(() => {
    const manual = this.lineupLockedManual();
    if (manual !== null) return manual;
    const match = this.item()?.match;
    if (!match?.date || !match?.time) return false;
    return new Date(`${match.date}T${match.time}`) <= new Date();
  });
  readonly halfDuration = signal(35);
  readonly breakDuration = signal(5);
  readonly manuallyPaused = signal(false);
  readonly timingModalOpen = signal(false);
  tempHalfDuration = 35;
  tempBreakDuration = 5;
  private readonly _tick = signal(0);
  private _tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly elapsedMinutes = computed(() => {
    this._tick(); // subscribe to tick for reactivity
    const match = this.item()?.match;
    if (!match?.date || !match?.time) return null;
    const kickoff = new Date(`${match.date}T${match.time}`).getTime();
    const elapsed = Math.floor((Date.now() - kickoff) / 60000);
    return elapsed < 0 ? null : elapsed;
  });

  readonly currentPhase = computed((): 'before' | 'first' | 'break' | 'second' | 'done' => {
    if (this.manuallyPaused()) return 'break';
    const elapsed = this.elapsedMinutes();
    if (elapsed === null) return 'before';
    const half = this.halfDuration();
    const brk = this.breakDuration();
    if (elapsed < half) return 'first';
    if (elapsed < half + brk) return 'break';
    if (elapsed < half * 2 + brk) return 'second';
    return 'done';
  });

  readonly currentMatchMinute = computed(() => {
    const elapsed = this.elapsedMinutes();
    if (elapsed === null) return null;
    const half = this.halfDuration();
    const brk = this.breakDuration();
    const phase = this.currentPhase();
    if (phase === 'first') return Math.min(half, elapsed);
    if (phase === 'break') return half;
    if (phase === 'second' || phase === 'done') return Math.min(half, elapsed - brk);
    return null;
  });

  readonly minutesPlayedMap = computed((): Map<string, number> => {
    const currentMin = this.currentMatchMinute();
    const map = new Map<string, number>();
    if (currentMin === null) return map;
    const matchId = this.item()?.match.id;
    if (!matchId) return map;
    // Reading eventsService.events() makes this reactive to event changes
    const subEvents = this.eventsService.events()
      .filter(e => e.matchId === matchId && e.eventType === 'substitution');
    const starterIds = this.starterIds();

    for (const id of starterIds) {
      const subbedOut = subEvents.find(e => this.subOutPlayerIdFromNote(e.note) === id);
      map.set(id, subbedOut ? (subbedOut.minute ?? currentMin) : currentMin);
    }
    for (const ev of subEvents) {
      if (ev.playerId) {
        map.set(ev.playerId, currentMin - (ev.minute ?? 0));
      }
    }
    return map;
  });

  minutesPlayed(playerId: string): number | null {
    return this.minutesPlayedMap().get(playerId) ?? null;
  }

  private starterStorageKey = '';

  private loadStarterIds(matchId: string) {
    this.starterStorageKey = `starters_${matchId}`;
    const raw = localStorage.getItem(this.starterStorageKey);
    if (raw) {
      try { this.starterIds.set(new Set(JSON.parse(raw))); } catch {}
    }
    const half = localStorage.getItem(`timing_half_${matchId}`);
    const brk = localStorage.getItem(`timing_break_${matchId}`);
    if (half) this.halfDuration.set(+half);
    if (brk) this.breakDuration.set(+brk);
    this.tempHalfDuration = this.halfDuration();
    this.tempBreakDuration = this.breakDuration();
  }

  private saveStarterIds() {
    if (this.starterStorageKey) {
      localStorage.setItem(this.starterStorageKey, JSON.stringify([...this.starterIds()]));
    }
  }

  openTimingSettings() {
    this.tempHalfDuration = this.halfDuration();
    this.tempBreakDuration = this.breakDuration();
    this.timingModalOpen.set(true);
  }

  saveTiming() {
    this.halfDuration.set(this.tempHalfDuration);
    this.breakDuration.set(this.tempBreakDuration);
    const matchId = this.item()?.match.id;
    if (matchId) {
      localStorage.setItem(`timing_half_${matchId}`, String(this.tempHalfDuration));
      localStorage.setItem(`timing_break_${matchId}`, String(this.tempBreakDuration));
    }
    this.timingModalOpen.set(false);
  }

  phaseLabel(): string {
    switch (this.currentPhase()) {
      case 'first': return '1. omgang';
      case 'break': return 'Pause';
      case 'second': return '2. omgang';
      case 'done': return 'Ferdig';
      default: return '';
    }
  }
  readonly showOnField = signal(true);
  readonly showBench = signal(true);
  readonly showEvents = signal(true);
  readonly presentIds = signal<Set<string>>(new Set());
  readonly absentIds = signal<Set<string>>(new Set());
  readonly swappedInPlayers = signal<{ player: Player; replacedName: string }[]>([]);
  readonly allClientPlayers = signal<Player[]>([]);

  playerNumber(playerId: string | undefined): number | undefined {
    if (!playerId) return undefined;
    return this.allClientPlayers().find(p => p.id === playerId)?.number;
  }

  playerInitials(name: string | undefined): string {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }

  playerShortName(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    const initials = parts.slice(1).map(p => p[0].toUpperCase()).join('');
    return `${parts[0]} ${initials}`;
  }

  subOutPlayerIdFromNote(note: string | undefined): string | undefined {
    if (!note) return undefined;
    const m = note.match(/^outId:([^|]+)/);
    return m?.[1];
  }

  outPlayerName(outId: string | undefined): string | undefined {
    if (!outId) return undefined;
    return this.allClientPlayers().find(p => p.id === outId)?.name;
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
    const assignedNames = new Set([
      ...(this.item()?.players ?? []).map(p => p.name),
      ...this.swappedInPlayers().map(s => s.player.name)
    ]);
    const seenIds = new Set<string>();
    return this.allClientPlayers()
      .filter(p => {
        if (assignedIds.has(p.id) || assignedNames.has(p.name)) return false;
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      })
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  });

  toggleStarter(player: Player) {
    if (this.lineupLocked()) return;
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
      checkmarkCircle, checkmarkCircleOutline, ellipseOutline, trashOutline,
      personOutline, closeOutline, chevronDownOutline, shirtOutline,
      lockClosedOutline, lockOpenOutline, personRemoveOutline,
      pauseOutline, playOutline, timerOutline
    });
  }

  ngOnDestroy() {
    if (this._tickInterval) clearInterval(this._tickInterval);
  }

  async ngOnInit() {
    this._tickInterval = setInterval(() => this._tick.update(t => t + 1), 1000);
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

  async markFullTime() {
    const match = this.item()?.match;
    if (!match?.id) return;
    const home = this.homeGoals();
    const away = this.awayGoals();
    const alert = await this.alert.create({
      header: 'Sett kampen som ferdigspilt',
      message: `Sluttresultat: ${match.homeTeam} ${home} – ${away} ${match.awayTeam}`,
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        {
          text: 'Bekreft',
          handler: async () => {
            await this.matchesSvc.update({ ...match, homeScore: home, awayScore: away });
            this.item.update(curr => curr ? { ...curr, match: { ...curr.match, homeScore: home, awayScore: away } } : curr);
            this.showToast('✅ Kamp satt som ferdigspilt', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  async quickCard(side: 'home' | 'away', type: 'yellow' | 'red') {
    const matchId = this.item()?.match.id;
    if (!matchId) return;
    const label = type === 'yellow' ? 'Gult kort' : 'Rødt kort';
    const alert = await this.alert.create({
      header: label,
      message: 'Trøyenummer motspiller (valgfritt)',
      inputs: [{ name: 'number', type: 'number', placeholder: 'Trøyenummer' }],
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        {
          text: 'Registrer',
          handler: (data) => {
            const num = data.number ? String(data.number) : undefined;
            const eventType: MatchEventType = type === 'yellow' ? 'yellow_card' : 'red_card';
            this.eventsService.addOptimistic(matchId, eventType, { playerName: num ? `#${num}` : undefined, note: side });
            this.showToast(type === 'yellow' ? '🟨 Gult kort registrert' : '🟥 Rødt kort registrert', 'warning');
          }
        }
      ]
    });
    await alert.present();
  }

  async quickGoal(side: 'home' | 'away') {
    const matchId = this.item()?.match.id;
    if (!matchId) return;
    const alert = await this.alert.create({
      header: side === 'home' ? 'Mål hjemme' : 'Mål borte',
      message: 'Trøyenummer motspiller (valgfritt)',
      inputs: [{ name: 'number', type: 'number', placeholder: 'Trøyenummer' }],
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        {
          text: 'Registrer',
          handler: (data) => {
            const num = data.number ? String(data.number) : undefined;
            this.eventsService.addOptimistic(matchId, 'goal', { note: side, playerName: num ? `#${num}` : undefined });
            this.showToast(side === 'home' ? '⚽ Mål hjemme!' : '⚽ Mål borte!', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  private suggestMinute(): number | null {
    const match = this.item()?.match;
    if (!match?.date || !match?.time) return null;
    const start = new Date(`${match.date}T${match.time}`);
    const elapsed = Math.floor((Date.now() - start.getTime()) / 60000);
    return elapsed >= 1 && elapsed <= 120 ? elapsed : null;
  }

  openEvent(type: 'yellow' | 'red' | 'goal_home' | 'goal_away') {
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
    if (action === 'goal_home' || action === 'goal_away') {
      const side = action === 'goal_home' ? 'home' : 'away';
      this.eventsService.addOptimistic(matchId, 'goal', {
        playerId: this.selectedPlayerId() || undefined,
        playerName: this.selectedPlayerName() || undefined,
        minute: this.pendingMinute ?? undefined,
        note: side,
      });
      this.eventModalOpen.set(false);
      this.showToast(side === 'home' ? '⚽ Mål hjemme!' : '⚽ Mål borte!', 'success');
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
      note: `outId:${outId}|Inn: ${inPlayer.name}, Ut: ${outPlayer?.name ?? outId}`,
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
