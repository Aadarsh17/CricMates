'use client';

import { useState } from 'react';
import TeamCard from "@/components/teams/team-card";
import { teams as initialTeams } from "@/lib/data";
import type { Team } from "@/lib/types";
import { AddTeamDialog } from '@/components/teams/add-team-dialog';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  const handleAddTeam = (name: string) => {
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name,
      logoUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/128/128`,
      imageHint: 'logo abstract',
      players: [],
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
    };
    setTeams((prevTeams) => [...prevTeams, newTeam]);
  };

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
        <AddTeamDialog onTeamAdd={handleAddTeam} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
