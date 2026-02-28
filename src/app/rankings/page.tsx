
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, TrendingUp, Medal, Users } from 'lucide-react';

export default function RankingsPage() {
  const db = useFirestore();

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('careerCVP', 'desc'), limit(50)), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('netRunRate', 'desc'), limit(20)), [db]);
  const { data: teams } = useCollection(teamsQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">League Leaderboards</h1>
          <p className="text-muted-foreground">Statistical breakdown of the current championship season.</p>
        </div>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="players">MVP (CVP)</TabsTrigger>
          <TabsTrigger value="teams">Points Table</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          {players && players.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {players.slice(0, 3).map((player, idx) => (
                  <Card key={player.id} className={`relative overflow-hidden border-t-4 ${idx === 0 ? 'border-t-secondary scale-105 shadow-xl bg-secondary/5' : 'border-t-primary'}`}>
                    {idx === 0 && <Badge className="absolute top-2 right-2 bg-secondary text-white">MVP</Badge>}
                    <CardHeader className="text-center">
                       <div className="mx-auto bg-muted rounded-full w-20 h-20 flex items-center justify-center mb-2">
                        {idx === 0 ? <Medal className="w-10 h-10 text-secondary" /> : <Star className="w-10 h-10 text-primary" />}
                      </div>
                      <CardTitle className="text-xl">{player.name}</CardTitle>
                      <CardDescription className="font-bold text-xs uppercase tracking-tighter">{player.role}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pb-8">
                       <p className="text-5xl font-black text-primary">{player.careerCVP}</p>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cricket Value Points</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Global MVP Standings</CardTitle>
                  <CardDescription>Comprehensive list of players ranked by their cumulative CVP.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Wickets</TableHead>
                        <TableHead className="text-right">Matches</TableHead>
                        <TableHead className="text-right">CVP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player, idx) => (
                        <TableRow key={player.id} className={idx < 3 ? 'bg-primary/5' : ''}>
                          <TableCell className="font-bold">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-bold">{player.name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{player.role}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{player.runsScored}</TableCell>
                          <TableCell className="text-right font-medium">{player.wicketsTaken}</TableCell>
                          <TableCell className="text-right">{player.matchesPlayed}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={idx < 3 ? "secondary" : "outline"} className="font-black px-3">
                              {player.careerCVP}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">No player statistics recorded yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          {teams && teams.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Points Table</CardTitle>
                <CardDescription>Franchise standings based on Net Run Rate (NRR).</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pos</TableHead>
                      <TableHead>Franchise</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-right">NRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team, idx) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-bold">{idx + 1}</TableCell>
                        <TableCell className="font-bold text-primary">
                          {team.name}
                        </TableCell>
                        <TableCell className="text-center font-bold text-secondary">{team.matchesWon}</TableCell>
                        <TableCell className="text-center font-bold text-destructive">{team.matchesLost}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={team.netRunRate >= 0 ? 'text-secondary' : 'text-destructive'}>
                            {team.netRunRate > 0 ? '+' : ''}{team.netRunRate.toFixed(3)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">The championship hasn't started yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
