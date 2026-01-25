'use client';

import { notFound } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import PlayerCard from '@/components/players/player-card';
import { AddPlayerDialog } from '@/components/players/add-player-dialog';
import type { Player } from '@/lib/types';

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
}

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { getTeamById, getPlayersByTeamId, addPlayer, editPlayer, deletePlayer, isDataLoaded } = useAppContext();

  if (!isDataLoaded) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Loading team data from your browser.
          </p>
        </div>
      </div>
    );
  }

  const team = getTeamById(id);

  if (!team) {
    notFound();
  }

  const teamPlayers = getPlayersByTeamId(team.id);

  const handleAddPlayer = (playerData: PlayerData) => {
    addPlayer(team.id, playerData);
  };

  const handleEditPlayer = (playerId: string, playerData: PlayerData) => {
    editPlayer(playerId, playerData);
  };

  const handleDeletePlayer = (playerId: string) => {
    deletePlayer(playerId);
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
            <PlayerCard 
              key={player.id} 
              player={player} 
              onEdit={(playerData) => handleEditPlayer(player.id, playerData)}
              onDelete={() => handleDeletePlayer(player.id)}
            />
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
