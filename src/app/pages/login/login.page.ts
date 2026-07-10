import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel,
  IonSpinner, IonText, ToastController
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonContent, IonButton, IonInput, IonItem, IonLabel, IonSpinner, IonText],
  template: `
    <ion-content class="login-content">
      <div class="login-container">
        <svg class="login-logo" viewBox="0 0 465 96" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(18, 6)">
            <line x1="36" y1="14" x2="20" y2="36" stroke="#E2E8F0" stroke-width="2.5"/>
            <line x1="36" y1="14" x2="52" y2="36" stroke="#E2E8F0" stroke-width="2.5"/>
            <line x1="20" y1="48" x2="6"  y2="68" stroke="#CBD5E1" stroke-width="2.5"/>
            <line x1="20" y1="48" x2="36" y2="68" stroke="#CBD5E1" stroke-width="2.5"/>
            <line x1="52" y1="48" x2="36" y2="68" stroke="#CBD5E1" stroke-width="2.5"/>
            <line x1="52" y1="48" x2="66" y2="68" stroke="#CBD5E1" stroke-width="2.5"/>
            <circle cx="36" cy="14" r="12" fill="#FFFFFF"/>
            <circle cx="20" cy="42" r="12" fill="#FFFFFF"/>
            <circle cx="52" cy="42" r="12" fill="#FFFFFF"/>
            <circle cx="6"  cy="70" r="12" fill="#10B981"/>
            <circle cx="36" cy="70" r="12" fill="#10B981"/>
            <circle cx="66" cy="70" r="12" fill="#10B981"/>
          </g>
          <line x1="108" y1="8" x2="108" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>
          <text x="124" y="62" font-size="46" font-weight="900" letter-spacing="-1.5" font-family="Helvetica Neue, Arial, sans-serif">
            <tspan fill="#FFFFFF">Team</tspan><tspan fill="#10B981">Flow</tspan>
          </text>
        </svg>
        <p class="login-subtitle">Kampfordeling gjort enkelt</p>

        <div class="login-form">
          <ion-item class="login-item">
            <ion-input
              type="email"
              placeholder="E-postadresse"
              [(ngModel)]="email"
              autocomplete="email"
            />
          </ion-item>

          <ion-item class="login-item">
            <ion-input
              type="password"
              placeholder="Passord"
              [(ngModel)]="password"
            />
          </ion-item>

          @if (error()) {
            <ion-text color="danger">
              <p class="error-msg">{{ error() }}</p>
            </ion-text>
          }

          <ion-button
            expand="block"
            class="login-btn"
            [disabled]="loading()"
            (click)="login()"
          >
            @if (loading()) {
              <ion-spinner name="crescent" />
            } @else {
              Logg inn
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: #0F172A;
    }
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 48px 24px;
      box-sizing: border-box;
      padding-bottom: 20vh;
    }
    .login-logo {
      width: 240px;
      height: auto;
      margin-bottom: 16px;
    }
    .login-subtitle {
      color: #64748B;
      font-size: 15px;
      margin-bottom: 56px;
    }
    .login-form {
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .login-item {
      --background: #1E293B;
      --color: #F8FAFC;
      --border-color: #334155;
      --border-radius: 12px;
      --padding-start: 16px;
      border-radius: 12px;
      margin-bottom: 4px;
    }
    .login-btn {
      --background: #10B981;
      --background-activated: #059669;
      --border-radius: 12px;
      --color: white;
      font-weight: 700;
      margin-top: 8px;
      height: 52px;
    }
    .error-msg {
      color: #EF4444;
      font-size: 14px;
      text-align: center;
      margin: 4px 0;
    }
  `]
})
export class LoginPage {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private toast  = inject(ToastController);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  async login() {
    if (!this.email || !this.password) {
      this.error.set('Fyll inn e-post og passord.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigate(['/tabs/today']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Innlogging feilet.');
    } finally {
      this.loading.set(false);
    }
  }
}
