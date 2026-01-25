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

export type Match = {
  id: string;
  team1: Team;
  team2: Team;
  date: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed';
  tossWinner: string; // teamId
  tossDecision: 'bat' | 'bowl';
  result: string; // e.g., "Team A won by 5 wickets"
  summary: string;
};
