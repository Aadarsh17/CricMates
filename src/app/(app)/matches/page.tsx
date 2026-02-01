'use client';

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format, isValid } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, Player, Team } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlayerOfTheMatch } from '@/lib/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


export default function MatchesHistoryPage() {
  const { firestore: db } = useFirebase();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const teams = teamsData || [];

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  const players = playersData || [];
  
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
  const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);
  
  const completedMatches = (matchesData || []).sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : null;
    const dateB = b.date ? new Date(b.date) : null;
    
    if (!dateA || !isValid(dateA)) return 1;
    if (!dateB || !isValid(dateB)) return -1;
    
    return dateB.getTime() - dateA.getTime();
  });

  const getTeamById = (teamId: string) => teams.find(t => t.id === teamId);

  if (matchesLoading || teamsLoading || playersLoading) {
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {completedMatches.map(match => {
          // Robust checks for data integrity
          if (!match.innings || match.innings.length === 0) {
            return null;
          }
          const firstInning = match.innings[0];
          if (!firstInning || typeof firstInning.overs === 'undefined' || typeof firstInning.score === 'undefined' || typeof firstInning.wickets === 'undefined') {
            return null;
          }

          const matchDate = match.date ? new Date(match.date) : null;
          if (!matchDate || !isValid(matchDate)) {
            return null; // Don't render card if date is invalid
          }

          const secondInning = match.innings.length > 1 ? match.innings[1] : null;

          const firstInningTeam = getTeamById(firstInning.battingTeamId);
          const secondInningTeam = secondInning ? getTeamById(secondInning.battingTeamId) : null;

          if (!firstInningTeam) return null;

          const { player: playerOfTheMatch, cvp: potmCVP } = getPlayerOfTheMatch(match, players, teams);

          return (
            <Card key={match.id} className="flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="p-4">
                    <p className="text-sm text-muted-foreground">{format(matchDate, 'PPP')}</p>
                    <p className="font-semibold text-primary pt-1">{match.result || 'Result not available'}</p>
                </CardHeader>
              
              <CardContent className="p-4 space-y-2 flex-grow">
                  <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{firstInningTeam.name}</span>
                      <span className="font-mono text-lg font-semibold">{firstInning.score}/{firstInning.wickets} <span className="text-sm font-normal text-muted-foreground">({firstInning.overs.toFixed(1)})</span></span>
                  </div>
                  {secondInning && secondInningTeam && (
                      <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">{secondInningTeam.name}</span>
                          <span className="font-mono text-lg font-semibold">{secondInning.score}/{secondInning.wickets} <span className="text-sm font-normal text-muted-foreground">({(secondInning.overs || 0).toFixed(1)})</span></span>
                      </div>
                  )}
              </CardContent>

              {playerOfTheMatch && (
                <div className="p-4 border-t bg-muted/20">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">CricMates Valuable Player (CVP)</p>
                    <div className="flex items-center gap-3 pt-2">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={`https://picsum.photos/seed/${playerOfTheMatch.id}/40/40`} alt={playerOfTheMatch.name} />
                            <AvatarFallback>{playerOfTheMatch.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg leading-tight">{playerOfTheMatch.name} ({potmCVP})</p>
                        </div>
                    </div>
                </div>
              )}
              
              <CardFooter className="p-2">
                <Button asChild className="w-full">
                  <Link href={`/matches/${match.id}`}>View Scorecard</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
