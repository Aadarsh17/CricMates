'use client';

import { notFound, useParams } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import PlayerCard from '@/components/players/player-card';
import { AddPlayerDialog } from '@/components/players/add-player-dialog';
import type { Player, Team } from '@/lib/types';
import { useCollection, useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  battingStyle?: string;
  bowlingStyle?: string;
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
}

export default function TeamDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { addPlayer, editPlayer, deletePlayer } = useAppContext();
  const { firestore: db } = useFirebase();

  const teamRef = useMemoFirebase(() => (db ? doc(db, 'teams', id) : null), [db, id]);
  const { data: team, isLoading: teamLoading } = useDoc<Team>(teamRef);
  
  const playersQuery = useMemoFirebase(() => (db ? query(collection(db, 'players'), where('teamId', '==', id)) : null), [db, id]);
  const { data: teamPlayers, isLoading: playersLoading } = useCollection<Player>(playersQuery);

  if (teamLoading || playersLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Loading team data.
          </p>
        </div>
      </div>
    );
  }

  if (!team) {
    notFound();
  }

  const handleAddPlayer = (playerData: PlayerData) => {
    if (!teamPlayers) return;
    addPlayer(team.id, teamPlayers, playerData);
  };

  const handleEditPlayer = (playerId: string, playerData: PlayerData) => {
    if (!teamPlayers) return;
    editPlayer(playerId, team.id, teamPlayers, playerData);
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

      {teamPlayers && teamPlayers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
