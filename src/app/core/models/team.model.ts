export interface Team {
  seasonId?: string;
  id: string;
  name: string;
  level: 1 | 2 | 3;
  isHospiteringTeam: boolean;
  color?: string;
}
