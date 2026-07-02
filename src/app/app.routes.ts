import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'players',
        loadComponent: () => import('./pages/players/players.page').then(m => m.PlayersPage),
      },
      {
        path: 'matches',
        loadComponent: () => import('./pages/matches/matches.page').then(m => m.MatchesPage),
      },
      {
        path: 'distribution',
        loadComponent: () => import('./pages/distribution/distribution.page').then(m => m.DistributionPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
];
