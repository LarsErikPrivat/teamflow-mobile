import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
  IonList, IonItem, IonLabel, IonNote, IonButton, IonButtons,
  IonIcon, IonModal, IonInput, IonSelect, IonSelectOption,
  IonToggle, AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, pencilOutline, trashOutline, checkmarkOutline } from 'ionicons/icons';
import { PlayersService } from '../../core/services/players.service';
import { PositionsService } from '../../core/services/positions.service';
import { SettingsService } from '../../core/services/settings.service';
import { Player, PlayerLevel, PlayerMatchMatrix } from '../../core/models/player.model';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
    IonList, IonItem, IonLabel, IonNote, IonButton, IonButtons,
    IonIcon, IonModal, IonInput, IonSelect, IonSelectOption, IonToggle
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Spillere ({{ filtered().length }})</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openNew()">
            <ion-icon name="add-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar [(ngModel)]="search" placeholder="Søk spiller..." debounce="200" />
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <ion-list class="player-list">
        @for (player of filtered(); track player.id) {
          <ion-item class="player-item" lines="none">
            <div class="avatar" slot="start" [style.background]="levelColor(player.level)">
              {{ player.name.charAt(0) }}
            </div>
            <ion-label>
              <h2>{{ player.name }}</h2>
              <ion-note>Nivå {{ player.level }} · {{ player.available ? 'Tilgjengelig' : 'Utilgjengelig' }}</ion-note>
            </ion-label>
            <ion-buttons slot="end">
              <ion-button fill="clear" (click)="edit(player)">
                <ion-icon name="pencil-outline" slot="icon-only" class="action-icon" />
              </ion-button>
              <ion-button fill="clear" (click)="remove(player)">
                <ion-icon name="trash-outline" slot="icon-only" class="action-icon danger" />
              </ion-button>
            </ion-buttons>
          </ion-item>
        } @empty {
          <ion-item lines="none">
            <ion-label class="empty-label">Ingen spillere funnet</ion-label>
          </ion-item>
        }
      </ion-list>
    </ion-content>

    <!-- Add/Edit Modal -->
    <ion-modal [isOpen]="modalOpen()" (didDismiss)="closeModal()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editMode() ? 'Rediger spiller' : 'Ny spiller' }}</ion-title>
            <ion-buttons slot="start">
              <ion-button (click)="closeModal()">Avbryt</ion-button>
            </ion-buttons>
            <ion-buttons slot="end">
              <ion-button (click)="save()" [strong]="true">
                <ion-icon name="checkmark-outline" slot="icon-only" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="form-section">
            <div class="field-label">Navn</div>
            <ion-input
              class="form-input"
              [(ngModel)]="formName"
              placeholder="Fullt navn"
              fill="outline"
            />
          </div>

          <div class="form-section">
            <div class="field-label">Nivå</div>
            <ion-select
              class="form-select"
              [(ngModel)]="formLevel"
              (ngModelChange)="onLevelChange($event)"
              fill="outline"
              interface="action-sheet"
            >
              <ion-select-option [value]="1">Nivå 1</ion-select-option>
              <ion-select-option [value]="2">Nivå 2</ion-select-option>
              <ion-select-option [value]="3">Nivå 3</ion-select-option>
            </ion-select>
          </div>

          <div class="form-section">
            <div class="field-label">Tilgjengelig</div>
            <ion-item class="toggle-item" lines="none">
              <ion-toggle [(ngModel)]="formAvailable" color="success">
                {{ formAvailable ? 'Ja' : 'Nei' }}
              </ion-toggle>
            </ion-item>
          </div>

          <div class="form-section">
            <div class="field-label">Kampmatrise — Egne kamper</div>
            <div class="matrix-grid">
              <div class="matrix-row">
                <span class="matrix-label">E1</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.ownLevel1Target" fill="outline" min="0" />
              </div>
              <div class="matrix-row">
                <span class="matrix-label">E2</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.ownLevel2Target" fill="outline" min="0" />
              </div>
              <div class="matrix-row">
                <span class="matrix-label">E3</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.ownLevel3Target" fill="outline" min="0" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="field-label">Kampmatrise — Hospitering</div>
            <div class="matrix-grid">
              <div class="matrix-row">
                <span class="matrix-label">H1</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.hospiteringLevel1Target" fill="outline" min="0" />
              </div>
              <div class="matrix-row">
                <span class="matrix-label">H2</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.hospiteringLevel2Target" fill="outline" min="0" />
              </div>
              <div class="matrix-row">
                <span class="matrix-label">H3</span>
                <ion-input class="matrix-input" type="number" [(ngModel)]="formMatrix.hospiteringLevel3Target" fill="outline" min="0" />
              </div>
            </div>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    ion-searchbar { --background: #1E293B; --color: #F8FAFC; --placeholder-color: #64748B; --icon-color: #64748B; }
    .page-content { --background: #0F172A; }
    .player-list { background: transparent; padding: 8px 12px; }

    .player-item {
      --background: #1E293B; --color: #F8FAFC;
      --border-radius: 14px; --padding-start: 12px; --inner-padding-end: 4px;
      margin-bottom: 8px; border-radius: 14px;
    }
    .avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; color: white;
      flex-shrink: 0; margin-right: 12px;
    }
    h2 { font-size: 15px; font-weight: 600; color: #F8FAFC; margin: 0 0 2px; }
    ion-note { color: #64748B; font-size: 12px; }
    .action-icon { color: #64748B; font-size: 18px; }
    .action-icon.danger { color: #EF4444; }
    .empty-label { text-align: center; color: #64748B; }

    .modal-content { --background: #0F172A; }
    .form-section { padding: 16px 16px 0; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 1px; margin-bottom: 8px; }
    .form-input, .form-select {
      --background: #1E293B;
      --color: #F8FAFC;
      --placeholder-color: #475569;
      --border-color: #334155;
      --border-width: 1.5px;
      --border-style: solid;
      --border-radius: 12px;
      --padding-start: 14px;
      --padding-end: 14px;
      --padding-top: 14px;
      --padding-bottom: 14px;
      --highlight-color-focused: #10B981;
      border-radius: 12px;
      min-height: 52px;
    }
    .toggle-item { --background: transparent; --color: #F8FAFC; padding: 0; }
    .matrix-grid { display: flex; flex-direction: column; gap: 8px; }
    .matrix-row { display: flex; align-items: center; gap: 12px; }
    .matrix-label { font-size: 13px; font-weight: 700; color: #10B981; width: 28px; flex-shrink: 0; }
    .matrix-input {
      --background: #1E293B; --color: #F8FAFC;
      --border-color: #334155; --border-width: 1.5px; --border-style: solid;
      --border-radius: 10px; --padding-start: 10px; --highlight-color-focused: #10B981;
      flex: 1; border-radius: 10px; min-height: 44px;
    }
  `]
})
export class PlayersPage {
  private svc      = inject(PlayersService);
  private settings = inject(SettingsService);
  private alert    = inject(AlertController);
  private toast    = inject(ToastController);

  search = '';
  modalOpen  = signal(false);
  editMode   = signal(false);
  editId     = signal('');
  formName   = '';
  formLevel  = signal<PlayerLevel>(1);
  formAvailable = true;
  formMatrix: PlayerMatchMatrix = this.defaultMatrix(1);

  constructor() {
    addIcons({ addOutline, pencilOutline, trashOutline, checkmarkOutline });
  }

  filtered = computed(() => {
    const q = this.search.toLowerCase();
    return this.svc.players()
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'no'));
  });

  levelColor(level: number) {
    return level === 1 ? '#10B981' : level === 2 ? '#3B82F6' : '#A855F7';
  }

  openNew() {
    this.editMode.set(false);
    this.editId.set(crypto.randomUUID());
    this.formName = '';
    this.formLevel.set(1);
    this.formAvailable = true;
    this.formMatrix = this.defaultMatrix(1);
    this.modalOpen.set(true);
  }

  edit(player: Player) {
    this.editMode.set(true);
    this.editId.set(player.id);
    this.formName = player.name;
    this.formLevel.set(player.level);
    this.formAvailable = player.available;
    this.formMatrix = { ...player.matchMatrix };
    this.modalOpen.set(true);
  }

  onLevelChange(level: PlayerLevel) {
    this.formMatrix = this.defaultMatrix(level);
  }

  async save() {
    if (!this.formName.trim()) return;

    const player: Player = {
      id: this.editId(),
      name: this.formName.trim(),
      position: '',
      positions: [],
      level: this.formLevel(),
      available: this.formAvailable,
      matchMatrix: {
        ownLevel1Target: Math.max(0, Number(this.formMatrix.ownLevel1Target) || 0),
        ownLevel2Target: Math.max(0, Number(this.formMatrix.ownLevel2Target) || 0),
        ownLevel3Target: Math.max(0, Number(this.formMatrix.ownLevel3Target) || 0),
        hospiteringLevel1Target: Math.max(0, Number(this.formMatrix.hospiteringLevel1Target) || 0),
        hospiteringLevel2Target: Math.max(0, Number(this.formMatrix.hospiteringLevel2Target) || 0),
        hospiteringLevel3Target: Math.max(0, Number(this.formMatrix.hospiteringLevel3Target) || 0),
      }
    };

    try {
      if (this.editMode()) {
        await this.svc.update(player);
      } else {
        await this.svc.add(player);
      }
      this.closeModal();
      const t = await this.toast.create({ message: this.editMode() ? 'Spiller oppdatert' : 'Spiller lagt til', duration: 1800, color: 'success', position: 'top' });
      await t.present();
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message ?? 'Noe gikk galt', buttons: ['OK'] });
      await a.present();
    }
  }

  async remove(player: Player) {
    const a = await this.alert.create({
      header: 'Slett spiller',
      message: `Slett ${player.name}?`,
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Slett', role: 'destructive', handler: async () => {
          await this.svc.remove(player.id);
          const t = await this.toast.create({ message: 'Spiller slettet', duration: 1800, color: 'warning', position: 'top' });
          await t.present();
        }}
      ]
    });
    await a.present();
  }

  closeModal() { this.modalOpen.set(false); }

  private defaultMatrix(level: PlayerLevel): PlayerMatchMatrix {
    const m = this.settings.settings().defaultMatchMatrix;
    const src = level === 1 ? m.level1 : level === 2 ? m.level2 : m.level3;
    return { ...src };
  }
}
