// This file mocks some of the data that would typically come from Firestore
// for the CricMates application to ensure it's functional in a scaffolded state.

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

export const MOCK_TEAMS: Team[] = [
  { id: 't1', name: 'Blue Warriors', logoUrl: 'https://picsum.photos/seed/team1/100/100', stats: { played: 5, won: 4, lost: 1, nrr: 1.25, points: 8 } },
  { id: 't2', name: 'Teal Titans', logoUrl: 'https://picsum.photos/seed/team2/100/100', stats: { played: 5, won: 3, lost: 2, nrr: 0.45, points: 6 } },
  { id: 't3', name: 'Navy Knights', logoUrl: 'https://picsum.photos/seed/team3/100/100', stats: { played: 5, won: 2, lost: 3, nrr: -0.12, points: 4 } },
  { id: 't4', name: 'Red Rebels', logoUrl: 'https://picsum.photos/seed/team4/100/100', stats: { played: 5, won: 1, lost: 4, nrr: -1.58, points: 2 } },
];

export const MOCK_PLAYERS: Player[] = [
  { id: 'p1', name: 'Rohit Sharma', role: 'Batsman', teamId: 't1', stats: { matches: 10, runs: 450, wickets: 0, cvp: 156 } },
  { id: 'p2', name: 'Jasprit Bumrah', role: 'Bowler', teamId: 't1', stats: { matches: 10, runs: 45, wickets: 22, cvp: 210 } },
  { id: 'p3', name: 'Hardik Pandya', role: 'All-rounder', teamId: 't2', stats: { matches: 10, runs: 320, wickets: 12, cvp: 188 } },
  { id: 'p4', name: 'Virat Kohli', role: 'Batsman', teamId: 't2', stats: { matches: 10, runs: 510, wickets: 0, cvp: 172 } },
];

export const MOCK_MATCHES = [
  {
    id: 'm1',
    team1: MOCK_TEAMS[0],
    team2: MOCK_TEAMS[1],
    status: 'live',
    currentScore: { team1: '145/4 (18.2)', team2: 'Yet to bat' },
    summary: 'Warriors in control after a solid opening stand.'
  },
  {
    id: 'm2',
    team1: MOCK_TEAMS[2],
    team2: MOCK_TEAMS[3],
    status: 'completed',
    result: 'Navy Knights won by 24 runs',
    currentScore: { team1: '168/6', team2: '144/9' },
    summary: 'A disciplined bowling performance sealed the win.'
  }
];