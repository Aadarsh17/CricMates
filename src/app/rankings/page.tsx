
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Medal, Flag, ChevronRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo } from 'react';
import Link from 'next/link';

export default function RankingsPage() {
  const db = useFirestore();

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players = [] } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams = [] } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), where('status', '==', 'completed')), [db]);
  const { data: matches = [] } = useCollection(matchesQuery);

  /**
   * Dynamically calculate team standings based on existing completed matches.
   */
  const teamStandings = useMemo(() => {
    if (!teams || teams.length === 0) return [];
    
    const standings: Record<string, any> = {};
    
    // Initialize standings for all existing teams
    teams.forEach(t => {
      standings[t.id] = {
        id: t.id,
        name: t.name,
        logoUrl: t.logoUrl,
        played: 0,
        won: 0,
        lost: 0,
        drawn: 0,
        points: 0,
        nrr: 0
      };
    });

    // Process only existing matches
    if (matches && matches.length > 0) {
      matches.forEach(m => {
        const t1Id = m.team1Id;
        const t2Id = m.team2Id;
        
        if (!standings[t1Id] || !standings[t2Id]) return;

        standings[t1Id].played += 1;
        standings[t2Id].played += 1;

        const result = m.resultDescription?.toLowerCase() || '';
        const t1Name = standings[t1Id].name.toLowerCase();
        const t2Name = standings[t2Id].name.toLowerCase();

        if (result.includes(t1Name) && result.includes('won')) {
          standings[t1Id].won += 1;
          standings[t1Id].points += 2;
          standings[t2Id].lost += 1;
        } else if (result.includes(t2Name) && result.includes('won')) {
          standings[t2Id].won += 1;
          standings[t2Id].points += 2;
          standings[t1Id].lost += 1;
        } else {
          standings[t1Id].drawn += 1;
          standings[t1Id].points += 1;
          standings[t2Id].drawn += 1;
          standings[t2Id].points += 1;
        }
      });
    }

    return Object.values(standings).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return b.nrr - a.nrr;
    });
  }, [teams, matches]);

  const topPlayers = useMemo(() => {
    if (!players) return [];
    return [...players].sort((a, b) => (b.careerCVP || 0) - (a.careerCVP || 0)).slice(0, 10);
  }, [players]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900">Leaderboards</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Season Performance Analytics</p>
        </div>
      </div>

      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-11 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="players" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">MVP (CVP)</TabsTrigger>
          <TabsTrigger value="teams" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Points Table</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          {topPlayers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {topPlayers.slice(0, 3).map((player, idx) => (
                  <Link key={player.id} href={`/players/${player.id}`}>
                    <Card className={`relative overflow-hidden border-t-4 hover:shadow-lg transition-all cursor-pointer h-full ${idx === 0 ? 'border-t-secondary scale-105 shadow-xl bg-secondary/5' : 'border-t-primary'}`}>
                      {idx === 0 && <Badge className="absolute top-2 right-2 bg-secondary text-white font-black text-[9px] uppercase">Rank 1</Badge>}
                      <CardHeader className="text-center">
                         <div className="mx-auto bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mb-2 overflow-hidden border-2 border-white shadow-inner">
                          {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" /> : (idx === 0 ? <Medal className="w-10 h-10 text-secondary" /> : <Star className="w-10 h-10 text-primary" />)}
                        </div>
                        <CardTitle className="text-xl font-black text-slate-900 group-hover:text-primary">{player.name}</CardTitle>
                        <CardDescription className="font-black text-[10px] uppercase tracking-tighter text-slate-400">{player.role}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pb-8">
                         <p className="text-5xl font-black text-primary">{player.careerCVP || 0}</p>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">CVP Score</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <Card className="shadow-sm border rounded-xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Global MVP Standings</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Player</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Runs</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Wkts</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">CVP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPlayers.map((player, idx) => (
                          <TableRow key={player.id} className={idx < 3 ? 'bg-slate-50/30' : ''}>
                            <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <Link href={`/players/${player.id}`} className="font-black text-primary hover:underline text-xs flex items-center gap-2">
                                {player.name}
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                              </Link>
                              <div className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{player.role}</div>
                            </TableCell>
                            <TableCell className="text-right font-black text-xs">{player.runsScored || 0}</TableCell>
                            <TableCell className="text-right font-black text-xs">{player.wicketsTaken || 0}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={idx < 3 ? "secondary" : "outline"} className="font-black px-2 text-[10px] border-none">
                                {player.careerCVP || 0}
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
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
              <Star className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No rankings recorded yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          {teamStandings.length > 0 ? (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#f0f4f3]">
                    <TableRow className="border-b-0">
                      <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Team</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase">P</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase">W</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase">PTS</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase pr-8">NRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamStandings.map((team, idx) => (
                        <TableRow key={team.id} className="hover:bg-slate-50 group border-b last:border-0">
                          <TableCell className="text-center font-black text-xs text-slate-400 py-4">{idx + 1}</TableCell>
                          <TableCell className="py-4">
                            <Link href={`/teams/${team.id}`} className="flex items-center gap-3 group">
                              <Avatar className="h-6 w-6 rounded-sm">
                                <AvatarImage src={team.logoUrl} />
                                <AvatarFallback className="bg-slate-100 rounded-sm font-black text-[10px]">{team.name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-black text-primary hover:underline text-xs">{team.name}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-xs font-black text-slate-900">{team.played}</TableCell>
                          <TableCell className="text-center text-xs font-black text-slate-900">{team.won}</TableCell>
                          <TableCell className="text-center text-xs font-black text-slate-900">{team.points}</TableCell>
                          <TableCell className="text-right text-xs font-black pr-8">
                            <Badge variant={(team.nrr || 0) >= 0 ? 'secondary' : 'outline'} className="font-black text-[10px] border-none px-2 h-5">
                              {(team.nrr || 0) >= 0 ? '+' : ''}{(team.nrr || 0).toFixed(3)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
              <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No team statistics available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
