import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'match/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/match-detail/match-detail.page').then(m => m.MatchDetailPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'today',
        loadComponent: () => import('./pages/today/today.page').then(m => m.TodayPage),
      },
      {
        path: 'events',
        loadComponent: () => import('./pages/events/events.page').then(m => m.EventsPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage),
      },
      { path: '', redirectTo: 'today', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
];
