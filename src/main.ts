import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(routes),
    provideHttpClient(), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
});
