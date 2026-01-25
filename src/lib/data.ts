import type { Team, Player } from './types';

const players_team1: Player[] = [
  { id: 'p1', name: 'Ravi Jadeja', teamId: 't1', role: 'All-rounder', stats: { matches: 5, runs: 150, wickets: 7, highestScore: 55, bestBowling: '3/25' }, isRetired: false },
  { id: 'p2', name: 'MS Dhoni', teamId: 't1', role: 'Wicket-keeper', stats: { matches: 5, runs: 210, wickets: 0, highestScore: 78, bestBowling: 'N/A' }, isRetired: false },
  { id: 'p3', name: 'Suresh Raina', teamId: 't1', role: 'Batsman', stats: { matches: 4, runs: 120, wickets: 1, highestScore: 60, bestBowling: '1/30' }, isRetired: true },
];

const players_team2: Player[] = [
  { id: 'p4', name: 'Virat Kohli', teamId: 't2', role: 'Batsman', stats: { matches: 5, runs: 300, wickets: 0, highestScore: 112, bestBowling: 'N/A' }, isRetired: false },
  { id: 'p5', name: 'AB de Villiers', teamId: 't2', role: 'Batsman', stats: { matches: 5, runs: 250, wickets: 0, highestScore: 99, bestBowling: 'N/A' }, isRetired: false },
  { id: 'p6', name: 'Yuzvendra Chahal', teamId: 't2', role: 'Bowler', stats: { matches: 5, runs: 30, wickets: 10, highestScore: 15, bestBowling: '4/18' }, isRetired: false },
];

const players_team3: Player[] = [
    { id: 'p7', name: 'Rohit Sharma', teamId: 't3', role: 'Batsman', stats: { matches: 5, runs: 280, wickets: 0, highestScore: 120, bestBowling: 'N/A' }, isRetired: false },
    { id: 'p8', name: 'Jasprit Bumrah', teamId: 't3', role: 'Bowler', stats: { matches: 5, runs: 20, wickets: 12, highestScore: 10, bestBowling: '5/15' }, isRetired: false },
];

const players_team4: Player[] = [
    { id: 'p9', name: 'KL Rahul', teamId: 't4', role: 'Wicket-keeper', stats: { matches: 5, runs: 220, wickets: 0, highestScore: 80, bestBowling: 'N/A' }, isRetired: false },
];

export const players: Player[] = [
  ...players_team1,
  ...players_team2,
  ...players_team3,
  ...players_team4,
];


export const teams: Team[] = [
  { 
    id: 't1', 
    name: 'Chennai Super Kings', 
    logoUrl: 'https://picsum.photos/seed/101/128/128', 
    imageHint: 'logo abstract',
    matchesPlayed: 5, matchesWon: 4, matchesLost: 1, matchesDrawn: 0 
  },
  { 
    id: 't2', 
    name: 'Royal Challengers', 
    logoUrl: 'https://picsum.photos/seed/102/128/128', 
    imageHint: 'logo dynamic',
    matchesPlayed: 5, matchesWon: 3, matchesLost: 2, matchesDrawn: 0 
  },
  { 
    id: 't3', 
    name: 'Mumbai Indians', 
    logoUrl: 'https://picsum.photos/seed/103/128/128', 
    imageHint: 'logo minimalist',
    matchesPlayed: 5, matchesWon: 2, matchesLost: 3, matchesDrawn: 0 
  },
  { 
    id: 't4', 
    name: 'Punjab Kings', 
    logoUrl: 'https://picsum.photos/seed/104/128/128', 
    imageHint: 'logo bold',
    matchesPlayed: 5, matchesWon: 1, matchesLost: 4, matchesDrawn: 0
  },
];
