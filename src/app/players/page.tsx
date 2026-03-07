
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, UserCircle, ChevronRight, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { useRouter } from 'next/navigation';

export default function PlayersPage() {
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);
  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);
  const deliveriesQuery = useMemoFirebase(() => { if (!isMounted) return null; return query(collectionGroup(db, 'deliveryRecords')); }, [db, isMounted]);
  const { data: allDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const playerStats = useMemo(() => {
    if (!players || !allDeliveries || !matches) return {};
    const activeMatchIds = new Set(matches.map(m => m.id));
    const pMatchStats: Record<string, Record<string, any>> = {};
    const careerTotals: Record<string, any> = {};

    players.forEach(p => { careerTotals[p.id] = { id: p.id, name: p.name, runs: 0, wickets: 0, cvp: 0 }; });

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;
      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId].filter(id => id && id !== 'none');
      pIds.forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId]) pMatchStats[pid][matchId] = { id: pid, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
      });
      const s = pMatchStats[d.strikerPlayerId]?.[matchId];
      if (s) { s.runs += d.runsScored || 0; if (d.extraType !== 'wide') s.ballsFaced++; if (careerTotals[d.strikerPlayerId]) careerTotals[d.strikerPlayerId].runs += d.runsScored || 0; }
      const bId = d.bowlerId || d.bowlerPlayerId;
      const b = pMatchStats[bId]?.[matchId];
      if (b) { b.runsConceded += d.totalRunsOnDelivery || 0; if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsBowled++; if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) { b.wickets++; if (careerTotals[bId]) careerTotals[bId].wickets++; } }
      const f = pMatchStats[d.fielderPlayerId]?.[matchId];
      if (f) { if (d.dismissalType === 'caught') f.catches++; if (d.dismissalType === 'stumped') f.stumpings++; if (d.dismissalType === 'runout') f.runOuts++; }
    });

    Object.keys(careerTotals).forEach(id => {
      let totalCvp = 0;
      Object.values(pMatchStats[id] || {}).forEach(ms => { totalCvp += calculatePlayerCVP(ms); });
      careerTotals[id].cvp = totalCvp;
    });
    return careerTotals;
  }, [players, allDeliveries, matches]);

  const filtered = players?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!isMounted || isPlayersLoading || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 pb-24 px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Player Registry</h1>
      </div>
      <div className="relative w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search player pool..." className="pl-10 h-12 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered?.map(p => {
          const s = playerStats[p.id] || { runs: 0, wickets: 0, cvp: 0 };
          return (
            <Link key={p.id} href={`/players/${p.id}`} className="group">
              <Card className="hover:shadow-md transition-all border-l-4 border-l-slate-200 group-hover:border-primary overflow-hidden h-full">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-12 h-12 border-2"><AvatarImage src={p.imageUrl} /><AvatarFallback>{p.name[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><p className="font-black text-sm uppercase truncate group-hover:text-primary">{p.name}</p><Badge variant="outline" className="text-[8px] uppercase">{p.role}</Badge></div>
                  <div className="text-right"><p className="text-xs font-black text-primary">{s.cvp.toFixed(1)}</p><p className="text-[8px] font-bold text-slate-400">CVP</p></div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
