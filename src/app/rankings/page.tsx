
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight, Loader2, User, Star, Target, Zap, Shield, Hand, ChevronLeft, TrendingUp } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RankingsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('runs');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);
  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);
  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);
  const deliveriesQuery = useMemoFirebase(() => { if (!isMounted) return null; return query(collectionGroup(db, 'deliveryRecords')); }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const teamStandings = useMemo(() => {
    if (!isMounted || !teams || !matches || !rawDeliveries) return [];
    const standings: Record<string, any> = {};
    teams.forEach(t => standings[t.id] = { id: t.id, name: t.name, played: 0, won: 0, lost: 0, tied: 0, points: 0, forR: 0, forB: 0, agR: 0, agB: 0 });

    matches.forEach(m => {
      if (m.status !== 'completed') return;
      [m.team1Id, m.team2Id].forEach(tid => { if (standings[tid]) standings[tid].played++; });
      const res = m.resultDescription?.toLowerCase() || '';
      if (res.includes('won')) {
        const winner = teams.find(t => res.includes(t.name.toLowerCase()))?.id;
        if (winner) { standings[winner].won++; standings[winner].points += 2; const loser = winner === m.team1Id ? m.team2Id : m.team1Id; if (standings[loser]) standings[loser].lost++; }
      } else { [m.team1Id, m.team2Id].forEach(tid => { if (standings[tid]) { standings[tid].tied++; standings[tid].points += 1; } }); }
    });

    return Object.values(standings).sort((a: any, b: any) => b.points - a.points);
  }, [teams, matches, rawDeliveries, isMounted]);

  const playerLeaderboards = useMemo(() => {
    if (!players || !rawDeliveries || !matches) return {};
    const stats: Record<string, any> = {};
    players.forEach(p => {
      stats[p.id] = { 
        id: p.id, name: p.name, runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, 
        catches: 0, runouts: 0, outs: 0, potm: 0 
      };
    });

    matches.forEach(m => { if (m.potmPlayerId && stats[m.potmPlayerId]) stats[m.potmPlayerId].potm++; });

    rawDeliveries.forEach(d => {
      const s = stats[d.strikerPlayerId];
      if (s) { s.runs += (d.runsScored || 0); if (d.extraType !== 'wide') s.balls++; }
      if (d.isWicket && stats[d.batsmanOutPlayerId]) stats[d.batsmanOutPlayerId].outs++;
      
      const bId = d.bowlerId || d.bowlerPlayerId;
      const b = stats[bId];
      if (b) {
        b.runsCon += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsB++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) b.wkts++;
      }

      const f = stats[d.fielderPlayerId];
      if (f) {
        if (d.dismissalType === 'caught') f.catches++;
        if (d.dismissalType === 'runout') f.runouts++;
      }
    });

    const list = Object.values(stats).map((s: any) => ({
      ...s,
      avg: s.outs > 0 ? s.runs / s.outs : s.runs,
      sr: s.balls > 0 ? (s.runs / s.balls) * 100 : 0,
      er: s.ballsB >= 6 ? (s.runsCon / (s.ballsB / 6)) : 0
    }));

    return {
      runs: [...list].sort((a,b) => b.runs - a.runs).slice(0, 10),
      wickets: [...list].sort((a,b) => b.wkts - a.wkts).slice(0, 10),
      avg: [...list].filter(s => s.runs > 20).sort((a,b) => b.avg - a.avg).slice(0, 10),
      sr: [...list].filter(s => s.balls > 10).sort((a,b) => b.sr - a.sr).slice(0, 10),
      er: [...list].filter(s => s.ballsB >= 12).sort((a,b) => a.er - b.er).slice(0, 10),
      catches: [...list].sort((a,b) => b.catches - a.catches).slice(0, 10),
      runouts: [...list].sort((a,b) => b.runouts - a.runouts).slice(0, 10),
      potm: [...list].sort((a,b) => b.potm - a.potm).slice(0, 10)
    };
  }, [players, rawDeliveries, matches]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  const categories = [
    { id: 'runs', label: 'Runs', icon: Zap, suffix: '' },
    { id: 'wickets', label: 'Wickets', icon: Target, suffix: '' },
    { id: 'avg', label: 'Average', icon: TrendingUp, suffix: '' },
    { id: 'sr', label: 'Strike Rate', icon: Zap, suffix: '' },
    { id: 'er', label: 'Economy', icon: Shield, suffix: '' },
    { id: 'catches', label: 'Catches', icon: Hand, suffix: '' },
    { id: 'runouts', label: 'Run Outs', icon: Hand, suffix: '' },
    { id: 'potm', label: 'POTM Awards', icon: Star, suffix: '' },
  ];

  const currentLeaderboard = (playerLeaderboards as any)[activeCategory] || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">League Rankings</h1>
      </div>
      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="points" className="font-black text-[10px] uppercase">Points Table</TabsTrigger>
          <TabsTrigger value="leaderboards" className="font-black text-[10px] uppercase">Leaderboards</TabsTrigger>
        </TabsList>
        
        <TabsContent value="points">
          <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-[10px] font-black uppercase">Pos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Team</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">P</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">W</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase bg-primary/5">PTS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStandings.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="font-black text-xs uppercase">{t.name}</TableCell>
                    <TableCell className="text-center text-xs font-bold">{t.played}</TableCell>
                    <TableCell className="text-center text-xs font-bold">{t.won}</TableCell>
                    <TableCell className="text-center text-xs font-black text-primary bg-primary/5">{t.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboards" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <h2 className="text-lg font-black uppercase flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> Player Rankings</h2>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="w-full md:w-[200px] h-12 font-black uppercase text-[10px]">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="font-black uppercase text-[10px]">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Player</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase bg-primary/5">
                    {categories.find(c => c.id === activeCategory)?.label}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLeaderboard.map((p: any, idx: number) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="font-black text-xs uppercase">
                      <Link href={`/players/${p.id}`} className="hover:text-primary transition-colors">{p.name}</Link>
                    </TableCell>
                    <TableCell className="text-right font-black text-primary bg-primary/5">
                      {activeCategory === 'avg' || activeCategory === 'sr' || activeCategory === 'er' 
                        ? p[activeCategory].toFixed(2) 
                        : p[activeCategory]}
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
