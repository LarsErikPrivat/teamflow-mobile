import { Component } from '@angular/core';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, peopleOutline, calendarOutline, gitNetworkOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard" href="/tabs/dashboard">
          <ion-icon name="home-outline" />
          <ion-label>Hjem</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="players" href="/tabs/players">
          <ion-icon name="people-outline" />
          <ion-label>Spillere</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="matches" href="/tabs/matches">
          <ion-icon name="calendar-outline" />
          <ion-label>Kamper</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="distribution" href="/tabs/distribution">
          <ion-icon name="git-network-outline" />
          <ion-label>Fordeling</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="settings" href="/tabs/settings">
          <ion-icon name="settings-outline" />
          <ion-label>Innstillinger</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      --background: #0F172A;
      --color: #64748B;
      --color-selected: #10B981;
      border-top: 1px solid #1E293B;
    }
  `]
})
export class TabsPage {
  constructor() {
    addIcons({ homeOutline, peopleOutline, calendarOutline, gitNetworkOutline, settingsOutline });
  }
}
