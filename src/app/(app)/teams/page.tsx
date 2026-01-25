'use client';

import TeamCard from "@/components/teams/team-card";
import { AddTeamDialog } from '@/components/teams/add-team-dialog';
import { useAppContext } from "@/context/AppContext";

export default function TeamsPage() {
  const { teams, addTeam, editTeam, deleteTeam, getPlayerCountForTeam } = useAppContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Teams
          </h1>
          <p className="text-muted-foreground">
            Manage your cricket teams and players.
          </p>
        </div>
        <AddTeamDialog onTeamAdd={addTeam} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map((team) => (
          <TeamCard 
            key={team.id} 
            team={team} 
            playerCount={getPlayerCountForTeam(team.id)}
            onEdit={(name) => editTeam(team.id, name)}
            onDelete={() => deleteTeam(team.id)}
          />
        ))}
      </div>
    </div>
  );
}
