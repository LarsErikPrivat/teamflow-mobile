export type MatchEventType = 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'emergency_replacement' | 'attendance';

export interface MatchEvent {
  id: string;
  clientId: string;
  seasonId: string;
  matchId: string;
  eventType: MatchEventType;
  playerId?: string;
  playerName?: string;
  minute?: number;
  note?: string;
  createdAt: string;
}
