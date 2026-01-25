export type Team = {
  id: string;
  name: string;
  logoUrl: string;
  imageHint: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
};

export type Player = {
  id: string;
  name: string;
  teamId: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    highestScore: number;
    bestBowling: string; // e.g., "3/25"
  };
  isRetired: boolean;
};

export type Inning = {
  battingTeamId: string;
  bowlingTeamId: string;
  score: number;
  wickets: number;
  overs: number;
};

export type Match = {
  id: string;
  team1Id: string;
  team2Id: string;
  overs: number;
  status: 'live' | 'completed';
  tossWinnerId: string;
  tossDecision: 'bat' | 'bowl';
  innings: Inning[];
  currentInning: number; // 1 or 2
  result?: string;
  summary?: string;
  date: string;
};
