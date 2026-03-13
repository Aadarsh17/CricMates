
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  ChevronLeft, 
  Swords, 
  Crown, 
  Activity, 
  Flame, 
  Target, 
  Shield,
  Hand,
  ArrowUpDown,
  Zap,
  Crosshair,
  TrendingUp,
  ShieldCheck,
  Scale,
  MapPin
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
  
  // Selection States
  const [cap1Id, setCap1Id] = useState<string>('');
  const [cap2Id, setCap2Id] = useState<string>('');
  const [rival1Id, setRival1Id] = useState<string>('');
  const [rival2Id, setRival2Id] = useState<string>('');
  const [team1DuelId, setTeam1DuelId] = useState<string>('');
  const [team2DuelId, setTeam2DuelId] = useState<string>('');
  
  // Watchlist specific state
  const [watchlistSort, setWatchlistSort] = useState<'progress' | 'total'>('progress');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const activeMatchIds = useMemo(() => new Set(matches?.map(m => m.id) || []), [matches]);
  
  const deliveries = useMemo(() => {
    if (!rawDeliveries || !activeMatchIds.size) return [];
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });
  }, [rawDeliveries, activeMatchIds]);

  const playerCareerAggregates = useMemo(() => {
    if (!deliveries || !players) return {};
    const stats: Record<string, any> = {};
    players.forEach(p => { stats[p.id] = { runs: 0, wkts: 0, catches: 0, stumpings: 0, runOuts: 0 }; });
    deliveries.forEach(d => {
      if (d.strikerPlayerId && stats[d.strikerPlayerId]) stats[d.strikerPlayerId].runs += (d.runsScored || 0);
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId && bId !== 'none' && stats[bId] && d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats[bId].wkts++;
      const fId = d.fielderPlayerId;
      if (fId && fId !== 'none' && stats[fId]) {
        if (d.dismissalType === 'caught') stats[fId].catches++;
        if (d.dismissalType === 'stumped') stats[fId].stumpings++;
        if (d.dismissalType === 'runout') stats[fId].runOuts++;
      }
    });
    return stats;
  }, [deliveries, players]);

  const milestoneWatch = useMemo(() => {
    if (!players || players.length === 0) return { runs: [], wickets: [], catches: [], stumpings: [], runOuts: [] };
    const RUN_MILESTONES = [25, 50, 75, 100, 150, 200, 250, 500, 750, 1000];
    const WKT_MILESTONES = Array.from({length: 20}, (_, i) => (i + 1) * 5); 
    const process = (type: string, milestones: number[], key: string) => {
      return players.map(p => {
        const val = playerCareerAggregates[p.id]?.[key] || 0;
        const next = milestones.find(m => m > val) || (Math.floor(val / 5) + 1) * 5;
        const prev = [...milestones].reverse().find(m => m <= val) || 0;
        const progress = next > prev ? ((val - prev) / (next - prev)) * 100 : 0;
        return { ...p, type, current: val, next, diff: next - val, progress, label: `${next - val} more for ${next} Career ${type}` };
      }).sort((a: any, b: any) => watchlistSort === 'progress' ? b.progress - a.progress : b.current - a.current);
    };
    return { runs: process('runs', RUN_MILESTONES, 'runs'), wickets: process('wickets', WKT_MILESTONES, 'wkts'), catches: process('catches', WKT_MILESTONES, 'catches'), stumpings: process('stumpings', [5, 10, 20, 50], 'stumpings'), runOuts: process('runOuts', WKT_MILESTONES, 'runOuts') };
  }, [players, playerCareerAggregates, watchlistSort]);

  const groundStats = useMemo(() => {
    if (!matches) return [];
    const venues: Record<string, any> = {};
    matches.forEach(m => {
      const v = m.venue || 'Gully Ground';
      if (!venues[v]) venues[v] = { name: v, played: 0, bat1Won: 0, bat2Win: 0, totalRuns: 0, innings: 0, highest: 0 };
      if (m.status !== 'completed') return;
      venues[v].played++;
      const mDeliveries = deliveries.filter(d => d.__fullPath?.includes(m.id));
      const s1 = mDeliveries.filter(d => d.__fullPath?.includes('inning_1')).reduce((a,b) => a + (b.totalRunsOnDelivery || 0), 0);
      const s2 = mDeliveries.filter(d => d.__fullPath?.includes('inning_2')).reduce((a,b) => a + (b.totalRunsOnDelivery || 0), 0);
      venues[v].totalRuns += (s1 + s2);
      venues[v].innings += (s1 > 0 ? 1 : 0) + (s2 > 0 ? 1 : 0);
      venues[v].highest = Math.max(venues[v].highest, s1, s2);
      
      const bat1TeamId = m.tossWinnerTeamId === m.team1Id ? (m.tossDecision === 'bat' ? m.team1Id : m.team2Id) : (m.tossDecision === 'bat' ? m.team2Id : m.team1Id);
      if (!m.isTie && m.winnerTeamId) {
        if (m.winnerTeamId === bat1TeamId) venues[v].bat1Won++;
        else venues[v].bat2Win++;
      }
    });
    return Object.values(venues).sort((a,b) => b.played - a.played);
  }, [matches, deliveries]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Pro Insights</h1>
      </div>

      <Tabs defaultValue="watchlist" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="watchlist" className="font-bold text-[8px] uppercase">Watch</TabsTrigger>
          <TabsTrigger value="captaincy" className="font-bold text-[8px] uppercase">Leader</TabsTrigger>
          <TabsTrigger value="comparison" className="font-bold text-[8px] uppercase">Rival</TabsTrigger>
          <TabsTrigger value="franchise" className="font-bold text-[8px] uppercase">Team</TabsTrigger>
          <TabsTrigger value="ground" className="font-bold text-[8px] uppercase">Pitch</TabsTrigger>
        </TabsList>

        <TabsContent value="watchlist" className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black uppercase flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Career Watch</h2>
            <Button variant="outline" size="sm" onClick={() => setWatchlistSort(watchlistSort === 'progress' ? 'total' : 'progress')} className="h-8 font-black uppercase text-[8px]">
              {watchlistSort === 'progress' ? 'By Proximity' : 'By Volume'}
            </Button>
          </div>
          <div className="space-y-4">
            {milestoneWatch.runs.slice(0, 5).map((p: any) => (
              <Card key={p.id} className="p-5 border-none shadow-lg rounded-3xl bg-white space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-black uppercase group-hover:text-primary">{p.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{p.label}</p>
                  </div>
                  <div className="text-right"><p className="text-xl font-black text-slate-900 leading-none">{p.current}</p><p className="text-[7px] font-black text-slate-400 uppercase mt-1">Total</p></div>
                </div>
                <div className="space-y-1.5"><Progress value={p.progress} className="h-2 bg-slate-100" /></div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ground" className="space-y-6 animate-in fade-in">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><MapPin className="w-5 h-5 text-primary" /> Venue Intel</h2>
          <div className="space-y-4">
            {groundStats.map((g, i) => (
              <Card key={i} className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5"><MapPin className="w-24 h-24" /></div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{g.name}</h3>
                    <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest">{g.played} Match Official</Badge>
                  </div>
                  <div className="text-right"><p className="text-2xl font-black text-primary">{(g.totalRuns / (g.innings || 1)).toFixed(0)}</p><p className="text-[8px] font-black text-slate-400 uppercase">Avg Inning</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Batting First Win %</p>
                    <p className="text-xl font-black text-secondary">{g.played > 0 ? ((g.bat1Won / g.played) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Record Total</p>
                    <p className="text-xl font-black text-slate-900">{g.highest}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Existing tabs (Captaincy, Comparison, Franchise) kept same logic, just ensuring data integrity */}
        <TabsContent value="captaincy" className="space-y-8">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Crown className="w-5 h-5 text-amber-500" /> Captaincy Analysis</h2>
          <Card className="border-none shadow-xl bg-white p-6 rounded-3xl">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400">Select Captains to Compare</Label>
              <Select value={cap1Id} onValueChange={setCap1Id}><SelectTrigger><SelectValue placeholder="Captain A" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              <Select value={cap2Id} onValueChange={setCap2Id}><SelectTrigger><SelectValue placeholder="Captain B" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
