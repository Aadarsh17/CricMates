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

const getPlayerOfTheMatch = (match: Match, players: Player[], teams: Team[]): Player | null => {
  if (match.status !== 'completed' || !match.result) return null;

  const playerPoints: { [playerId: string]: number } = {};
  const matchPlayerIds = new Set(players.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id).map(p => p.id));
  matchPlayerIds.forEach(id => {
    playerPoints[id] = 0;
  });

  const team1 = teams.find(t => t.id === match.team1Id);
  const team2 = teams.find(t => t.id === match.team2Id);
  if (!team1 || !team2) return null;

  const winningTeamName = match.result.split(' won by')[0].trim();
  const winningTeam = [team1, team2].find(t => t.name === winningTeamName);

  // BONUS: Winning team bonus
  if (winningTeam) {
    const winningTeamPlayers = players.filter(p => p.teamId === winningTeam.id);
    winningTeamPlayers.forEach(p => {
        playerPoints[p.id] = (playerPoints[p.id] || 0) + 10;
        if (p.isCaptain) {
            playerPoints[p.id] = (playerPoints[p.id] || 0) + 15;
        }
    });
  }

  match.innings.forEach(inning => {
    const battingStats: Map<string, { runs: number, balls: number }> = new Map();
    const bowlingStats: Map<string, { runs: number, balls: number, wickets: number }> = new Map();

    inning.deliveryHistory.forEach(delivery => {
        const { strikerId, bowlerId, runs, isWicket, extra, dismissal } = delivery;

        if (!battingStats.has(strikerId)) battingStats.set(strikerId, { runs: 0, balls: 0 });
        if (bowlerId && !bowlingStats.has(bowlerId)) bowlingStats.set(bowlerId, { runs: 0, balls: 0, wickets: 0 });
        
        if (playerPoints[strikerId] === undefined) playerPoints[strikerId] = 0;
        if (bowlerId && playerPoints[bowlerId] === undefined) playerPoints[bowlerId] = 0;

        // BATTING POINTS
        const strikerBatStats = battingStats.get(strikerId)!;
        if (extra !== 'byes' && extra !== 'legbyes') {
            playerPoints[strikerId] += runs;
            strikerBatStats.runs += runs;
        }
        if (extra !== 'wide') {
            strikerBatStats.balls += 1;
        }

        // BOWLING & FIELDING POINTS
        if (bowlerId) {
            const bowlerBowlStats = bowlingStats.get(bowlerId)!;
            
            let conceded = runs;
            if (extra === 'wide' || extra === 'noball') {
                conceded += 1;
            }
            bowlerBowlStats.runs += conceded;

            if (extra !== 'wide' && extra !== 'noball') {
                bowlerBowlStats.balls += 1;
            }

            if (isWicket && dismissal) {
                if (dismissal.type !== 'Run out') {
                    playerPoints[bowlerId] += 25;
                    bowlerBowlStats.wickets += 1;
                }
                if (dismissal.fielderId) {
                    if (playerPoints[dismissal.fielderId] === undefined) playerPoints[dismissal.fielderId] = 0;
                    playerPoints[dismissal.fielderId] += 10;
                }
            }
        }
    });

    // Batting bonuses
    battingStats.forEach((stats, playerId) => {
        if (stats.runs >= 100) playerPoints[playerId] += 20;
        else if (stats.runs >= 50) playerPoints[playerId] += 10;
        
        if (stats.balls >= 20) {
            const strikeRate = (stats.runs / stats.balls) * 100;
            if (strikeRate >= 150) playerPoints[playerId] += 10;
            else if (strikeRate >= 120) playerPoints[playerId] += 5;
        }
        
        if (inning.score > 0) {
            const percentageOfRuns = (stats.runs / inning.score) * 100;
            if (percentageOfRuns >= 40) playerPoints[playerId] += 15;
            else if (percentageOfRuns >= 25) playerPoints[playerId] += 5;
        }
    });

    // Bowling bonuses
    bowlingStats.forEach((stats, playerId) => {
        if (stats.wickets >= 5) playerPoints[playerId] += 20;
        else if (stats.wickets >= 3) playerPoints[playerId] += 10;

        if (stats.balls >= 12) {
            const economy = stats.runs / (stats.balls / 6);
            if (economy <= 4.0) playerPoints[playerId] += 15;
            else if (economy <= 6.0) playerPoints[playerId] += 5;
        }
    });
  });

  let potm: Player | null = null;
  let maxPoints = -1;

  for (const playerId in playerPoints) {
      if (matchPlayerIds.has(playerId) && playerPoints[playerId] > maxPoints) {
          maxPoints = playerPoints[playerId];
          const player = players.find(p => p.id === playerId);
          if (player) {
              potm = player;
          }
      }
  }
  
  if (maxPoints <= 25) return null;

  return potm;
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

          const playerOfTheMatch = getPlayerOfTheMatch(match, players, teams);

          return (
            <Card key={match.id} className="flex flex-col">
              {playerOfTheMatch && (
                <div className="p-4 border-b bg-muted/20">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Player of the Match</p>
                    <div className="flex items-center gap-2 pt-1">
                        <Medal className="w-5 h-5 text-primary"/>
                        <p className="font-bold text-primary text-lg">{playerOfTheMatch.name}</p>
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
