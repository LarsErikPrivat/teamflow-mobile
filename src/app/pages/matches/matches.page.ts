import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons,
  IonIcon, IonModal, IonInput, IonSelect, IonSelectOption,
  IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonNote,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, pencilOutline, trashOutline, checkmarkOutline, calendarOutline } from 'ionicons/icons';
import { MatchesService } from '../../core/services/matches.service';
import { TeamsService } from '../../core/services/teams.service';
import { Match } from '../../core/models/match.model';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons,
    IonIcon, IonModal, IonInput, IonSelect, IonSelectOption,
    IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonNote
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Kamper</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openNew()">
            <ion-icon name="add-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <ion-accordion-group class="team-accordions" [value]="expandedTeam()">
        @for (group of matchesByTeam(); track group.teamId) {
          <ion-accordion [value]="group.teamId" (ionChange)="onAccordionChange($event, group.teamId)">
            <ion-item slot="header" class="team-header">
              <div class="team-dot" [style.background]="group.color"></div>
              <ion-label>
                <h2>{{ group.teamName }}</h2>
                <ion-note>{{ group.matches.length }} kamper · Nivå {{ group.level }}</ion-note>
              </ion-label>
              <ion-button slot="end" fill="clear" size="small" (click)="openNewForTeam(group.teamId, $event)">
                <ion-icon name="add-outline" slot="icon-only" class="add-icon" />
              </ion-button>
            </ion-item>

            <div slot="content" class="match-list">
              @for (match of group.matches; track match.id) {
                <div class="match-card" [style.--team-color]="group.color">
                  <div class="match-date">{{ match.date }} · {{ match.time }}</div>
                  <div class="match-teams">
                    <strong>{{ match.homeTeam }}</strong>
                    <span class="vs">–</span>
                    <strong>{{ match.awayTeam }}</strong>
                  </div>
                  <div class="match-footer">
                    <span class="level-pill">Nivå {{ match.matchLevel }}</span>
                    <span class="home-pill">{{ match.homeGame ? 'Hjemme' : 'Borte' }}</span>
                    <div class="match-actions">
                      <ion-button fill="clear" size="small" (click)="edit(match)">
                        <ion-icon name="pencil-outline" slot="icon-only" class="action-icon" />
                      </ion-button>
                      <ion-button fill="clear" size="small" (click)="remove(match)">
                        <ion-icon name="trash-outline" slot="icon-only" class="action-icon danger" />
                      </ion-button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="empty-matches">Ingen kamper registrert</div>
              }
            </div>
          </ion-accordion>
        }
      </ion-accordion-group>
    </ion-content>

    <!-- Add/Edit Modal -->
    <ion-modal [isOpen]="modalOpen()" (didDismiss)="closeModal()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editMode() ? 'Rediger kamp' : 'Ny kamp' }}</ion-title>
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
            <div class="field-label">Lag</div>
            <ion-select class="form-select" [(ngModel)]="formTeamId" fill="outline" interface="action-sheet" placeholder="Velg lag">
              @for (team of teams(); track team.id) {
                <ion-select-option [value]="team.id">{{ team.name }}</ion-select-option>
              }
            </ion-select>
          </div>

          <div class="form-row">
            <div class="form-section half">
              <div class="field-label">Dato</div>
              <ion-input class="form-input" type="date" [(ngModel)]="formDate" fill="outline" />
            </div>
            <div class="form-section half">
              <div class="field-label">Tid</div>
              <ion-input class="form-input" type="time" [(ngModel)]="formTime" fill="outline" />
            </div>
          </div>

          <div class="form-section">
            <div class="field-label">Hjemmelag</div>
            <ion-input class="form-input" [(ngModel)]="formHomeTeam" placeholder="Hjemmelag" fill="outline" />
          </div>

          <div class="form-section">
            <div class="field-label">Bortelag</div>
            <ion-input class="form-input" [(ngModel)]="formAwayTeam" placeholder="Bortelag" fill="outline" />
          </div>

          <div class="form-row">
            <div class="form-section half">
              <div class="field-label">Nivå</div>
              <ion-select class="form-select" [(ngModel)]="formLevel" fill="outline" interface="action-sheet">
                <ion-select-option [value]="1">Nivå 1</ion-select-option>
                <ion-select-option [value]="2">Nivå 2</ion-select-option>
                <ion-select-option [value]="3">Nivå 3</ion-select-option>
              </ion-select>
            </div>
            <div class="form-section half">
              <div class="field-label">Bane</div>
              <ion-select class="form-select" [(ngModel)]="formHomeGame" fill="outline" interface="action-sheet">
                <ion-select-option [value]="true">Hjemme</ion-select-option>
                <ion-select-option [value]="false">Borte</ion-select-option>
              </ion-select>
            </div>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-toolbar { --background: #0F172A; --color: #F8FAFC; }
    .page-content { --background: #0F172A; }
    .team-accordions { padding: 12px; background: transparent; }

    .team-header {
      --background: #1E293B; --color: #F8FAFC;
      border-radius: 14px; margin-bottom: 4px;
    }
    .team-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 12px; flex-shrink: 0; }
    h2 { font-size: 15px; font-weight: 700; color: #F8FAFC; }
    ion-note { color: #64748B; font-size: 12px; }
    .add-icon { color: #10B981; font-size: 20px; }

    .match-list { background: #0F172A; padding: 8px 0 12px; }
    .match-card {
      background: #1E293B; border-left: 3px solid var(--team-color, #10B981);
      border-radius: 12px; padding: 12px 16px; margin: 6px 8px;
    }
    .match-date { font-size: 12px; color: #64748B; margin-bottom: 4px; }
    .match-teams { font-size: 15px; color: #F8FAFC; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .vs { color: #64748B; font-size: 12px; }
    .match-footer { display: flex; align-items: center; gap: 8px; }
    .level-pill, .home-pill { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 8px; }
    .level-pill { background: #10B98120; color: #10B981; }
    .home-pill  { background: #3B82F620; color: #3B82F6; }
    .match-actions { margin-left: auto; display: flex; gap: 4px; }
    .action-icon { color: #64748B; font-size: 16px; }
    .action-icon.danger { color: #EF4444; }
    .empty-matches { color: #64748B; text-align: center; padding: 16px; font-size: 14px; }

    .modal-content { --background: #0F172A; }
    .form-section { padding: 16px 16px 0; }
    .form-section.half { flex: 1; padding: 16px 8px 0; }
    .form-row { display: flex; padding: 0 8px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 1px; margin-bottom: 8px; }
    .form-input, .form-select {
      --background: #1E293B; --color: #F8FAFC;
      --placeholder-color: #64748B; --border-color: #334155;
      border-radius: 10px;
    }
  `]
})
export class MatchesPage {
  private matchesSvc = inject(MatchesService);
  private teamsSvc   = inject(TeamsService);
  private alert      = inject(AlertController);
  private toast      = inject(ToastController);

  readonly teams = this.teamsSvc.teams;
  modalOpen  = signal(false);
  editMode   = signal(false);
  editId     = signal('');
  expandedTeam = signal<string | undefined>(undefined);

  formTeamId  = '';
  formDate    = '';
  formTime    = '';
  formHomeTeam = '';
  formAwayTeam = '';
  formLevel   = signal<1 | 2 | 3>(1);
  formHomeGame = signal(true);

  constructor() {
    addIcons({ addOutline, pencilOutline, trashOutline, checkmarkOutline, calendarOutline });
  }

  matchesByTeam = computed(() => {
    const teams   = this.teamsSvc.teams();
    const matches = this.matchesSvc.matches();
    return teams.map(t => ({
      teamId:   t.id,
      teamName: t.name,
      level:    t.level,
      color:    (t as any).color ?? (t.isHospiteringTeam ? '#A855F7' : '#3B82F6'),
      matches:  matches.filter(m => m.teamId === t.id)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    }));
  });

  onAccordionChange(ev: any, teamId: string) {
    const value = ev.detail?.value;
    this.expandedTeam.set(value === teamId ? teamId : undefined);
  }

  openNew() {
    this.resetForm();
    this.editMode.set(false);
    this.modalOpen.set(true);
  }

  openNewForTeam(teamId: string, event: Event) {
    event.stopPropagation();
    this.resetForm();
    this.formTeamId = teamId;
    this.formLevel.set(this.teamsSvc.teams().find(t => t.id === teamId)?.level ?? 1);
    this.editMode.set(false);
    this.modalOpen.set(true);
  }

  edit(match: Match) {
    this.editId.set(match.id);
    this.formTeamId   = match.teamId;
    this.formDate     = match.date;
    this.formTime     = match.time;
    this.formHomeTeam = match.homeTeam;
    this.formAwayTeam = match.awayTeam;
    this.formLevel.set(match.matchLevel);
    this.formHomeGame.set(match.homeGame ?? true);
    this.editMode.set(true);
    this.modalOpen.set(true);
  }

  async save() {
    if (!this.formTeamId || !this.formDate || !this.formTime || !this.formHomeTeam.trim() || !this.formAwayTeam.trim()) {
      const a = await this.alert.create({ header: 'Mangler felt', message: 'Fyll ut alle feltene.', buttons: ['OK'] });
      await a.present();
      return;
    }

    const match: Match = {
      id: this.editMode() ? this.editId() : crypto.randomUUID(),
      teamId:   this.formTeamId,
      date:     this.formDate,
      time:     this.formTime,
      homeTeam: this.formHomeTeam.trim(),
      awayTeam: this.formAwayTeam.trim(),
      matchLevel: this.formLevel(),
      homeGame:   this.formHomeGame(),
    };

    try {
      if (this.editMode()) {
        await this.matchesSvc.update(match);
      } else {
        await this.matchesSvc.add(match);
      }
      this.expandedTeam.set(match.teamId);
      this.closeModal();
      const t = await this.toast.create({ message: this.editMode() ? 'Kamp oppdatert' : 'Kamp lagt til', duration: 1800, color: 'success', position: 'top' });
      await t.present();
    } catch (e: any) {
      const a = await this.alert.create({ header: 'Feil', message: e?.message ?? 'Noe gikk galt', buttons: ['OK'] });
      await a.present();
    }
  }

  async remove(match: Match) {
    const a = await this.alert.create({
      header: 'Slett kamp',
      message: `Slett ${match.homeTeam} – ${match.awayTeam}?`,
      buttons: [
        { text: 'Avbryt', role: 'cancel' },
        { text: 'Slett', role: 'destructive', handler: async () => {
          await this.matchesSvc.remove(match.id);
          const t = await this.toast.create({ message: 'Kamp slettet', duration: 1800, color: 'warning', position: 'top' });
          await t.present();
        }}
      ]
    });
    await a.present();
  }

  closeModal() { this.modalOpen.set(false); }

  private resetForm() {
    this.editId.set(crypto.randomUUID());
    this.formTeamId   = '';
    this.formDate     = '';
    this.formTime     = '';
    this.formHomeTeam = '';
    this.formAwayTeam = '';
    this.formLevel.set(1);
    this.formHomeGame.set(true);
  }
}
