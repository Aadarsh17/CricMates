'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { teams as initialTeams, players as initialPlayers } from '@/lib/data';
import type { Team, Player, Match, Inning } from '@/lib/types';

interface AppContextType {
  teams: Team[];
  players: Player[];
  matches: Match[];
  addTeam: (name: string) => void;
  editTeam: (teamId: string, name: string) => void;
  deleteTeam: (teamId: string) => void;
  addPlayer: (teamId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => void;
  editPlayer: (playerId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCountForTeam: (teamId: string) => number;
  getTeamById: (teamId: string) => Team | undefined;
  getPlayersByTeamId: (teamId: string) => Player[];
  addMatch: (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => string;
  getMatchById: (matchId: string) => Match | undefined;
  recordDelivery: (matchId: string, outcome: { runs?: number, wicket?: boolean, extra?: 'wide' | 'noball' | null }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [matches, setMatches] = useState<Match[]>([]);

  const addTeam = (name: string) => {
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name,
      logoUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/128/128`,
      imageHint: 'logo abstract',
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
    };
    setTeams((prevTeams) => [...prevTeams, newTeam]);
  };

  const editTeam = (teamId: string, name: string) => {
    setTeams(prevTeams => prevTeams.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const deleteTeam = (teamId: string) => {
    setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
    setPlayers(prevPlayers => prevPlayers.filter(p => p.teamId !== teamId));
  };
  
  const addPlayer = (teamId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => {
    const newPlayer: Player = {
      id: `p${Date.now()}`,
      teamId: teamId,
      name: playerData.name,
      role: playerData.role,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
  };

  const editPlayer = (playerId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => {
    setPlayers(prevPlayers => prevPlayers.map(p => p.id === playerId ? { ...p, name: playerData.name, role: playerData.role } : p));
  };

  const deletePlayer = (playerId: string) => {
    setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerId));
  };

  const getPlayerCountForTeam = (teamId: string) => {
    return players.filter(p => p.teamId === teamId).length;
  };
  
  const getTeamById = (teamId: string) => {
    return teams.find(t => t.id === teamId);
  }

  const getPlayersByTeamId = (teamId: string) => {
    return players.filter(p => p.teamId === teamId);
  }

  const addMatch = (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => {
    const { team1Id, team2Id, overs, tossWinnerId, tossDecision } = matchConfig;
    
    const battingTeamId = tossDecision === 'bat' ? tossWinnerId : (tossWinnerId === team1Id ? team2Id : team1Id);
    const bowlingTeamId = tossWinnerId === battingTeamId ? (battingTeamId === team1Id ? team2Id : team1Id) : tossWinnerId;

    const newMatch: Match = {
      id: `m${Date.now()}`,
      team1Id,
      team2Id,
      overs,
      status: 'live',
      tossWinnerId,
      tossDecision,
      innings: [{
        battingTeamId: battingTeamId,
        bowlingTeamId: bowlingTeamId,
        score: 0,
        wickets: 0,
        overs: 0,
      }],
      currentInning: 1,
      date: new Date().toISOString(),
    };
    setMatches(prevMatches => [...prevMatches, newMatch]);
    return newMatch.id;
  };

  const getMatchById = (matchId: string) => {
    return matches.find(m => m.id === matchId);
  }

  const recordDelivery = (matchId: string, outcome: { runs?: number; wicket?: boolean; extra?: 'wide' | 'noball' | null }) => {
    setMatches(prevMatches => prevMatches.map(m => {
        if (m.id !== matchId || m.status !== 'live') return m;

        // Using a deep copy to avoid state mutation issues with nested objects
        const updatedMatch = JSON.parse(JSON.stringify(m)); 
        const inning = updatedMatch.innings[updatedMatch.currentInning - 1];

        // Update score
        if (typeof outcome.runs === 'number') {
            inning.score += outcome.runs;
        }
        if (outcome.extra === 'wide' || outcome.extra === 'noball') {
            inning.score += 1;
        }

        // Update overs for legal deliveries only
        if (!outcome.extra) {
            const currentOverInt = Math.floor(inning.overs);
            const currentBalls = Math.round((inning.overs % 1) * 10);
            
            if (currentBalls === 5) {
                inning.overs = currentOverInt + 1;
            } else {
                inning.overs = parseFloat((currentOverInt + (currentBalls + 1) / 10).toFixed(1));
            }
        }
        
        // Update wickets
        if (outcome.wicket) {
            inning.wickets += 1;
        }

        let inningIsOver = false;
        // Inning ends if 10 wickets are down or overs are completed
        if (inning.wickets >= 10 || inning.overs >= updatedMatch.overs) {
            inningIsOver = true;
        }

        // Inning also ends if the chasing team wins
        if (updatedMatch.currentInning === 2 && updatedMatch.innings[0].score < inning.score) {
            inningIsOver = true;
        }

        if (inningIsOver) {
            if (updatedMatch.currentInning === 1) {
                // End of first inning, start the second
                const nextBattingTeamId = updatedMatch.team1Id === inning.battingTeamId ? updatedMatch.team2Id : updatedMatch.team1Id;
                const nextBowlingTeamId = inning.battingTeamId;
                updatedMatch.innings.push({
                    battingTeamId: nextBattingTeamId,
                    bowlingTeamId: nextBowlingTeamId,
                    score: 0,
                    wickets: 0,
                    overs: 0,
                });
                updatedMatch.currentInning = 2;
            } else {
                // End of second inning, match is over
                updatedMatch.status = 'completed';
                const firstInning = updatedMatch.innings[0];
                const secondInning = updatedMatch.innings[1];
                const firstInningTeam = getTeamById(firstInning.battingTeamId);
                const secondInningTeam = getTeamById(secondInning.battingTeamId);

                if (secondInning.score > firstInning.score) {
                    updatedMatch.result = `${secondInningTeam?.name} won by ${10 - secondInning.wickets} wickets.`;
                } else if (firstInning.score > secondInning.score) {
                    updatedMatch.result = `${firstInningTeam?.name} won by ${firstInning.score - secondInning.score} runs.`;
                } else {
                    updatedMatch.result = "Match is a Tie.";
                }
            }
        }

        return updatedMatch;
      }));
};

  const value = {
      teams,
      players,
      matches,
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      getPlayerCountForTeam,
      getTeamById,
      getPlayersByTeamId,
      addMatch,
      getMatchById,
      recordDelivery,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
