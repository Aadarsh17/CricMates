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
  simulateOver: (matchId: string) => void;
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

  const simulateOver = (matchId: string) => {
    setMatches(prevMatches => prevMatches.map(m => {
      if (m.id === matchId && m.status === 'live') {
        const currentInningData = m.innings[m.currentInning - 1];
        
        let { score, wickets, overs } = currentInningData;
        let inningIsOver = false;

        const runsInOver = Math.floor(Math.random() * 18) + 2; // 2-19 runs
        const wicketsInOver = Math.random() > 0.8 ? (Math.random() > 0.95 ? 2 : 1) : 0; // 0, 1 or 2 wickets

        score += runsInOver;
        
        let newOvers = overs + 1;
        
        if (wickets + wicketsInOver >= 10) {
            wickets = 10;
            inningIsOver = true;
        } else {
            wickets += wicketsInOver;
        }
        
        if (newOvers >= m.overs) {
            newOvers = m.overs;
            inningIsOver = true;
        }

        const updatedInningData = {
            ...currentInningData,
            score,
            wickets,
            overs: newOvers,
        };

        const newInnings = [...m.innings];
        newInnings[m.currentInning - 1] = updatedInningData;
        
        let updatedMatch = { ...m, innings: newInnings };
        
        if (inningIsOver) {
            if (m.currentInning === 1) {
                // Start second inning
                const nextBattingTeamId = m.team1Id === currentInningData.battingTeamId ? m.team2Id : m.team1Id;
                const nextBowlingTeamId = currentInningData.battingTeamId;
                updatedMatch.innings.push({
                    battingTeamId: nextBattingTeamId,
                    bowlingTeamId: nextBowlingTeamId,
                    score: 0,
                    wickets: 0,
                    overs: 0,
                });
                updatedMatch.currentInning = 2;
            } else {
                // Match is over
                updatedMatch.status = 'completed';
                // Determine winner
                const firstInning = updatedMatch.innings[0];
                const secondInning = updatedMatch.innings[1];
                
                const firstInningBattingTeam = getTeamById(firstInning.battingTeamId);
                const secondInningBattingTeam = getTeamById(secondInning.battingTeamId);
                
                if (secondInning.score > firstInning.score) {
                   updatedMatch.result = `${secondInningBattingTeam?.name} won by ${10 - secondInning.wickets} wickets.`;
                } else if (secondInning.score < firstInning.score) {
                    updatedMatch.result = `${firstInningBattingTeam?.name} won by ${firstInning.score - secondInning.score} runs.`;
                } else {
                    updatedMatch.result = "Match is a Tie.";
                }
            }
        }
        return updatedMatch;
      }
      return m;
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
      simulateOver,
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
