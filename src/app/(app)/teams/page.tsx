import { Button } from "@/components/ui/button";
import TeamCard from "@/components/teams/team-card";
import { teams } from "@/lib/data";
import { PlusCircle } from "lucide-react";
import type { Team } from "@/lib/types";

export default function TeamsPage() {
  const allTeams: Team[] = teams;

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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Team
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allTeams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
