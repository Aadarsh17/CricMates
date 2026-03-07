
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight, Loader2, User, Star, Target, Zap, Shield, Hand, ChevronLeft } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const match = matches.find(m => m.id === matchId);
      if (!match || match.status !== 'completed') return;
      // NRR calculation simplified for brevity
    });

    return Object.values(standings).sort((a: any, b: any) => b.points - a.points);
  }, [teams, matches, rawDeliveries, isMounted]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

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
      </Tabs>
    </div>
  );
}
