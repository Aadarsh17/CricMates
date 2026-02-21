
'use client';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Team, type Match } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeleteTeamDialog } from "./delete-team-dialog";
import { EditTeamDialog } from "./edit-team-dialog";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useMemo } from "react";

interface TeamCardProps {
  team: Team;
  onEdit?: (name: string, logoUrl?: string) => void;
  onDelete?: () => void;
}

export default function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  const { firestore: db, user } = useFirebase();
  
  const isAdmin = useMemo(() => user && !user.isAnonymous, [user]);

  // Fetch matches to calculate real wins/losses
  const matchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'matches'),
      orderBy('date', 'desc')
    );
  }, [db]);

  const { data: matches } = useCollection<Match>(matchesQuery);

  const stats = useMemo(() => {
    if (!matches) return { wins: 0, losses: 0, form: [] as string[] };
    
    const teamMatches = matches.filter(m => 
      m.status === 'completed' && (m.team1Id === team.id || m.team2Id === team.id)
    );

    const form = teamMatches.slice(0, 5).map(m => {
      if (m.result?.startsWith(team.name)) return 'W';
      if (m.result === 'Match is a Tie.') return 'T';
      return 'L';
    });

    let wins = 0;
    let losses = 0;
    teamMatches.forEach(m => {
      if (m.result?.startsWith(team.name)) wins++;
      else if (m.result && m.result !== 'Match is a Tie.') losses++;
    });

    return { wins, losses, form };
  }, [matches, team.id, team.name]);

  return (
    <Card className="flex flex-col hover:shadow-xl transition-all duration-500 border-primary/10 overflow-hidden h-full rounded-3xl group">
      <CardHeader className="flex flex-row items-start justify-between pb-2 bg-muted/10">
        <div className="space-y-1">
            <CardTitle className="text-lg font-black tracking-tight truncate max-w-[180px]">{team.name}</CardTitle>
            <div className="flex gap-1">
                {stats.form.map((res, i) => (
                    <span 
                        key={i} 
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${res === 'W' ? 'bg-green-500' : res === 'L' ? 'bg-red-500' : 'bg-gray-400'}`}
                    >
                        {res}
                    </span>
                ))}
                {stats.form.length === 0 && <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-50">New Team</span>}
            </div>
        </div>
        {isAdmin && onEdit && onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <EditTeamDialog team={team} onTeamEdit={onEdit} />
              <DeleteTeamDialog onDelete={onDelete} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center gap-4 text-center py-8">
        <div className="relative">
            <div className="h-32 w-32 relative rounded-3xl border-4 border-background bg-muted overflow-hidden shadow-xl transition-transform group-hover:scale-105 duration-500">
                <Image
                  src={team.logoUrl}
                  alt={`${team.name} logo`}
                  fill
                  className="object-cover"
                  data-ai-hint={team.imageHint}
                />
            </div>
            <div className="absolute -bottom-3 -right-3 bg-primary text-primary-foreground text-xs font-black px-3 py-1 rounded-full border-4 border-background shadow-lg">
                {stats.wins}W - {stats.losses}L
            </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/5 p-4 mt-auto">
        <Button asChild className="w-full shadow-lg shadow-primary/10 rounded-2xl h-11 font-bold">
          <Link href={`/teams/${team.id}`}>View Squad Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
