
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Medal, Flag, ChevronRight, UserCircle, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function RankingsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players = [] } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams = [] } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches = [] } = useCollection(matchesQuery);

  const allDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(allDeliveriesQuery);

  /**
   * GHOST DATA PROTECTION ENGINE
   * Only includes deliveries from matches that currently exist in the database.
   * If a match is deleted, its deliveries are ignored instantly across all leaderboards.
   */
  const allDeliveries = useMemo(() => {
    if (!rawDeliveries || !matches || matches.length === 0) return [];
    const validMatchIds = new Set(matches.map(m => m.id));
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && validMatchIds.has(matchId);
    });
  }, [rawDeliveries, matches]);

  const teamStandings = useMemo(() => {
    if (!teams || teams.length === 0) return [];
    
    const standings: Record<string, any> = {};
    
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
        nrr: t.netRunRate || 0
      };
    });

    if (matches && matches.length > 0) {
      matches.filter(m => m.status === 'completed').forEach(m => {
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
    if (!players || players.length === 0) return [];
    
    const pStats: Record<string, any> = {};
    
    players.forEach(p => {
      pStats[p.id] = { 
        id: p.id, name: p.name, role: p.role, imageUrl: p.imageUrl,
        runs: 0, ballsFaced: 0, fours: 0, sixes: 0, 
        wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0,
        catches: 0, stumpings: 0, runOuts: 0,
        matchCount: 0,
        cvp: 0,
        matchesSeen: new Set<string>()
      };
    });

    if (allDeliveries && allDeliveries.length > 0) {
      allDeliveries.forEach(d => {
        const sId = d.strikerPlayerId;
        const bId = d.bowlerPlayerId;
        const fId = d.fielderPlayerId;
        const matchId = d.__fullPath?.split('/')[1];

        if (pStats[sId]) {
          pStats[sId].runs += d.runsScored || 0;
          if (d.extraType !== 'wide') pStats[sId].ballsFaced += 1;
          if (d.runsScored === 4) pStats[sId].fours += 1;
          if (d.runsScored === 6) pStats[sId].sixes += 1;
          if (matchId) pStats[sId].matchesSeen.add(matchId);
        }

        if (pStats[bId]) {
          pStats[bId].runsConceded += d.totalRunsOnDelivery || 0;
          if (d.extraType !== 'wide' && d.extraType !== 'noball') pStats[bId].ballsBowled += 1;
          if (d.isWicket && d.dismissalType !== 'runout') pStats[bId].wickets += 1;
          if (matchId) pStats[bId].matchesSeen.add(matchId);
        }

        if (fId && pStats[fId]) {
          if (d.dismissalType === 'caught') pStats[fId].catches += 1;
          if (d.dismissalType === 'stumped') pStats[fId].stumpings += 1;
          if (d.dismissalType === 'runout') pStats[fId].runOuts += 1;
        }
      });
    }

    Object.values(pStats).forEach((ps: any) => {
      ps.matchCount = ps.matchesSeen.size;
      ps.cvp = calculatePlayerCVP(ps as any);
    });

    return Object.values(pStats).sort((a: any, b: any) => {
      if (b.cvp !== a.cvp) return b.cvp - a.cvp;
      if (b.runs !== a.runs) return b.runs - a.runs;
      return b.wickets - a.wickets;
    });
  }, [players, allDeliveries]);

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900 uppercase">League Rankings</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Validated Historical Match Analytics</p>
        </div>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-11 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="players" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Player Stats</TabsTrigger>
          <TabsTrigger value="teams" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Points Table</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          {isDeliveriesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Career Statistics...</p>
            </div>
          ) : (
            <>
              {topPlayers.some(p => p.cvp > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {topPlayers.filter(p => p.cvp > 0).slice(0, 3).map((player, idx) => (
                    <Link key={player.id} href={`/players/${player.id}`}>
                      <Card className={`relative overflow-hidden border-t-4 hover:shadow-lg transition-all cursor-pointer h-full ${idx === 0 ? 'border-t-secondary scale-105 shadow-xl bg-secondary/5' : 'border-t-primary'}`}>
                        {idx === 0 && <Badge className="absolute top-2 right-2 bg-secondary text-white font-black text-[9px] uppercase">League Leader</Badge>}
                        <CardHeader className="text-center">
                           <div className="mx-auto bg-slate-100 rounded-2xl w-24 h-24 flex items-center justify-center mb-2 overflow-hidden border-2 border-white shadow-inner">
                            {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" /> : <UserCircle className="w-10 h-10 text-slate-300" />}
                          </div>
                          <CardTitle className="text-xl font-black text-slate-900 group-hover:text-primary uppercase tracking-tighter">{player.name}</CardTitle>
                          <CardDescription className="font-black text-[10px] uppercase tracking-widest text-slate-400">{player.role}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pb-8">
                           <div className="flex justify-center gap-6">
                              <div>
                                 <p className="text-3xl font-black text-primary">{player.runs || 0}</p>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Runs</p>
                              </div>
                              <div className="w-px bg-slate-100" />
                              <div>
                                 <p className="text-3xl font-black text-secondary">{player.wickets || 0}</p>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Wkts</p>
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}

              <Card className="shadow-sm border rounded-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global Player Pool (Live History Sync)</CardTitle>
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
                          <TableHead className="text-right text-[10px] font-black uppercase">Matches</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">CVP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPlayers.map((player, idx) => (
                          <TableRow key={player.id} className={idx < 3 && player.cvp > 0 ? 'bg-slate-50/30' : ''}>
                            <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <Link href={`/players/${player.id}`} className="font-black text-primary hover:underline text-xs flex items-center gap-2 uppercase tracking-tighter">
                                {player.name}
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                              </Link>
                              <div className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{player.role}</div>
                            </TableCell>
                            <TableCell className="text-right font-black text-xs">{player.runs || 0}</TableCell>
                            <TableCell className="text-right font-black text-xs">{player.wickets || 0}</TableCell>
                            <TableCell className="text-right font-black text-xs text-slate-400">{player.matchCount || 0}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-black px-2 text-[10px] border-slate-200">
                                {player.cvp?.toFixed(1) || 0}
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
          )}
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          {teamStandings.length > 0 ? (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#f0f4f3]">
                    <TableRow className="border-b-0">
                      <TableHead className="w-12 text-[10px] font-black uppercase text-center">Rank</TableHead>
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
                              <Avatar className="h-8 w-8 rounded-lg border">
                                <AvatarImage src={team.logoUrl} className="object-cover" />
                                <AvatarFallback className="bg-slate-100 rounded-lg font-black text-[10px]">{team.name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-black text-primary hover:underline text-xs uppercase tracking-tighter">{team.name}</span>
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
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No team statistics available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
