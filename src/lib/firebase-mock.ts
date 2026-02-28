// This file defines the data structures and provides empty arrays
// for the CricMates application, ready to be populated.

export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  teamId: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    cvp: number;
  };
}

export interface Team {
  id: string;
  name: string;
  logoUrl: string;
  stats: {
    played: number;
    won: number;
    lost: number;
    nrr: number;
    points: number;
  };
}

export interface Match {
  id: string;
  team1: Team;
  team2: Team;
  status: 'live' | 'completed';
  currentScore: { team1: string; team2: string };
  summary: string;
  result?: string;
}

export const MOCK_TEAMS: Team[] = [];

export const MOCK_PLAYERS: Player[] = [];

export const MOCK_MATCHES: Match[] = [];
