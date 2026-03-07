"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight, Loader2, User, Star, Target, Zap, Shield, Hand } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { cn } from '@/lib/utils';

type LeaderboardCategory = 'runs' | 'wickets' | 'avg' | 'sr' | 'econ' | 'catches' | 'runouts' | 'potm';

export default function RankingsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('runs');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches, isLoading: isMatchesLoading } = useCollection(matchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const teamStandings = useMemo(() => {
    if (!isMounted || !teams?.length || !matches || !rawDeliveries) return [];
    const standings: Record<string, any> = {};
    
    teams.forEach(t => {
      standings[t.id] = { 
        id: t.id, name: t.name, logoUrl: t.logoUrl, 
        played: 0, won: 0, lost: 0, tied: 0, nr: 0, points: 0, 
        forR: 0, forB: 0, agR: 0, agB: 0,
        form: []
      };
    });

    matches.forEach(m => {
      if (m.status !== 'completed') return;
      const t1Id = m.team1Id; const t2Id = m.team2Id;
      if (!standings[t1Id] || !standings[t2Id]) return;
      
      standings[t1Id].played += 1; standings[t2Id].played += 1;
      const result = m.resultDescription?.toLowerCase() || '';
      
      if (result.includes('tied') || result.includes('drawn')) {
        standings[t1Id].tied++; standings[t1Id].points += 1;
        standings[t2Id].tied++; standings[t2Id].points += 1;
      } else if (result.includes('no result') || result.includes('abandoned')) {
        standings[t1Id].nr++; standings[t1Id].points += 1;
        standings[t2Id].nr++; standings[t2Id].points += 1;
      } else {
        const winnerId = result.includes(standings[t1Id].name.toLowerCase()) && result.includes('won') ? t1Id : (result.includes(standings[t2Id].name.toLowerCase()) && result.includes('won') ? t2Id : null);
        if (winnerId) {
          const loserId = winnerId === t1Id ? t2Id : t1Id;
          standings[winnerId].won++; standings[winnerId].points += 2;
          standings[loserId].lost++;
        } else {
          standings[t1Id].tied++; standings[t1Id].points += 1;
          standings[t2Id].tied++; standings[t2Id].points += 1;
        }
      }
    });

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const match = matches.find(m => m.id === matchId);
      if (!match || match.status !== 'completed') return;

      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingTeamId = battingTeamId === match.team1Id ? match.team2Id : match.team1Id;

      if (standings[battingTeamId]) {
        standings[battingTeamId].forR += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') standings[battingTeamId].forB += 1;
      }
      if (standings[bowlingTeamId]) {
        standings[bowlingTeamId].agR += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') standings[bowlingTeamId].agB += 1;
      }
    });

    return Object.values(standings).map((s: any) => {
      const forRR = s.forB > 0 ? (s.forR / (s.forB / 6)) : 0;
      const agRR = s.agB > 0 ? (s.agR / (s.agB / 6)) : 0;
      return { ...s, nrr: forRR - agRR };
    }).sort((a: any, b: any) => b.points - a.points || b.nrr - a.nrr);
  }, [teams, matches, rawDeliveries, isMounted]);

  const leaderboards = useMemo(() => {
    if (!isMounted || !players?.length || !rawDeliveries || !matches) return [];
    const stats: Record<string, any> = {};
    players.forEach(p => stats[p.id] = { id: p.id, name: p.name, runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, runouts: 0, potm: 0, matches: 0, outs: 0 });

    rawDeliveries.forEach(d => {
      const sId = d.strikerPlayerId; const bId = d.bowlerId || d.bowlerPlayerId; const fId = d.fielderPlayerId;
      if (stats[sId]) {
        stats[sId].runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') stats[sId].ballsFaced++;
      }
      if (stats[bId]) {
        stats[bId].runsConceded += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') stats[bId].ballsBowled++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats[bId].wickets++;
      }
      if (stats[fId]) {
        if (d.dismissalType === 'caught') stats[fId].catches++;
        if (d.dismissalType === 'runout') stats[fId].runouts++;
      }
      if (d.isWicket && d.batsmanOutPlayerId && stats[d.batsmanOutPlayerId]) stats[d.batsmanOutPlayerId].outs++;
    });

    matches.forEach(m => { 
      if (m.status === 'completed' && m.potmPlayerId && stats[m.potmPlayerId]) {
        stats[m.potmPlayerId].potm++; 
      }
    });

    return Object.values(stats).map((s: any) => ({
      ...s,
      avg: s.outs > 0 ? s.runs / s.outs : s.runs,
      sr: s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : 0,
      econ: s.ballsBowled >= 6 ? (s.runsConceded / (s.ballsBowled / 6)) : 0
    })).sort((a: any, b: any) => {
      const key = activeCategory;
      if (key === 'econ') return (a[key] || 99) - (b[key] || 99);
      return (b[key] || 0) - (a[key] || 0);
    }).slice(0, 10);
  }, [players, rawDeliveries, matches, activeCategory, isMounted]);

  if (!isMounted || isDeliveriesLoading || isMatchesLoading || isPlayersLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">League Rankings</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Official Series Standings & Leaderboards</p>
        </div>
      </div>

      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="points" className="font-black text-[10px] uppercase data-[state=active]:bg-white">Points Table</TabsTrigger>
          <TabsTrigger value="leaderboards" className="font-black text-[10px] uppercase data-[state=active]:bg-white">Leaderboards</TabsTrigger>
        </TabsList>

        <TabsContent value="points">
          <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 text-[10px] font-black uppercase">Pos</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Team</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">P</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">W</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">L</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">T/NR</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">NRR</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase bg-primary/5">PTS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStandings.map((team, idx) => (
                    <TableRow key={team.id} className="hover:bg-slate-50">
                      <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-6 w-6 rounded-none"><AvatarImage src={team.logoUrl} className="object-contain" /></Avatar>
                          <span className="font-black text-xs uppercase text-slate-800 truncate max-w-[100px]">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.played}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.won}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.lost}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.tied + team.nr}</TableCell>
                      <TableCell className={cn("text-center text-xs font-bold", team.nrr >= 0 ? "text-primary" : "text-amber-600")}>{team.nrr.toFixed(3)}</TableCell>
                      <TableCell className="text-center text-xs font-black text-primary bg-primary/5">{team.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboards" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'runs', label: 'Runs', icon: Zap },
              { id: 'wickets', label: 'Wickets', icon: Target },
              { id: 'avg', label: 'Avg', icon: User },
              { id: 'sr', label: 'SR', icon: Zap },
              { id: 'econ', label: 'Econ', icon: Shield },
              { id: 'catches', label: 'Catches', icon: Hand },
              { id: 'runouts', label: 'Run Outs', icon: Hand },
              { id: 'potm', label: 'POTM', icon: Star },
            ].map(cat => (
              <Button key={cat.id} size="sm" variant={activeCategory === cat.id ? 'default' : 'outline'} onClick={() => setActiveCategory(cat.id as any)} className="font-black text-[9px] uppercase tracking-widest h-8 px-4 rounded-full">
                <cat.icon className="w-3 h-3 mr-1" /> {cat.label}
              </Button>
            ))}
          </div>

          <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Player</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboards.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell>
                      <Link href={`/players/${p.id}`} className="font-black text-primary hover:underline text-xs uppercase">{p.name}</Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-black text-xs px-3">
                        {['avg', 'sr', 'econ'].includes(activeCategory) ? (p[activeCategory] || 0).toFixed(2) : (p[activeCategory] || 0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}