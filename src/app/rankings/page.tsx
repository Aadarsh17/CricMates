"use client"

import { MOCK_PLAYERS, MOCK_TEAMS } from '@/lib/firebase-mock';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, TrendingUp, Medal, Users } from 'lucide-react';

export default function RankingsPage() {
  const sortedPlayers = [...MOCK_PLAYERS].sort((a, b) => b.stats.cvp - a.stats.cvp);
  const sortedTeams = [...MOCK_TEAMS].sort((a, b) => b.stats.points - a.stats.points || b.stats.nrr - a.stats.nrr);

  const hasPlayers = sortedPlayers.length > 0;
  const hasTeams = sortedTeams.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">League Stats</h1>
          <p className="text-muted-foreground">Analyze performance across teams and individual players.</p>
        </div>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="players">MVP (CVP)</TabsTrigger>
          <TabsTrigger value="teams">Points Table</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          {hasPlayers ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {sortedPlayers.slice(0, 3).map((player, idx) => (
                  <Card key={player.id} className={`relative overflow-hidden border-t-4 ${idx === 0 ? 'border-t-secondary scale-105 shadow-lg' : 'border-t-primary'}`}>
                    {idx === 0 && <Badge className="absolute top-2 right-2 bg-secondary text-white">CHAMPION</Badge>}
                    <CardHeader className="text-center">
                       <div className="mx-auto bg-muted rounded-full w-20 h-20 flex items-center justify-center mb-2">
                        {idx === 0 ? <Medal className="w-10 h-10 text-secondary" /> : <Star className="w-10 h-10 text-primary" />}
                      </div>
                      <CardTitle>{player.name}</CardTitle>
                      <CardDescription>{player.role}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pb-8">
                       <p className="text-4xl font-black text-primary">{player.stats.cvp}</p>
                       <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">CVP Points</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Global Player Rankings</CardTitle>
                  <CardDescription>Based on real-time Cricket Value Points calculation</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Wickets</TableHead>
                        <TableHead className="text-right">CVP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPlayers.map((player, idx) => (
                        <TableRow key={player.id} className={idx < 3 ? 'bg-primary/5' : ''}>
                          <TableCell className="font-bold">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>{player.role}</TableCell>
                          <TableCell className="text-right">{player.stats.runs}</TableCell>
                          <TableCell className="text-right">{player.stats.wickets}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={idx < 3 ? "secondary" : "outline"} className="font-bold">
                              {player.stats.cvp}
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
              <p className="text-muted-foreground">No player statistics available yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          {hasTeams ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Championship Points Table</CardTitle>
                <CardDescription>Win/Loss ratio and Net Run Rate (NRR)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pos</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">P</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-right">NRR</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTeams.map((team, idx) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-bold">{idx + 1}</TableCell>
                        <TableCell className="font-medium flex items-center">
                          <div className="w-6 h-6 rounded bg-muted mr-2" />
                          {team.name}
                        </TableCell>
                        <TableCell className="text-center">{team.stats.played}</TableCell>
                        <TableCell className="text-center text-secondary font-bold">{team.stats.won}</TableCell>
                        <TableCell className="text-center text-destructive">{team.stats.lost}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={team.stats.nrr >= 0 ? 'text-secondary' : 'text-destructive'}>
                            {team.stats.nrr > 0 ? '+' : ''}{team.stats.nrr.toFixed(3)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-primary text-white px-3 font-bold">{team.stats.points}</Badge>
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
              <p className="text-muted-foreground">No teams registered in the league yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
