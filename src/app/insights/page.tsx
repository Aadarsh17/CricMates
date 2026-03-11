
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  ChevronLeft, 
  Swords, 
  Search, 
  Crown, 
  Activity, 
  ChevronRight, 
  Flame, 
  Target, 
  TrendingUp, 
  Zap, 
  Award 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function InsightsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  const [cap1Id, setCap1Id] = useState<string>('');
  const [cap2Id, setCap2Id] = useState<string>('');
  const [rivalryMode, setRivalryMode] = useState<'player' | 'team'>('player');
  const [t1Id, setT1Id] = useState<string>('');
  const [t2Id, setT2Id] = useState<string>('');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: deliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const teamH2HStats = useMemo(() => {
    if (!matches || !t1Id || !t2Id) return null;
    const h2hMatches = matches.filter(m => 
      m.status === 'completed' && 
      ((m.team1Id === t1Id && m.team2Id === t2Id) || (m.team1Id === t2Id && m.team2Id === t1Id))
    );

    const stats = {
      total: h2hMatches.length,
      t1Wins: h2hMatches.filter(m => m.winnerTeamId === t1Id).length,
      t2Wins: h2hMatches.filter(m => m.winnerTeamId === t2Id).length,
      draws: h2hMatches.filter(m => m.isTie || m.winnerTeamId === 'none').length,
      recent: h2hMatches.sort((a,b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()).slice(0, 5)
    };
    return stats;
  }, [matches, t1Id, t2Id]);

  const h2hStats = useMemo(() => {
    if (!deliveries || !p1Id || !p2Id) return null;

    const stats = {
      p1BatVsP2Bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0 },
      p2BatVsP1Bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0 }
    };

    deliveries.forEach(d => {
      const bId = d.bowlerId || d.bowlerPlayerId;
      
      if (d.strikerPlayerId === p1Id && bId === p2Id) {
        stats.p1BatVsP2Bowl.runs += (d.runsScored || 0);
        if (d.extraType === 'none') stats.p1BatVsP2Bowl.balls++;
        if (d.runsScored === 4) stats.p1BatVsP2Bowl.fours++;
        if (d.runsScored === 6) stats.p1BatVsP2Bowl.sixes++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats.p1BatVsP2Bowl.wkts++;
      }

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

  const milestoneWatch = useMemo(() => {
    if (!players || players.length === 0) return [];
    
    const RUN_MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 5000];
    const WKT_MILESTONES = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200];

    const runData = players.filter(p => (p.runsScored || 0) > 0).map(p => {
      const runs = p.runsScored || 0;
      const next = RUN_MILESTONES.find(m => m > runs) || (Math.floor(runs / 100) + 1) * 100;
      const prev = [...RUN_MILESTONES].reverse().find(m => m <= runs) || 0;
      const diff = next - runs;
      const range = next - prev;
      const progress = ((runs - prev) / range) * 100;
      return { ...p, type: 'runs', next, diff, progress, label: `${diff} runs for ${next} Career Runs` };
    });

    const wktData = players.filter(p => (p.wicketsTaken || 0) > 0).map(p => {
      const wkts = p.wicketsTaken || 0;
      const next = WKT_MILESTONES.find(m => m > wkts) || (Math.floor(wkts / 10) + 1) * 10;
      const prev = [...WKT_MILESTONES].reverse().find(m => m <= wkts) || 0;
      const diff = next - wkts;
      const range = next - prev;
      const progress = ((wkts - prev) / range) * 100;
      return { ...p, type: 'wickets', next, diff, progress, label: `${diff} wkts for ${next} Career Wickets` };
    });

    return [...runData, ...wktData]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 6);
  }, [players]);

  const captainStats = useMemo(() => {
    if (!matches || !cap1Id || !cap2Id || !deliveries) return null;

    const getCapRecord = (cid: string) => {
      const rec = { played: 0, won: 0, lost: 0, tied: 0, runs: 0, wkts: 0 };
      matches.forEach(m => {
        if (m.status !== 'completed') return;
        const isC1 = m.team1CaptainId === cid;
        const isC2 = m.team2CaptainId === cid;
        if (!isC1 && !isC2) return;

        rec.played++;
        const myTeamId = isC1 ? m.team1Id : m.team2Id;
        if (m.isTie) rec.tied++;
        else if (m.winnerTeamId === myTeamId) rec.won++;
        else if (m.winnerTeamId && m.winnerTeamId !== 'none') rec.lost++;
      });

      deliveries.forEach(d => {
        const mid = d.__fullPath?.split('/')[1];
        const match = matches.find(m => m.id === mid);
        if (!match) return;
        const isC1 = match.team1CaptainId === cid;
        const isC2 = match.team2CaptainId === cid;
        if (!isC1 && !isC2) return;

        if (d.strikerPlayerId === cid) rec.runs += (d.runsScored || 0);
        const bId = d.bowlerId || d.bowlerPlayerId;
        if (bId === cid) {
          if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) rec.wkts++;
        }
      });

      return rec;
    };

    const h2h = { c1Won: 0, c2Won: 0, ties: 0 };
    matches.forEach(m => {
      if (m.status !== 'completed') return;
      const isC1_T1 = m.team1CaptainId === cap1Id;
      const isC1_T2 = m.team2CaptainId === cap1Id;
      const isC2_T1 = m.team1CaptainId === cap2Id;
      const isC2_T2 = m.team2CaptainId === cap2Id;

      if ((isC1_T1 && isC2_T2) || (isC1_T2 && isC2_T1)) {
        if (m.isTie) h2h.ties++;
        else if (m.winnerTeamId === (isC1_T1 ? m.team1Id : m.team2Id)) h2h.c1Won++;
        else h2h.c2Won++;
      }
    });

    return { cap1: getCapRecord(cap1Id), cap2: getCapRecord(cap2Id), h2h };
  }, [matches, cap1Id, cap2Id, deliveries]);

  if (!isMounted || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase text-slate-400">Processing Milestones...</p>
    </div>
  );

  const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || 'Unknown';
  const getTeamName = (id: string) => teams?.find(t => t.id === id)?.name || 'Unknown';

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

      <Tabs defaultValue="captaincy" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="captaincy" className="font-bold text-[10px] uppercase">Leader</TabsTrigger>
          <TabsTrigger value="comparison" className="font-bold text-[10px] uppercase">Rivalry</TabsTrigger>
          <TabsTrigger value="watchlist" className="font-bold text-[10px] uppercase">Watchlist</TabsTrigger>
        </TabsList>

        <TabsContent value="captaincy" className="space-y-8 animate-in fade-in zoom-in-95">
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Crown className="w-5 h-5 text-amber-500" /> Captaincy Analysis</h2>
            <Card className="border-none shadow-xl bg-white p-6 space-y-6 rounded-3xl">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Captain A</Label>
                  <Select value={cap1Id} onValueChange={setCap1Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Captain" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">VS</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Captain B</Label>
                  <Select value={cap2Id} onValueChange={setCap2Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Captain" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {captainStats ? (
              <div className="space-y-6">
                <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 bg-primary text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Leadership Head-to-Head</p>
                  </div>
                  <div className="p-6 grid grid-cols-3 items-center gap-4 text-center">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Wins</p>
                      <p className="text-3xl font-black">{captainStats.h2h.c1Won}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Ties</p>
                      <p className="text-xl font-black">{captainStats.h2h.ties}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Wins</p>
                      <p className="text-3xl font-black">{captainStats.h2h.c2Won}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: cap1Id, data: captainStats.cap1, color: 'border-primary' },
                    { id: cap2Id, data: captainStats.cap2, color: 'border-secondary' }
                  ].map((c, i) => (
                    <Card key={i} className={cn("border-t-8 shadow-lg p-5 space-y-4 rounded-3xl", c.color)}>
                      <p className="text-[10px] font-black uppercase text-slate-400 truncate">{getPlayerName(c.id)}</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Played</span>
                          <span className="font-black">{c.data.played}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Win %</span>
                          <span className="font-black text-emerald-600">{c.data.played > 0 ? ((c.data.won / c.data.played) * 100).toFixed(1) : '0.0'}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center pt-2">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Runs</p>
                            <p className="text-sm font-black">{c.data.runs}</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Wkts</p>
                            <p className="text-sm font-black">{c.data.wkts}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                <Crown className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select two leaders to compare captaincy impact</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-8 animate-in fade-in zoom-in-95">
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black uppercase flex items-center gap-2"><Swords className="w-5 h-5 text-primary" /> Rivalry Scan</h2>
              <div className="bg-slate-100 p-1 rounded-lg flex border">
                <Button variant={rivalryMode === 'player' ? "secondary" : "ghost"} size="sm" onClick={() => setRivalryMode('player')} className="h-7 text-[8px] font-black uppercase">Player</Button>
                <Button variant={rivalryMode === 'team' ? "secondary" : "ghost"} size="sm" onClick={() => setRivalryMode('team')} className="h-7 text-[8px] font-black uppercase">Team</Button>
              </div>
            </div>
            
            <Card className="border-none shadow-xl bg-white p-6 space-y-6 rounded-3xl">
              {rivalryMode === 'player' ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Select Player A</Label>
                    <Select value={p1Id} onValueChange={setP1Id}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Player" /></SelectTrigger>
                      <SelectContent className="max-h-[250px]">
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
                      <SelectContent className="max-h-[250px]">
                        {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Select Franchise A</Label>
                    <Select value={t1Id} onValueChange={setT1Id}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Team" /></SelectTrigger>
                      <SelectContent className="max-h-[250px]">
                        {teams?.map(t => <SelectItem key={t.id} value={t.id} className="font-bold">{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">VS</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Select Franchise B</Label>
                    <Select value={t2Id} onValueChange={setT2Id}>
                      <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Team" /></SelectTrigger>
                      <SelectContent className="max-h-[250px]">
                        {teams?.map(t => <SelectItem key={t.id} value={t.id} className="font-bold">{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </Card>

            {rivalryMode === 'player' && h2hStats && p1Id && p2Id ? (
              <div className="space-y-6">
                <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden rounded-3xl">
                  <div className="p-4 bg-primary flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase truncate">{getPlayerName(p1Id)} vs {getPlayerName(p2Id)}</span>
                    <Badge className="bg-white text-primary font-black text-[10px] uppercase">H2H IMPACT</Badge>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-[8px] font-black uppercase text-slate-500 text-center">{getPlayerName(p1Id)} Batting</p>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Runs</p><p className="text-xl font-black">{h2hStats.p1BatVsP2Bowl.runs}</p></div>
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Outs</p><p className="text-xl font-black text-red-500">{h2hStats.p1BatVsP2Bowl.wkts}</p></div>
                      </div>
                    </div>
                    <div className="space-y-4 border-l border-white/5 pl-8">
                      <p className="text-[8px] font-black uppercase text-slate-500 text-center">{getPlayerName(p2Id)} Batting</p>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Runs</p><p className="text-xl font-black">{h2hStats.p2BatVsP1Bowl.runs}</p></div>
                        <div><p className="text-[8px] font-bold text-slate-400 uppercase">Outs</p><p className="text-xl font-black text-red-500">{h2hStats.p2BatVsP1Bowl.wkts}</p></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : rivalryMode === 'team' && teamH2HStats && t1Id && t2Id ? (
              <div className="space-y-6">
                <Card className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 bg-primary text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Franchise Head-to-Head</p>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="text-center flex-1">
                        <p className="text-3xl font-black">{teamH2HStats.t1Wins}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">{getTeamName(t1Id)}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center min-w-[80px]">
                        <p className="text-xl font-black">{teamH2HStats.draws}</p>
                        <p className="text-[8px] font-black text-slate-500 uppercase">Ties/NR</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-black">{teamH2HStats.t2Wins}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">{getTeamName(t2Id)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500">
                        <span>Dominance Factor</span>
                        <span>{teamH2HStats.total} Encounters</span>
                      </div>
                      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="bg-primary h-full transition-all" style={{ width: `${(teamH2HStats.t1Wins / (teamH2HStats.total || 1)) * 100}%` }} />
                        <div className="bg-slate-700 h-full transition-all" style={{ width: `${(teamH2HStats.draws / (teamH2HStats.total || 1)) * 100}%` }} />
                        <div className="bg-secondary h-full transition-all" style={{ width: `${(teamH2HStats.t2Wins / (teamH2HStats.total || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-widest flex items-center gap-2">Recent H2H Encounters</h3>
                  <div className="space-y-2">
                    {teamH2HStats.recent.length > 0 ? teamH2HStats.recent.map(m => (
                      <Link key={m.id} href={`/match/${m.id}`}>
                        <Card className="p-4 border-none shadow-sm hover:shadow-md transition-all group flex items-center justify-between rounded-2xl bg-white mb-2">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-1 h-8 rounded-full", m.winnerTeamId === t1Id ? "bg-primary" : m.winnerTeamId === t2Id ? "bg-secondary" : "bg-slate-300")} />
                            <div>
                              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-primary transition-colors">{m.resultDescription}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(m.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </Card>
                      </Link>
                    )) : (
                      <div className="p-8 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                        <p className="text-[8px] font-black uppercase text-slate-300">No historical matches recorded for this pair</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                <Search className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select two {rivalryMode}s to scan rivalry</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-8 animate-in fade-in">
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2">
              <Activity className="w-5 h-5 text-primary" /> Milestone Watch
            </h2>
            <div className="space-y-4">
              {milestoneWatch.length > 0 ? milestoneWatch.map(p => (
                <Card key={`${p.id}-${p.type}`} className="p-5 border-none shadow-lg rounded-3xl bg-white space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black uppercase truncate">{p.name}</p>
                        {p.progress > 85 && <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />}
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        {p.label}
                      </p>
                    </div>
                    <Badge className={cn(
                      "font-black text-[9px] uppercase border-none h-6 px-3",
                      p.type === 'runs' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                    )}>
                      {p.type === 'runs' ? 'Runs Near' : 'Wkts Near'}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Progress value={p.progress} className="h-2 bg-slate-100" />
                    <div className="flex justify-between text-[7px] font-black uppercase tracking-tighter text-slate-400">
                      <span>Progress</span>
                      <span>{p.progress.toFixed(0)}% Accurate</span>
                    </div>
                  </div>
                </Card>
              )) : (
                <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                  <Target className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Awaiting significant milestones...</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
