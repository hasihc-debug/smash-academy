
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: 'COACH' | 'PLAYER';
  linkedPlayerId?: string;
  subscriptionStatus?: 'free' | 'pro';
  subscriptionId?: string;
}

export interface Player {
  id: string;
  name: string;
  email?: string;
  age?: number | string;
  dob?: string;
  level: string;
  gender?: 'Male' | 'Female' | '';
  hand?: 'Right' | 'Left' | '';
  phone?: string;
  parentName?: string;
  notes?: string;
  photoUrl?: string;
  strength?: string;
  weakness?: string;
  playerGoal?: string;
  coachGoal?: string;
  t1Name?: string;
  t1Date?: string;
  t1Priority?: string;
  t2Name?: string;
  t2Date?: string;
  t2Priority?: string;
  joinedDate?: string;
  achievements?: string;
  ageCategory?: 'U11' | 'U13' | 'U15' | 'U17' | 'U19' | 'Open' | '';
  createdAt?: string;
  linkedUid?: string;
  linkedEmail?: string;
  userId?: string;
  // Financial Fields
  pricingTier?: 'Elite' | 'Kids';
  sessionFrequency?: number; // 1-5 days/week
  extraSessions?: number;
  individualSessionsCount?: number;
  individualSessionRate?: number;
  extraSessionRateOverride?: number;
  groupSessionRateOverride?: number; 
  customFrequencyRates?: Record<number, number>; // New: Custom rates for 1D, 2D, 3D, etc.
  monthlyFee?: number;
}

export interface StudentPayment {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  month: number; // 0-11
  year: number;
  date: string;
  method: 'Cash' | 'Bank Transfer';
  reference?: string;
  status: 'paid' | 'pending';
  frequency: number;
  extraSessions: number;
  extraSessionRate: number;
  userId: string;
}

export interface CoachSalary {
  id: string;
  coachName: string;
  amount: number;
  month: number; // 0-11
  year: number;
  date: string;
  method: 'Cash' | 'Bank Transfer';
  reference?: string;
  groupSessions: number;
  individualSessions: number;
  groupRate: number;
  individualRate: number;
  status: 'paid' | 'pending';
  userId: string;
}

export interface AccessRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  playerId: string;
  playerName: string;
  coachId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Session {
  id: string;
  startTime: string;
  endTime: string;
  description: string;
  type?: string;
  attendees?: string[];
  intensity?: number;
  drills?: string;
  coach?: string;
  location?: string;
}

export interface AcademySettings {
  name: string;
  logoUrl: string;
  dashboardTitle?: string;
}

export type TournamentLevel = 'Club' | 'District' | 'National' | 'International';

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  location?: string;
  level: TournamentLevel;
  createdAt: string;
}

export type RoundReached = 'R64' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'CHAMPION';

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  playerId: string;
  eventType?: 'Singles' | 'Doubles' | 'Mixed';
  roundReached: RoundReached;
  notes?: string;
  createdAt: string;
  tournamentName?: string;
  tournamentDate?: string;
}

export const ROUND_SCORES: Record<string, number> = {
  'R64': 0.5, 'R32': 1, 'R16': 2, 'QF': 3, 'SF': 4, 'F': 5, 'CHAMPION': 6
};

// Default Elite Group Pricing
export const ELITE_PRICES: Record<number, number> = {
  1: 10000,
  2: 19000,
  3: 27000,
  4: 34000,
  5: 40000
};

// Default Kids Group Pricing
export const KIDS_PRICES: Record<number, number> = {
  1: 6000,
  2: 10000
};

export const EXTRA_SESSION_PRICE = 1000;
