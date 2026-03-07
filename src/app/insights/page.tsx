"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Target, Swords, Clock, Star, Medal, ChevronLeft, Button } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function InsightsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: deliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const milestones = useMemo(() => {
    if (!players || !deliveries || !matches) return null;
    
    const fast30: any[] = [];
    const hats: any[] = [];
    const winKnocks: any[] = [];
    const matchRuns: Record<string, { runs: number, wickets: number, matches: number }> = {};

    // 1. FASTEST 30 (T10 STYLE)
    const pInnings: Record<string, Record<string, any>> = {};
    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId;
      if (!pInnings[sId]) pInnings[sId] = {};
      if (!pInnings[sId][matchId!]) pInnings[sId][matchId!] = { runs: 0, balls: 0, recorded: false };
      
      const s = pInnings[sId][matchId!];
      if (s.recorded) return;

      s.runs += (d.runsScored || 0);
      if (d.extraType === 'none') s.balls++;

      if (s.runs >= 30) {
        s.recorded = true;
        fast30.push({ name: players.find(p => p.id === sId)?.name, balls: s.balls, runs: s.runs, matchId });
      }
    });

    // 2. HAT-TRICKS
    const sorted = [...deliveries].sort((a,b) => a.timestamp - b.timestamp);
    const bBals: Record<string, Record<string, any[]>> = {};
    sorted.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (!bId || bId === 'none') return;
      if (!bBals[bId]) bBals[bId] = {};
      if (!bBals[bId][matchId!]) bBals[bId][matchId!] = [];
      
      const isWkt = d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '');
      bBals[bId][matchId!].push(isWkt);
      
      const balls = bBals[bId][matchId!];
      if (balls.length >= 3 && balls.slice(-3).every(v => v === true)) {
        hats.push({ name: players.find(p => p.id === bId)?.name, matchId });
      }
    });

    // 3. MATCH WINNING KNOCKS
    matches.filter(m => m.status === 'completed' && m.resultDescription?.includes('won')).forEach(m => {
      const matchDeliveries = deliveries.filter(d => d.__fullPath?.includes(m.id)).sort((a,b) => a.timestamp - b.timestamp);
      const lastBall = matchDeliveries[matchDeliveries.length - 1];
      if (!lastBall) return;

      const heroId = lastBall.strikerPlayerId;
      const heroStats = matchDeliveries.filter(d => d.strikerPlayerId === heroId);
      const runs = heroStats.reduce((acc, d) => acc + (d.runsScored || 0), 0);
      const balls = heroStats.filter(d => d.extraType === 'none').length;

      if (runs > 10) {
        winKnocks.push({ name: players.find(p => p.id === heroId)?.name, runs, balls, matchId: m.id });
      }
    });

    // 4. CAREER FASTEST (By Matches)
    const career: Record<string, { runs: number, wkts: number, matches: Set<string> }> = {};
    players.forEach(p => career[p.id] = { runs: 0, wkts: 0, matches: new Set() });

    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId) return;
      const sId = d.strikerPlayerId;
      const bId = d.bowlerId || d.bowlerPlayerId;

      if (career[sId]) {
        career[sId].runs += (d.runsScored || 0);
        career[sId].matches.add(matchId);
      }
      if (bId && career[bId]) {
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) career[bId].wkts++;
        career[bId].matches.add(matchId);
      }
    });

    return { 
      f30: fast30.sort((a,b) => a.balls - b.balls).slice(0, 5),
      hats: hats.slice(0, 5),
      knocks: winKnocks.sort((a,b) => a.balls - b.balls).slice(0, 5),
      career: Object.entries(career).map(([id, stats]) => ({
        name: players.find(p => p.id === id)?.name,
        runs: stats.runs,
        wkts: stats.wkts,
        matches: stats.matches.size
      }))
    };
  }, [players, deliveries, matches]);

  if (!isMounted || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase text-slate-400">Processing Milestones...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Fastest Milestones</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Calculated from verified league logs</p>
        </div>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="matches" className="font-bold text-[8px] uppercase">By Matches</TabsTrigger>
          <TabsTrigger value="f30" className="font-bold text-[8px] uppercase">Fastest 30</TabsTrigger>
          <TabsTrigger value="hats" className="font-bold text-[8px] uppercase">Hat-Tricks</TabsTrigger>
          <TabsTrigger value="knocks" className="font-bold text-[8px] uppercase">Win Knocks</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 px-2"><Medal className="w-5 h-5 text-amber-500" /> Fastest to 50 Runs</h2>
            <div className="space-y-3">
              {milestones?.career.filter(p => p.runs >= 50).sort((a,b) => a.matches - b.matches).slice(0, 3).map((m, i) => (
                <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                  <div><p className="text-xs font-black uppercase">{m.name}</p><p className="text-[8px] font-bold text-slate-400">Took {m.matches} Matches</p></div>
                  <Badge className="bg-amber-100 text-amber-700 h-8 px-4 font-black">RANK {i+1}</Badge>
                </Card>
              )) || <NoDataMessage />}
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 px-2"><Medal className="w-5 h-5 text-blue-500" /> Fastest to 10 Wickets</h2>
            <div className="space-y-3">
              {milestones?.career.filter(p => p.wkts >= 10).sort((a,b) => a.matches - b.matches).slice(0, 3).map((m, i) => (
                <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                  <div><p className="text-xs font-black uppercase">{m.name}</p><p className="text-[8px] font-bold text-slate-400">Took {m.matches} Matches</p></div>
                  <Badge className="bg-blue-100 text-blue-700 h-8 px-4 font-black">RANK {i+1}</Badge>
                </Card>
              )) || <NoDataMessage />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="f30" className="space-y-4">
          <h2 className="text-lg font-black uppercase px-2">Fewest Balls to 30</h2>
          <div className="space-y-3">
            {milestones?.f30.length ? milestones.f30.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                <div><p className="text-xs font-black uppercase">{m.name}</p><p className="text-[8px] font-bold text-slate-400">Reached {m.runs} Runs</p></div>
                <Badge className="bg-emerald-100 text-emerald-700 font-black h-8 px-4">{m.balls} BALLS</Badge>
              </Card>
            )) : <NoDataMessage />}
          </div>
        </TabsContent>

        <TabsContent value="hats" className="space-y-4">
          <h2 className="text-lg font-black uppercase px-2">Verified Hat-Tricks</h2>
          <div className="space-y-3">
            {milestones?.hats.length ? milestones.hats.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                <div><p className="text-xs font-black uppercase">{m.name}</p><p className="text-[8px] font-bold text-slate-400">3 in 3 Deliveries</p></div>
                <Badge className="bg-red-100 text-red-700 font-black h-8 px-4 uppercase text-[10px]">Validated</Badge>
              </Card>
            )) : <NoDataMessage />}
          </div>
        </TabsContent>

        <TabsContent value="knocks" className="space-y-4">
          <h2 className="text-lg font-black uppercase px-2">Fastest Finishers</h2>
          <div className="space-y-3">
            {milestones?.knocks.length ? milestones.knocks.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                <div><p className="text-xs font-black uppercase">{m.name}</p><p className="text-[8px] font-bold text-slate-400">{m.runs}* winning runs</p></div>
                <Badge className="bg-indigo-100 text-indigo-700 font-black h-8 px-4">{m.balls} BALLS</Badge>
              </Card>
            )) : <NoDataMessage />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoDataMessage() {
  return (
    <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
      <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Achievements Recorded Yet</p>
    </div>
  );
}
