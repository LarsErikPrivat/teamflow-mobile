import { Component } from '@angular/core';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { todayOutline, listOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="today" href="/tabs/today">
          <ion-icon name="today-outline" />
          <ion-label>I dag</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="events" href="/tabs/events">
          <ion-icon name="list-outline" />
          <ion-label>Hendelser</ion-label>
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
    addIcons({ todayOutline, listOutline, settingsOutline });
  }
}
