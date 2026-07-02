export type SeasonHalf = 'SPRING' | 'AUTUMN';

export interface Season {
  id: string;
  year: number;
  half: SeasonHalf;
  name: string;
  archived: boolean;
}
