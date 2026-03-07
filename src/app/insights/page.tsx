
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, Medal, ChevronLeft, Swords, Target, Zap, TrendingUp, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function InsightsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');

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

  const h2hStats = useMemo(() => {
    if (!deliveries || !p1Id || !p2Id) return null;

    const stats = {
      p1BatVsP2Bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0 },
      p2BatVsP1Bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0 }
    };

    deliveries.forEach(d => {
      const bId = d.bowlerId || d.bowlerPlayerId;
      
      // P1 Batting vs P2 Bowling
      if (d.strikerPlayerId === p1Id && bId === p2Id) {
        stats.p1BatVsP2Bowl.runs += (d.runsScored || 0);
        if (d.extraType === 'none') stats.p1BatVsP2Bowl.balls++;
        if (d.runsScored === 4) stats.p1BatVsP2Bowl.fours++;
        if (d.runsScored === 6) stats.p1BatVsP2Bowl.sixes++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats.p1BatVsP2Bowl.wkts++;
      }

      // P2 Batting vs P1 Bowling
      if (d.strikerPlayerId === p2Id && bId === p1Id) {
        stats.p2BatVsP1Bowl.runs += (d.runsScored || 0);
        if (d.extraType === 'none') stats.p2BatVsP1Bowl.balls++;
        if (d.runsScored === 4) stats.p2BatVsP1Bowl.fours++;
        if (d.runsScored === 6) stats.p2BatVsP1Bowl.sixes++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats.p2BatVsP1Bowl.wkts++;
      }
    });

    return stats;
  }, [deliveries, p1Id, p2Id]);

  const milestones = useMemo(() => {
    if (!players || !deliveries || !matches) return null;
    
    const fast30: any[] = [];
    const hats: any[] = [];
    const winKnocks: any[] = [];

    // 1. FASTEST 30
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

    // 4. CAREER FASTEST
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

  const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Pro Insights</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Advanced league analytics engine</p>
        </div>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="matches" className="font-bold text-[7px] uppercase">Ranks</TabsTrigger>
          <TabsTrigger value="comparison" className="font-bold text-[7px] uppercase">H2H</TabsTrigger>
          <TabsTrigger value="f30" className="font-bold text-[7px] uppercase">Fast 30</TabsTrigger>
          <TabsTrigger value="hats" className="font-bold text-[7px] uppercase">Hats</TabsTrigger>
          <TabsTrigger value="knocks" className="font-bold text-[7px] uppercase">Finisher</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-8 animate-in fade-in zoom-in-95">
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Swords className="w-5 h-5 text-primary" /> Battle History</h2>
            
            <Card className="border-none shadow-xl bg-white p-6 space-y-6 rounded-3xl">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Player A</Label>
                  <Select value={p1Id} onValueChange={setP1Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Player" /></SelectTrigger>
                    <SelectContent>
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">VS</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Player B</Label>
                  <Select value={p2Id} onValueChange={setP2Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Player" /></SelectTrigger>
                    <SelectContent>
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {h2hStats && p1Id && p2Id ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">SCENARIO ONE</p>
                  <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden rounded-3xl">
                    <div className="p-4 bg-primary flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase truncate">{getPlayerName(p1Id)} <span className="opacity-50">vs</span> {getPlayerName(p2Id)}</span>
                      <Badge className="bg-white text-primary font-black text-[10px] uppercase">BAT VS BOWL</Badge>
                    </div>
                    <div className="p-6 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Runs</p><p className="text-2xl font-black">{h2hStats.p1BatVsP2Bowl.runs}</p></div>
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Balls</p><p className="text-2xl font-black">{h2hStats.p1BatVsP2Bowl.balls}</p></div>
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Dismissals</p><p className="text-2xl font-black text-red-500">{h2hStats.p1BatVsP2Bowl.wkts}</p></div>
                    </div>
                    <div className="px-6 pb-6 pt-2 flex justify-center gap-4 border-t border-white/5">
                      <div className="text-[10px] font-black uppercase text-slate-500">SR: <span className="text-white">{h2hStats.p1BatVsP2Bowl.balls > 0 ? ((h2hStats.p1BatVsP2Bowl.runs / h2hStats.p1BatVsP2Bowl.balls) * 100).toFixed(1) : '0.0'}</span></div>
                      <div className="text-[10px] font-black uppercase text-slate-500">BOUNDARIES: <span className="text-white">{h2hStats.p1BatVsP2Bowl.fours + h2hStats.p1BatVsP2Bowl.sixes}</span></div>
                    </div>
                  </Card>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">SCENARIO TWO</p>
                  <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden rounded-3xl">
                    <div className="p-4 bg-secondary flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase truncate">{getPlayerName(p2Id)} <span className="opacity-50">vs</span> {getPlayerName(p1Id)}</span>
                      <Badge className="bg-white text-secondary font-black text-[10px] uppercase">BAT VS BOWL</Badge>
                    </div>
                    <div className="p-6 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Runs</p><p className="text-2xl font-black">{h2hStats.p2BatVsP1Bowl.runs}</p></div>
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Balls</p><p className="text-2xl font-black">{h2hStats.p2BatVsP1Bowl.balls}</p></div>
                      <div><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Dismissals</p><p className="text-2xl font-black text-red-500">{h2hStats.p2BatVsP1Bowl.wkts}</p></div>
                    </div>
                    <div className="px-6 pb-6 pt-2 flex justify-center gap-4 border-t border-white/5">
                      <div className="text-[10px] font-black uppercase text-slate-500">SR: <span className="text-white">{h2hStats.p2BatVsP1Bowl.balls > 0 ? ((h2hStats.p2BatVsP1Bowl.runs / h2hStats.p2BatVsP1Bowl.balls) * 100).toFixed(1) : '0.0'}</span></div>
                      <div className="text-[10px] font-black uppercase text-slate-500">BOUNDARIES: <span className="text-white">{h2hStats.p2BatVsP1Bowl.fours + h2hStats.p2BatVsP1Bowl.sixes}</span></div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                <Search className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select two players to scan rivalry</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-8 animate-in fade-in">
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 px-2"><Medal className="w-5 h-5 text-amber-500" /> Fastest to 50 Runs</h2>
            <div className="space-y-3">
              {milestones?.career.filter(p => p.runs >= 50).sort((a,b) => a.matches - b.matches).slice(0, 3).map((m, i) => (
                <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl">
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
                <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl">
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
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl">
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
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl">
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
              <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl">
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
