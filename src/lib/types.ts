// Isti oblik kao tablice u supabase/schema.sql.

export type Tiebreaker =
  | 'head_to_head'
  | 'goal_difference'
  | 'goals_for'
  | 'wins'
  | 'fewer_goals_against'
  | 'fewer_cards'
  | 'lot';

export type MatchStage =
  | 'group'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'final'
  | 'placement';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  place: string | null;
  venue: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  timezone: string;
  logo_path: string | null;
  cover_path: string | null;
  color_primary: string;
  color_secondary: string;
  description: string | null;
  rules: string | null;
  points_win: number;
  points_draw: number;
  points_loss: number;
  tiebreakers: Tiebreaker[];
  scorers_enabled: boolean;
  is_published: boolean;
}

export interface Category {
  id: string;
  tournament_id: string;
  name: string;
  birth_year: number | null;
  match_minutes: number;
  players_on_field: number | null;
  sort_order: number;
}

export interface Field {
  id: string;
  tournament_id: string;
  name: string;
  venue: string | null;
  maps_url: string | null;
  sort_order: number;
}

export interface Team {
  id: string;
  tournament_id: string;
  category_id: string;
  name: string;
  short_name: string | null;
  logo_path: string | null;
}

export interface Group {
  id: string;
  tournament_id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

export interface GroupTeam {
  tournament_id: string;
  category_id: string;
  group_id: string;
  team_id: string;
  lot_rank: number | null;
}

export interface Match {
  id: string;
  tournament_id: string;
  category_id: string;
  stage: MatchStage;
  group_id: string | null;
  code: string | null;
  label: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_source: string | null;
  away_source: string | null;
  field_id: string | null;
  starts_at: string | null; // ISO
  duration_minutes: number | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  status: MatchStatus;
  home_yellow: number;
  away_yellow: number;
  home_red: number;
  away_red: number;
  /** Ždrijeb kojem utakmica pripada, npr. 'A' ili 'B' turnir. */
  bracket: string | null;
  winner_place: number | null;
  loser_place: number | null;
  teams_locked: boolean;
  updated_at?: string;
}

/** Sve što aplikacija zna o jednom turniru. */
export interface Snapshot {
  tournament: Tournament;
  categories: Category[];
  fields: Field[];
  teams: Team[];
  groups: Group[];
  groupTeams: GroupTeam[];
  matches: Match[];
}

export type Role = 'admin' | 'field';

export interface Session {
  tournamentId: string;
  role: Role;
  fieldId: string | null;
  token: string;
}
