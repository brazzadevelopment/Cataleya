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
  /** Turnir je zaključen: PIN-ovi terena više ne vrijede, ide u arhivu. */
  closed_at?: string | null;
  /** Kartica u donjem izborniku: Indoor, Proljeće ili Jesen. */
  series?: SeriesKey | null;
}

export type SeriesKey = 'indoor' | 'proljece' | 'jesen';

/** Klub kroz sve turnire; momčad pripada klubu. */
export interface Club {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  logo_path: string | null;
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
  club_id?: string | null;
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
  /** Klubovi momčadi ovog turnira. */
  clubs: Club[];
}

/** owner = organizacija: svi turniri, novi turnir, klubovi. */
export type Role = 'admin' | 'field' | 'owner';

export interface Session {
  /** Prazno za organizaciju dok ne odabere turnir. */
  tournamentId: string;
  role: Role;
  fieldId: string | null;
  token: string;
}

// Sadržaj aplikacije (supabase/migrations/003_cataleya_sadrzaj.sql) -----------

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_path: string | null;
  published_at: string;
  is_published: boolean;
}

export interface GalleryItem {
  id: string;
  image_path: string;
  caption: string | null;
  tournament_id: string | null;
  sort_order: number;
  created_at?: string;
}

export interface Video {
  id: string;
  title: string;
  youtube_id: string;
  is_live: boolean;
  published_at: string;
}

export type SponsorTier = 'glavni' | 'zlatni' | 'partner';

export interface Sponsor {
  id: string;
  name: string;
  logo_path: string | null;
  url: string | null;
  tier: SponsorTier;
  sort_order: number;
  is_active: boolean;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  handled: boolean;
  created_at: string;
}

/** Sve što javne stranice trebaju osim turnira. */
export interface SiteContent {
  news: NewsItem[];
  gallery: GalleryItem[];
  videos: Video[];
  sponsors: Sponsor[];
  settings: Record<string, string>;
}
