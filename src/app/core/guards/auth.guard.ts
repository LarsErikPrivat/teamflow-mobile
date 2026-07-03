import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ClientService } from '../services/client.service';
import { SeasonsService } from '../services/season.service';
import { SettingsService } from '../services/settings.service';
import { TeamsService } from '../services/teams.service';
import { PlayersService } from '../services/players.service';
import { MatchesService } from '../services/matches.service';
import { PositionsService } from '../services/positions.service';
import { MatchOverridesService } from '../services/match-overrides.service';

export const authGuard = async () => {
  const auth     = inject(AuthService);
  const router   = inject(Router);
  const client   = inject(ClientService);
  const seasons  = inject(SeasonsService);
  const settings = inject(SettingsService);
  const teams    = inject(TeamsService);
  const players  = inject(PlayersService);
  const matches  = inject(MatchesService);
  const positions = inject(PositionsService);
  const overrides = inject(MatchOverridesService);

  await auth.init();

  if (!auth.authenticated()) {
    return router.createUrlTree(['/login']);
  }

  // Load client context (clientId, role) if not already done
  if (!client.clientId()) {
    try {
      await client.ensureClientLoaded();
    } catch (e) {
      console.error('Failed to load client', e);
      return router.createUrlTree(['/login']);
    }
  }

  // Super admin: load all clients and restore previously selected client
  if (client.isSuperAdmin()) {
    await client.loadClients();
    const savedClientId = localStorage.getItem('active-client-id');
    if (savedClientId && savedClientId !== client.clientId()) {
      const saved = client.clients().find(c => c.id === savedClientId);
      if (saved) {
        await client.setActiveClient(saved);
      }
    }
  }

  // Load seasons first (other services depend on activeSeason)
  await seasons.load();

  // Load everything in parallel
  await Promise.all([
    settings.load(),
    teams.load(),
    players.load(),
    matches.load(),
    positions.load(),
    overrides.load(),
  ]);

  return true;
};
