'use client';

import { notFound } from "next/navigation";
import { teams as initialTeams, players as initialPlayers } from "@/lib/data";
import { useState } from 'react';
import type { Team, Player } from '@/lib/types';
import PlayerCard from '@/components/players/player-card';
import { AddPlayerDialog } from '@/components/players/add-player-dialog';

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  const team = teams.find((t) => t.id === params.id);

  if (!team) {
    notFound();
  }

  const teamPlayers = players.filter(p => p.teamId === team.id);

  const handleAddPlayer = (playerData: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'; }) => {
    const newPlayer: Player = {
      id: `p${Date.now()}`,
      teamId: team.id,
      name: playerData.name,
      role: playerData.role,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">{team.name}</h1>
          <p className="text-muted-foreground">
            Manage your team's players and view their stats.
          </p>
        </div>
        <AddPlayerDialog onPlayerAdd={handleAddPlayer} />
      </div>

      {teamPlayers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teamPlayers.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      ) : (
         <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">No Players Found</h3>
              <p className="text-sm text-muted-foreground">
                Add a player to get started.
              </p>
            </div>
          </div>
      )}
    </div>
  );
}
