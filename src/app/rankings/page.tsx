
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Medal, ChevronDown, Flag } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function RankingsPage() {
  const db = useFirestore();

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('careerCVP', 'desc'), limit(50)), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const sortedTeams = useMemoFirebase(() => {
    if (!teams) return [];
    return [...teams].sort((a, b) => {
      const ptsA = (a.matchesWon * 2) + (a.matchesDrawn || 0);
      const ptsB = (b.matchesWon * 2) + (b.matchesDrawn || 0);
      if (ptsB !== ptsA) return ptsB - ptsA;
      if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate;
      return (b.matchesWon || 0) - (a.matchesWon || 0);
    });
  }, [teams]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tight">League Leaderboards</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Statistical breakdown of the championship</p>
        </div>
      </div>

      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-11 bg-slate-100 p-1">
          <TabsTrigger value="players" className="font-bold">MVP (CVP)</TabsTrigger>
          <TabsTrigger value="teams" className="font-bold">Points Table</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          {players && players.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {players.slice(0, 3).map((player, idx) => (
                  <Card key={player.id} className={`relative overflow-hidden border-t-4 ${idx === 0 ? 'border-t-secondary scale-105 shadow-xl bg-secondary/5' : 'border-t-primary'}`}>
                    {idx === 0 && <Badge className="absolute top-2 right-2 bg-secondary text-white">MVP</Badge>}
                    <CardHeader className="text-center">
                       <div className="mx-auto bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mb-2">
                        {idx === 0 ? <Medal className="w-10 h-10 text-secondary" /> : <Star className="w-10 h-10 text-primary" />}
                      </div>
                      <CardTitle className="text-xl font-black">{player.name}</CardTitle>
                      <CardDescription className="font-bold text-[10px] uppercase tracking-tighter">{player.role}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pb-8">
                       <p className="text-5xl font-black text-primary">{player.careerCVP}</p>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cricket Value Points</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-sm border">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Global MVP Standings</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12 text-[10px] font-bold uppercase">Rank</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Player</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase">Runs</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase">Wickets</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase">CVP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {players.map((player, idx) => (
                          <TableRow key={player.id} className={idx < 3 ? 'bg-slate-50/50' : ''}>
                            <TableCell className="font-bold text-xs">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-bold text-blue-600 text-xs">{player.name}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-medium">{player.role}</div>
                            </TableCell>
                            <TableCell className="text-right font-black text-xs">{player.runsScored}</TableCell>
                            <TableCell className="text-right font-black text-xs">{player.wicketsTaken}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={idx < 3 ? "secondary" : "outline"} className="font-black px-2 text-[10px]">
                                {player.careerCVP}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl">
              <Star className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No rankings recorded yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          {sortedTeams.length > 0 ? (
            <div className="bg-white border rounded-sm overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#f0f4f3]">
                    <TableRow className="border-b-0">
                      <TableHead className="w-12 text-[10px] font-bold uppercase">Rank</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Team</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase">P</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase">W</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase">PTS</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase pr-8">NRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTeams.map((team, idx) => {
                      const played = (team.matchesWon || 0) + (team.matchesLost || 0) + (team.matchesDrawn || 0);
                      const points = ((team.matchesWon || 0) * 2) + (team.matchesDrawn || 0);
                      return (
                        <TableRow key={team.id} className="hover:bg-slate-50 group border-b last:border-0">
                          <TableCell className="text-center font-bold text-xs text-slate-500 py-3">{idx + 1}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-6 w-6 rounded-sm">
                                <AvatarImage src={team.logoUrl} />
                                <AvatarFallback className="bg-slate-100 rounded-sm"><Flag className="w-3 h-3 text-slate-300" /></AvatarFallback>
                              </Avatar>
                              <span className="font-bold text-blue-600 text-xs">{team.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs font-medium text-slate-900">{played}</TableCell>
                          <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesWon || 0}</TableCell>
                          <TableCell className="text-center text-xs font-black text-slate-900">{points}</TableCell>
                          <TableCell className="text-right text-xs font-bold pr-8">
                            <span className="text-slate-900">
                              {(team.netRunRate || 0) >= 0 ? '+' : ''}{(team.netRunRate || 0).toFixed(3)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl">
              <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No team statistics available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
