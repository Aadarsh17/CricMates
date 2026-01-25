'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { teams as initialTeams, players as initialPlayers } from '@/lib/data';
import type { Team, Player } from '@/lib/types';

interface AppContextType {
  teams: Team[];
  players: Player[];
  addTeam: (name: string) => void;
  editTeam: (teamId: string, name: string) => void;
  deleteTeam: (teamId: string) => void;
  addPlayer: (teamId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => void;
  editPlayer: (playerId: string, playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCountForTeam: (teamId: string) => number;
  getTeamById: (teamId: string) => Team | undefined;
  getPlayersByTeamId: (teamId: string) => Player[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

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

  const value = {
      teams,
      players,
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      getPlayerCountForTeam,
      getTeamById,
      getPlayersByTeamId,
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
