"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Zap, Target, Star, History, CheckCircle2, Clock, Swords } from 'lucide-react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function InsightsPage() {
  const db = useFirestore();
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
    
    const fastest30: any[] = [];
    const hatTricks: any[] = [];
    const winningKnocks: any[] = [];

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
      if (d.extraType !== 'wide') s.balls++;

      if (s.runs >= 30) {
        s.recorded = true;
        fastest30.push({ 
          name: players.find(p => p.id === sId)?.name, 
          balls: s.balls, 
          runs: s.runs,
          matchId 
        });
      }
    });

    // 2. FASTEST HAT-TRICK (Consecutive deliveries)
    const sorted = [...deliveries].sort((a,b) => a.timestamp - b.timestamp);
    const bBals: Record<string, Record<string, any[]>> = {};
    sorted.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (!bBals[bId]) bBals[bId] = {};
      if (!bBals[bId][matchId!]) bBals[bId][matchId!] = [];
      
      const isWkt = d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '');
      bBals[bId][matchId!].push(isWkt);
      
      const balls = bBals[bId][matchId!];
      if (balls.length >= 3 && balls.slice(-3).every(v => v === true)) {
        hatTricks.push({ 
          name: players.find(p => p.id === bId)?.name, 
          matchId 
        });
      }
    });

    // 3. MATCH WINNING KNOCK
    matches.filter(m => m.status === 'completed' && m.resultDescription?.includes('won')).forEach(m => {
      const winnerName = m.resultDescription?.split(' won')[0];
      const winnerTeamId = winnerName?.toLowerCase().includes(players.find(p => p.id === m.team1Id)?.name.toLowerCase() || '---') ? m.team1Id : m.team2Id;
      
      // Find deliveries for this match's final inning
      const matchDeliveries = deliveries.filter(d => d.__fullPath?.includes(m.id)).sort((a,b) => a.timestamp - b.timestamp);
      const lastBall = matchDeliveries[matchDeliveries.length - 1];
      if (!lastBall) return;

      const heroId = lastBall.strikerPlayerId;
      const heroStats = matchDeliveries.filter(d => d.strikerPlayerId === heroId);
      const runs = heroStats.reduce((acc, d) => acc + (d.runsScored || 0), 0);
      const balls = heroStats.filter(d => d.extraType !== 'wide').length;

      if (runs > 10) { // Threshold for a "knock"
        winningKnocks.push({
          name: players.find(p => p.id === heroId)?.name,
          runs,
          balls,
          matchId: m.id
        });
      }
    });

    return { 
      f30: fastest30.sort((a,b) => a.balls - b.balls).slice(0, 5),
      hats: hatTricks.slice(0, 5),
      knocks: winningKnocks.sort((a,b) => a.balls - b.balls).slice(0, 5)
    };
  }, [players, deliveries, matches]);

  if (!isMounted || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase text-slate-400">Syncing Intelligence...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <div className="bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Fastest Milestones</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Calculated from ball-by-ball history</p>
        </div>
      </div>

      <Tabs defaultValue="f30" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="f30" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary text-[10px] uppercase">Fastest 30</TabsTrigger>
          <TabsTrigger value="hattrick" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary text-[10px] uppercase">Hat-Tricks</TabsTrigger>
          <TabsTrigger value="knocks" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary text-[10px] uppercase">Win Knocks</TabsTrigger>
        </TabsList>

        <TabsContent value="f30" className="space-y-4">
          <div className="px-2 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black uppercase text-slate-900">T10 Sprint Leaderboard</h2>
          </div>
          <div className="space-y-3">
            {milestones?.f30.length ? milestones.f30.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between group hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs">{i+1}</div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900">{m.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Reached {m.runs} Runs</p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700 font-black h-8 px-4">{m.balls} BALLS</Badge>
              </Card>
            )) : <NoDataMessage />}
          </div>
        </TabsContent>

        <TabsContent value="hattrick" className="space-y-4">
          <div className="px-2 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-black uppercase text-slate-900">Triple-Strike Gallery</h2>
          </div>
          <div className="space-y-3">
            {milestones?.hats.length ? milestones.hats.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center font-black text-xs">W3</div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900">{m.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">3 Wickets in 3 Balls</p>
                  </div>
                </div>
                <Badge className="bg-red-50 text-red-600 border border-red-100 font-black uppercase text-[8px]">Validated</Badge>
              </Card>
            )) : <NoDataMessage />}
          </div>
        </TabsContent>

        <TabsContent value="knocks" className="space-y-4">
          <div className="px-2 mb-4 flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black uppercase text-slate-900">Match Finishers</h2>
          </div>
          <div className="space-y-3">
            {milestones?.knocks.length ? milestones.knocks.map((m, i) => (
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">{i+1}</div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900">{m.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{m.runs}* Runs at the death</p>
                  </div>
                </div>
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
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Player Has Achieved This Milestone Yet</p>
    </div>
  );
}
