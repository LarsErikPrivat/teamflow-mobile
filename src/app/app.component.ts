import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  template: `<ion-app><ion-router-outlet /></ion-app>`,
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);

  async ngOnInit() {
    await this.auth.init();
  }
}
