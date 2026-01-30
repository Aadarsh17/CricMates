'use client';

import { useAppContext } from '@/context/AppContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { Trophy, Medal } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, Player, Team } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { calculatePlayerCVP } from '@/lib/stats';

const getPlayerOfTheMatch = (match: Match, players: Player[], teams: Team[]): { player: Player | null, cvp: number } => {
  if (match.status !== 'completed' || !match.result) return { player: null, cvp: 0 };

  const matchPlayerIds = new Set(players.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id).map(p => p.id));
  const matchPlayers = players.filter(p => matchPlayerIds.has(p.id));

  if (matchPlayers.length === 0) return { player: null, cvp: 0 };

  let potm: Player | null = null;
  let maxPoints = -1;

  matchPlayers.forEach(player => {
    const cvp = calculatePlayerCVP(player, match, teams, players);
    if (cvp > maxPoints) {
      maxPoints = cvp;
      potm = player;
    }
  });
  
  if (maxPoints <= 10) return { player: null, cvp: 0 };

  return { player: potm, cvp: maxPoints };
};


export default function MatchesHistoryPage() {
  const { getTeamById, teams, players, loading: contextLoading } = useAppContext();
  const { firestore: db } = useFirebase();
  
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
  const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);
  
  const completedMatches = (matchesData || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (matchesLoading || contextLoading.teams || contextLoading.players) {
     return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
             <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </CardHeader>
                <CardContent className="p-4"><Skeleton className="h-8 w-3/4" /></CardContent>
                <div className="p-4"><Skeleton className="h-10 w-full" /></div>
              </Card>
          ))}
        </div>
      </div>
    );
  }

  if (completedMatches.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">No Match History</h3>
          <p className="text-sm text-muted-foreground">
            Completed matches will be listed here.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Match History
          </h1>
          <p className="text-muted-foreground">
            Review your past matches and scorecards.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {completedMatches.map(match => {
          const team1 = getTeamById(match.team1Id);
          const team2 = getTeamById(match.team2Id);
          if (!team1 || !team2) return null;

          const { player: playerOfTheMatch, cvp: potmCVP } = getPlayerOfTheMatch(match, players, teams);

          return (
            <Card key={match.id} className="flex flex-col">
              {playerOfTheMatch && (
                <div className="p-4 border-b bg-muted/20">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">CricMates Valuable Player (CVP)</p>
                    <div className="flex items-center gap-2 pt-1">
                        <Medal className="w-5 h-5 text-primary"/>
                        <p className="font-bold text-primary text-lg">{playerOfTheMatch.name} ({potmCVP})</p>
                    </div>
                </div>
              )}
              <CardHeader>
                <CardDescription>{format(new Date(match.date), 'PPP')}</CardDescription>
                <CardTitle>{team1.name} vs {team2.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow p-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                    <Trophy className="w-5 h-5"/>
                    <p>{match.result || 'Result not available'}</p>
                </div>
              </CardContent>
              <div className="p-4">
                <Button asChild className="w-full">
                  <Link href={`/matches/${match.id}`}>View Scorecard</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
