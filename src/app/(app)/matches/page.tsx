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

  // Initialize points for all players in the match
  const playerPoints: { [playerId: string]: number } = {};
  const matchPlayerIds = new Set(players.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id).map(p => p.id));
  matchPlayerIds.forEach(id => {
    playerPoints[id] = 0;
  });

  const team1 = teams.find(t => t.id === match.team1Id);
  const team2 = teams.find(t => t.id === match.team2Id);
  if (!team1 || !team2) return null;

  // Batting, Bowling, and Fielding points from deliveries
  match.innings.forEach(inning => {
    inning.deliveryHistory.forEach(delivery => {
        const { strikerId, bowlerId, runs, isWicket, extra, dismissal } = delivery;

        // Ensure player IDs are in our points map
        if (strikerId && playerPoints[strikerId] === undefined) playerPoints[strikerId] = 0;
        if (bowlerId && playerPoints[bowlerId] === undefined) playerPoints[bowlerId] = 0;
        if (dismissal?.fielderId && playerPoints[dismissal.fielderId] === undefined) playerPoints[dismissal.fielderId] = 0;

        // 1. Batting Points
        if (strikerId && extra !== 'byes' && extra !== 'legbyes') {
            // 1 point per run
            playerPoints[strikerId] += runs;
            
            // Boundary bonuses
            if (runs === 4) {
                playerPoints[strikerId] += 2; // 2 extra points for a 4
            } else if (runs === 6) {
                playerPoints[strikerId] += 4; // 4 extra points for a 6
            }
        }
        
        // 2. Bowling & Fielding Points
        if (isWicket && dismissal && bowlerId) {
            if (dismissal.type === 'Run out') {
                if(dismissal.fielderId) playerPoints[dismissal.fielderId] += 5;
            } else if (dismissal.type === 'Catch out' || dismissal.type === 'Stumping') {
                playerPoints[bowlerId] += 10; // Wicket for bowler
                if(dismissal.fielderId) playerPoints[dismissal.fielderId] += 5; // Fielding point
            } else { // Bowled, LBW, Hit Wicket etc.
                playerPoints[bowlerId] += 10;
            }
        }
    });
  });

  // Post-match bonuses (Strike Rate, Economy, Winning Team)
  const battingStatsInMatch: { [playerId: string]: { runs: number, balls: number } } = {};
  const bowlingStatsInMatch: { [playerId: string]: { runs: number, balls: number } } = {};

  matchPlayerIds.forEach(id => {
      battingStatsInMatch[id] = { runs: 0, balls: 0 };
      bowlingStatsInMatch[id] = { runs: 0, balls: 0 };
  });
  
  match.innings.forEach(inning => {
      inning.deliveryHistory.forEach(delivery => {
          const { strikerId, bowlerId, runs, extra } = delivery;
          // Aggregate stats for SR and Economy calculation
          if (strikerId && extra !== 'byes' && extra !== 'legbyes') {
              battingStatsInMatch[strikerId].runs += runs;
          }
          if (strikerId && extra !== 'wide') {
              battingStatsInMatch[strikerId].balls += 1;
          }
          if (bowlerId) {
              let conceded = runs;
              if (extra === 'wide' || extra === 'noball') conceded += 1;
              bowlingStatsInMatch[bowlerId].runs += conceded;

              if (extra !== 'wide' && extra !== 'noball') {
                  bowlingStatsInMatch[bowlerId].balls += 1;
              }
          }
      });
  });
  
  // Calculate SR and Economy bonuses
  matchPlayerIds.forEach(playerId => {
      const battingStats = battingStatsInMatch[playerId];
      if (battingStats.balls > 0) {
          const strikeRate = (battingStats.runs / battingStats.balls) * 100;
          if (strikeRate > 200) {
              playerPoints[playerId] = (playerPoints[playerId] || 0) + 5;
          }
      }

      const bowlingStats = bowlingStatsInMatch[playerId];
      if (bowlingStats.balls > 0) {
          const economy = bowlingStats.runs / (bowlingStats.balls / 6);
          if (economy <= 7) {
              playerPoints[playerId] = (playerPoints[playerId] || 0) + 5;
          }
      }
  });


  // Winning team bonus
  const winningTeamName = match.result.split(' won by')[0].trim();
  const winningTeam = [team1, team2].find(t => t.name === winningTeamName);

  if (winningTeam) {
    const winningTeamPlayers = players.filter(p => p.teamId === winningTeam.id);
    winningTeamPlayers.forEach(p => {
        if (playerPoints[p.id] !== undefined) {
          playerPoints[p.id] += 3;
        }
    });
  }

  // Find player with max points
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
  
  if (maxPoints <= 10) return null;

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
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">CricMates Valuable Player (CVP)</p>
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
