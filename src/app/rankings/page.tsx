
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight, Loader2, User, Star, Target, Zap, Shield, Hand, ChevronLeft, TrendingUp, Clock } from 'lucide-react';
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
    const validMatchIds = new Set(matches.filter(m => m.status === 'completed').map(m => m.id));
    if (validMatchIds.size === 0) return [];

    const standings: Record<string, any> = {};
    teams.forEach(t => standings[t.id] = { id: t.id, name: t.name, played: 0, won: 0, lost: 0, tied: 0, nr: 0, points: 0, forR: 0, forB: 0, agR: 0, agB: 0, nrr: 0 });

    matches.forEach(m => {
      if (m.status !== 'completed') return;
      standings[m.team1Id].played++; standings[m.team2Id].played++;
      
      // Precision ID Check
      if (m.isTie) {
        standings[m.team1Id].tied++; standings[m.team2Id].tied++;
        standings[m.team1Id].points += 1; standings[m.team2Id].points += 1;
      } else if (m.winnerTeamId && m.winnerTeamId !== 'none' && standings[m.winnerTeamId]) {
        const winner = m.winnerTeamId;
        const loser = winner === m.team1Id ? m.team2Id : m.team1Id;
        standings[winner].won++; standings[winner].points += 2;
        if (standings[loser]) standings[loser].lost++;
      } else {
        // Fallback or NR
        const res = m.resultDescription?.toLowerCase() || '';
        if (res.includes('won')) {
          const winnerTeamId = teams.find(t => res.includes(t.name.toLowerCase()))?.id;
          if (winnerTeamId && standings[winnerTeamId]) {
            standings[winnerTeamId].won++; standings[winnerTeamId].points += 2;
            const loser = winnerTeamId === m.team1Id ? m.team2Id : m.team1Id;
            if (standings[loser]) standings[loser].lost++;
          } else { 
            standings[m.team1Id].nr++; standings[m.team2Id].nr++; 
            standings[m.team1Id].points++; standings[m.team2Id].points++; 
          }
        } else {
          standings[m.team1Id].nr++; standings[m.team2Id].nr++;
          standings[m.team1Id].points += 1; standings[m.team2Id].points += 1;
        }
      }
    });

    rawDeliveries.forEach(d => {
      const mid = d.__fullPath?.split('/')[1]; if (!mid || !validMatchIds.has(mid)) return;
      const match = matches.find(m => m.id === mid); if (!match) return;
      const inn = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const batId = inn === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlId = batId === match.team1Id ? match.team2Id : match.team1Id;
      
      if (standings[batId]) {
        standings[batId].forR += (d.totalRunsOnDelivery || 0); 
        if (d.extraType === 'none') standings[batId].forB++;
      }
      if (standings[bowlId]) {
        standings[bowlId].agR += (d.totalRunsOnDelivery || 0); 
        if (d.extraType === 'none') standings[bowlId].agB++;
      }
    });

    return Object.values(standings).map((s: any) => {
      const forO = s.forB / 6; const agO = s.agB / 6;
      s.nrr = (forO > 0 ? s.forR / forO : 0) - (agO > 0 ? s.agR / agO : 0);
      return s;
    }).sort((a,b) => b.points !== a.points ? b.points - a.points : b.nrr - a.nrr);
  }, [teams, matches, rawDeliveries, isMounted]);

  const playerLeaderboards = useMemo(() => {
    if (!players || !rawDeliveries || !matches || matches.length === 0) return {};
    const validMatchIds = new Set(matches.map(m => m.id));
    const stats: Record<string, any> = {};
    players.forEach(p => stats[p.id] = { id: p.id, name: p.name, runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runouts: 0, outs: 0, potm: 0 });
    matches.forEach(m => { if (m.potmPlayerId && stats[m.potmPlayerId]) stats[m.potmPlayerId].potm++; });
    
    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !validMatchIds.has(matchId)) return;

      const s = stats[d.strikerPlayerId]; if (s) { s.runs += d.runsScored || 0; if (d.extraType !== 'wide') s.balls++; }
      if (d.isWicket && stats[d.batsmanOutPlayerId]) stats[d.batsmanOutPlayerId].outs++;
      const bId = d.bowlerId || d.bowlerPlayerId; const b = stats[bId];
      if (b) { b.runsCon += d.totalRunsOnDelivery; if (d.extraType === 'none') b.ballsB++; if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) b.wkts++; }
      const f = stats[d.fielderPlayerId]; if (f) { if (d.dismissalType === 'caught') f.catches++; if (d.dismissalType === 'runout') f.runouts++; }
    });
    const list = Object.values(stats).map((s: any) => ({ ...s, avg: s.outs > 0 ? s.runs / s.outs : s.runs, sr: s.balls > 0 ? (s.runs / s.balls) * 100 : 0, er: s.ballsB >= 6 ? (s.runsCon / (s.ballsB / 6)) : 0 }));
    const filtered = (cat: string) => list.filter(p => cat === 'runs' ? p.runs > 0 : cat === 'wickets' ? p.wkts > 0 : cat === 'avg' ? p.runs > 20 : cat === 'sr' ? p.balls > 10 : cat === 'er' ? p.ballsB >= 12 : true);
    return { runs: [...filtered('runs')].sort((a,b) => b.runs - a.runs).slice(0, 10), wickets: [...filtered('wickets')].sort((a,b) => b.wkts - a.wkts).slice(0, 10), avg: [...filtered('avg')].sort((a,b) => b.avg - a.avg).slice(0, 10), sr: [...filtered('sr')].sort((a,b) => b.sr - a.sr).slice(0, 10), er: [...filtered('er')].sort((a,b) => a.er - b.er).slice(0, 10), catches: [...filtered('catches')].sort((a,b) => b.catches - a.catches).slice(0, 10), runouts: [...filtered('runouts')].sort((a,b) => b.runouts - a.runouts).slice(0, 10), potm: [...filtered('potm')].sort((a,b) => b.potm - a.potm).slice(0, 10) };
  }, [players, rawDeliveries, matches]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button><h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">League Rankings</h1></div>
      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-12 bg-slate-100 p-1 rounded-xl mb-8"><TabsTrigger value="points" className="font-black text-[10px] uppercase">Points Table</TabsTrigger><TabsTrigger value="leaderboards" className="font-black text-[10px] uppercase">Leaderboards</TabsTrigger></TabsList>
        <TabsContent value="points">
          {teamStandings.length === 0 ? <NoDataMessage /> : (
            <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="w-12 text-[10px] font-black uppercase">Pos</TableHead><TableHead className="text-[10px] font-black uppercase">Team</TableHead><TableHead className="text-center text-[10px] font-black uppercase">P</TableHead><TableHead className="text-center text-[10px] font-black uppercase">W</TableHead><TableHead className="text-center text-[10px] font-black uppercase">L</TableHead><TableHead className="text-center text-[10px] font-black uppercase">T</TableHead><TableHead className="text-center text-[10px] font-black uppercase">NR</TableHead><TableHead className="text-center text-[10px] font-black uppercase">NRR</TableHead><TableHead className="text-center text-[10px] font-black uppercase bg-primary/5">PTS</TableHead></TableRow></TableHeader><TableBody>{teamStandings.map((t, idx) => (<TableRow key={t.id}><TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell><TableCell className="font-black text-xs uppercase truncate max-w-[120px]"><Link href={`/teams/${t.id}`} className="hover:text-primary">{t.name}</Link></TableCell><TableCell className="text-center text-xs font-bold">{t.played}</TableCell><TableCell className="text-center text-xs font-bold text-emerald-600">{t.won}</TableCell><TableCell className="text-center text-xs font-bold text-red-600">{t.lost}</TableCell><TableCell className="text-center text-xs font-bold text-amber-600">{t.tied}</TableCell><TableCell className="text-center text-xs font-bold text-slate-500">{t.nr}</TableCell><TableCell className={cn("text-center text-xs font-bold", t.nrr >= 0 ? "text-primary" : "text-amber-600")}>{t.nrr >= 0 ? '+' : ''}{t.nrr.toFixed(3)}</TableCell><TableCell className="text-center text-xs font-black text-primary bg-primary/5">{t.points}</TableCell></TableRow>))}</TableBody></Table></Card>
          )}
        </TabsContent>
        <TabsContent value="leaderboards" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center"><h2 className="text-lg font-black uppercase flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> Player Rankings</h2><Select value={activeCategory} onValueChange={setActiveCategory}><SelectTrigger className="w-full md:w-[200px] h-12 font-black uppercase text-[10px]"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent className="z-[200]">{[ {id:'runs', label:'Runs'}, {id:'wickets', label:'Wickets'}, {id:'avg', label:'Average'}, {id:'sr', label:'Strike Rate'}, {id:'er', label:'Economy'}, {id:'catches', label:'Catches'}, {id:'runouts', label:'Run Outs'}, {id:'potm', label:'POTM'} ].map(c => <SelectItem key={c.id} value={c.id} className="font-black uppercase text-[10px]">{c.label}</SelectItem>)}</SelectContent></Select></div>
          {(!playerLeaderboards[activeCategory] || playerLeaderboards[activeCategory].length === 0) ? <NoDataMessage /> : (
            <Card className="border shadow-sm rounded-2xl overflow-hidden bg-white"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead><TableHead className="text-[10px] font-black uppercase">Player</TableHead><TableHead className="text-right text-[10px] font-black uppercase bg-primary/5">Score</TableHead></TableRow></TableHeader><TableBody>{playerLeaderboards[activeCategory].map((p: any, idx: number) => (<TableRow key={p.id}><TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell><TableCell className="font-black text-xs uppercase"><Link href={`/players/${p.id}`} className="hover:text-primary">{p.name}</Link></TableCell><TableCell className="text-right font-black text-primary bg-primary/5">{['avg', 'sr', 'er'].includes(activeCategory) ? p[activeCategory].toFixed(2) : p[activeCategory]}</TableCell></TableRow>))}</TableBody></Table></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoDataMessage() {
  return (
    <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center">
      <Clock className="w-10 h-10 text-slate-200 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Match History Recorded</p>
    </div>
  );
}
