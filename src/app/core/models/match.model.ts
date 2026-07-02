export interface Match {
  seasonId?: string;
  id: string;
  teamId: string;

  date: string;
  time: string;

  matchLevel: 1 | 2 | 3;

  homeTeam: string;
  awayTeam: string;

  homeGame?: boolean;

  required2014Players?: number;
}
