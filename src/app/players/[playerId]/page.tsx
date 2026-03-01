"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Flag, Edit2, ShieldCheck, Star } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    battingStyle: '',
    isWicketKeeper: false
  });

  const playerRef = useMemoFirebase(() => doc(db, 'players', playerId), [db, playerId]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  useEffect(() => {
    if (player) {
      setEditForm({
        name: player.name || '',
        role: player.role || 'Batsman',
        battingStyle: player.battingStyle || 'Right Handed Bat',
        isWicketKeeper: player.isWicketKeeper || false
      });
    }
  }, [player]);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  // Group Queries for accurate stats aggregation
  const facedQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords'), where('strikerPlayerId', '==', playerId)), [db, playerId]);
  const { data: ballsFaced } = useCollection(facedQuery);

  const bowledQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords'), where('bowlerPlayerId', '==', playerId)), [db, playerId]);
  const { data: ballsBowled } = useCollection(bowledQuery);

  const statsByFormat = useMemo(() => {
    if (!allMatches || !ballsFaced || !ballsBowled) return {};

    const formats: Record<number, any> = {};

    // Batting Aggregation
    ballsFaced.forEach(ball => {
      const matchId = ball.__fullPath?.split('/')[1];
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;

      const format = match.totalOvers;
      if (!formats[format]) formats[format] = { batting: {}, bowling: {}, matches: new Set() };
      
      formats[format].matches.add(match.id);
      
      if (!formats[format].batting[match.id]) {
        formats[format].batting[match.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      }

      if (ball.extraType !== 'wide') {
        formats[format].batting[match.id].balls += 1;
        formats[format].batting[match.id].runs += (ball.runsScored || 0);
        if (ball.runsScored === 4) formats[format].batting[match.id].fours += 1;
        if (ball.runsScored === 6) formats[format].batting[match.id].sixes += 1;
      }

      if (ball.isWicket && ball.batsmanOutPlayerId === playerId) {
        formats[format].batting[match.id].out = true;
      }
    });

    // Bowling Aggregation
    ballsBowled.forEach(ball => {
      const matchId = ball.__fullPath?.split('/')[1];
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;

      const format = match.totalOvers;
      if (!formats[format]) formats[format] = { batting: {}, bowling: {}, matches: new Set() };
      
      formats[format].matches.add(match.id);

      if (!formats[format].bowling[match.id]) {
        formats[format].bowling[match.id] = { runs: 0, balls: 0, wickets: 0, maidens: 0 };
      }

      formats[format].bowling[match.id].runs += (ball.totalRunsOnDelivery || 0);
      if (ball.isWicket && ball.dismissalType !== 'runout') {
        formats[format].bowling[match.id].wickets += 1;
      }
      if (ball.extraType !== 'wide' && ball.extraType !== 'noball') {
        formats[format].bowling[match.id].balls += 1;
      }
    });

    const finalStats: Record<number, any> = {};
    Object.keys(formats).forEach(formatKey => {
      const fNum = parseInt(formatKey);
      const f = formats[fNum];
      
      const batMatches = Object.values(f.batting);
      const bowlMatches = Object.values(f.bowling);

      const totalRuns = batMatches.reduce((acc: number, curr: any) => acc + curr.runs, 0);
      const totalBalls = batMatches.reduce((acc: number, curr: any) => acc + curr.balls, 0);
      const outs = batMatches.filter((m: any) => m.out).length;
      
      const totalWickets = bowlMatches.reduce((acc: number, curr: any) => acc + curr.wickets, 0);
      const totalRunsConceded = bowlMatches.reduce((acc: number, curr: any) => acc + curr.runs, 0);
      const totalBallsBowled = bowlMatches.reduce((acc: number, curr: any) => acc + curr.balls, 0);

      finalStats[fNum] = {
        matches: f.matches.size,
        innings: batMatches.length,
        runs: totalRuns,
        ballsPlayed: totalBalls,
        highest: batMatches.length > 0 ? Math.max(...batMatches.map((m: any) => m.runs)) : 0,
        average: outs > 0 ? (totalRuns / outs).toFixed(2) : totalRuns.toFixed(2),
        sr: totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(2) : '0.00',
        notOut: batMatches.length - outs,
        fours: batMatches.reduce((acc: number, curr: any) => acc + curr.fours, 0),
        sixes: batMatches.reduce((acc: number, curr: any) => acc + curr.sixes, 0),
        ducks: batMatches.filter((m: any) => m.runs === 0 && m.out).length,
        '30s': batMatches.filter((m: any) => m.runs >= 30 && m.runs < 50).length,
        '50s': batMatches.filter((m: any) => m.runs >= 50 && m.runs < 100).length,
        '100s': batMatches.filter((m: any) => m.runs >= 100).length,
        
        bowlInnings: bowlMatches.length,
        ballsBowled: totalBallsBowled,
        runsConceded: totalRunsConceded,
        wickets: totalWickets,
        maidens: bowlMatches.reduce((acc: number, curr: any) => acc + curr.maidens, 0),
        bowlAvg: totalWickets > 0 ? (totalRunsConceded / totalWickets).toFixed(2) : '0.00',
        eco: totalBallsBowled > 0 ? (totalRunsConceded / (totalBallsBowled / 6)).toFixed(2) : '0.00',
        bowlSr: totalWickets > 0 ? (totalBallsBowled / totalWickets).toFixed(2) : '0.00',
        bbi: bowlMatches.length > 0 ? `${bowlMatches.sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs)[0].wickets}/${bowlMatches.sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs)[0].runs}` : '---',
        '1w': bowlMatches.filter((m: any) => m.wickets === 1).length,
        '2w': bowlMatches.filter((m: any) => m.wickets === 2).length,
        '3w': bowlMatches.filter((m: any) => m.wickets === 3).length,
        '4w': bowlMatches.filter((m: any) => m.wickets === 4).length,
        '5w': bowlMatches.filter((m: any) => m.wickets >= 5).length,
      };
    });

    return finalStats;
  }, [allMatches, ballsFaced, ballsBowled, playerId]);

  const activeFormats = useMemo(() => Object.keys(statsByFormat).map(Number).sort((a, b) => a - b), [statsByFormat]);

  const handleUpdateProfile = () => {
    if (!editForm.name.trim()) return;
    updateDocumentNonBlocking(doc(db, 'players', playerId), {
      name: editForm.name,
      role: editForm.role,
      battingStyle: editForm.battingStyle,
      isWicketKeeper: editForm.isWicketKeeper
    });
    setIsEditOpen(false);
    toast({ title: "Profile Updated" });
  };

  if (isPlayerLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      <div className="bg-[#009270] text-white p-4 pt-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 shrink-0">
            <ArrowLeft className="w-6 h-6"/>
          </Button>
          <div className="flex-1">
             <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight uppercase">{player.name}</span>
                {isUmpire && (
                  <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="text-white hover:bg-white/10 rounded-full h-8 w-8">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
             </div>
            <div className="flex items-center gap-2 mt-0.5">
               <Flag className="w-3 h-3 text-white/70" />
               <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Official Player Profile</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-end gap-6 pb-2">
           <Avatar className="w-24 h-24 border-4 border-white/20 rounded-xl shadow-lg shrink-0 overflow-hidden">
              <AvatarImage src={player.imageUrl || `https://picsum.photos/seed/${playerId}/300`} className="object-cover" />
              <AvatarFallback className="text-3xl font-black bg-white/10 text-white/50">{player.name[0]}</AvatarFallback>
           </Avatar>
        </div>
      </div>

      <Tabs defaultValue="batting" className="w-full">
        <div className="bg-[#009270] px-2 border-t border-white/10 sticky top-16 z-40">
          <TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Batting', 'Bowling', 'Info', 'Career'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab.toLowerCase()} 
                className="text-white/60 font-black data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-4 h-full uppercase text-[11px] tracking-widest transition-all"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="batting" className="p-0">
           <div className="overflow-x-auto">
             <div className="bg-[#f0f4f3] px-4 py-2 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-wider min-w-max">
                <span className="w-32">Batting Analysis</span>
                {activeFormats.map(f => (
                  <span key={f} className="w-20 text-right">{f}OV</span>
                ))}
             </div>
             <Table className="min-w-max">
                <TableBody>
                   {[
                     { label: 'Matches', field: 'matches' },
                     { label: 'Innings', field: 'innings' },
                     { label: 'Runs', field: 'runs' },
                     { label: 'Balls Played', field: 'ballsPlayed' },
                     { label: 'Highest', field: 'highest' },
                     { label: 'Average', field: 'average' },
                     { label: 'SR', field: 'sr' },
                     { label: 'Not Out', field: 'notOut' },
                     { label: 'Fours', field: 'fours' },
                     { label: 'Sixes', field: 'sixes' },
                     { label: 'Ducks', field: 'ducks' },
                     { label: '30s', field: '30s' },
                     { label: '50s', field: '50s' },
                     { label: '100s', field: '100s' },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                         <TableCell className="text-[11px] font-medium text-slate-600 py-3 pl-4 w-32">{row.label}</TableCell>
                         {activeFormats.map(f => (
                           <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-20">
                              {statsByFormat[f]?.[row.field] ?? '---'}
                           </TableCell>
                         ))}
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           </div>
        </TabsContent>

        <TabsContent value="bowling" className="p-0">
           <div className="overflow-x-auto">
             <div className="bg-[#f0f4f3] px-4 py-2 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-wider min-w-max">
                <span className="w-32">Bowling Analysis</span>
                {activeFormats.map(f => (
                  <span key={f} className="w-20 text-right">{f}OV</span>
                ))}
             </div>
             <Table className="min-w-max">
                <TableBody>
                   {[
                     { label: 'Matches', field: 'matches' },
                     { label: 'Innings', field: 'bowlInnings' },
                     { label: 'Balls Bowled', field: 'ballsBowled' },
                     { label: 'Runs', field: 'runsConceded' },
                     { label: 'Wickets', field: 'wickets' },
                     { label: 'Maidens', field: 'maidens' },
                     { label: 'Avg', field: 'bowlAvg' },
                     { label: 'Eco', field: 'eco' },
                     { label: 'SR', field: 'bowlSr' },
                     { label: 'BBI', field: 'bbi' },
                     { label: '1w', field: '1w' },
                     { label: '2w', field: '2w' },
                     { label: '3w', field: '3w' },
                     { label: '4w', field: '4w' },
                     { label: '5w', field: '5w' },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                         <TableCell className="text-[11px] font-medium text-slate-600 py-3 pl-4 w-32">{row.label}</TableCell>
                         {activeFormats.map(f => (
                           <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-20">
                              {statsByFormat[f]?.[row.field] ?? '---'}
                           </TableCell>
                         ))}
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           </div>
        </TabsContent>

        <TabsContent value="info" className="p-4 space-y-6">
           <section>
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Profile Overview</h3>
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                 <Table>
                    <TableBody>
                       <TableRow className="border-slate-100">
                          <TableCell className="text-[11px] font-black text-slate-400 py-4 uppercase">Role</TableCell>
                          <TableCell className="text-[11px] font-bold text-slate-900">{player.role}</TableCell>
                       </TableRow>
                       <TableRow className="border-slate-100">
                          <TableCell className="text-[11px] font-black text-slate-400 py-4 uppercase">Batting</TableCell>
                          <TableCell className="text-[11px] font-bold text-slate-900">{player.battingStyle}</TableCell>
                       </TableRow>
                       <TableRow className="border-b-0">
                          <TableCell className="text-[11px] font-black text-slate-400 py-4 uppercase">Status</TableCell>
                          <TableCell className="text-[11px] font-bold text-slate-900">{player.isRetired ? 'Retired' : 'Active'}</TableCell>
                       </TableRow>
                    </TableBody>
                 </Table>
              </div>
           </section>
        </TabsContent>

        <TabsContent value="career" className="p-4">
           <div className="bg-slate-900 text-white p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Trophy className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                 <Trophy className="w-12 h-12 text-[#fbbf24] mx-auto mb-4" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Cricket Value Points</p>
                 <h2 className="text-7xl font-black text-white">{player.careerCVP || 0}</h2>
                 <p className="text-[9px] text-slate-500 font-bold uppercase mt-4 tracking-tighter">Ranked in top 5% of league players</p>
              </div>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-[#009270]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2 text-[#009270]">
               <ShieldCheck className="w-5 h-5" /> Professional Editor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12 rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Primary Role</Label><Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}><SelectTrigger className="font-bold h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem><SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Batting Style</Label><Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}><SelectTrigger className="font-bold h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Right Handed Bat">Right Handed Bat</SelectItem><SelectItem value="Left Handed Bat">Left Handed Bat</SelectItem></SelectContent></Select></div>
            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
               <input type="checkbox" id="wk-check" checked={editForm.isWicketKeeper} onChange={(e) => setEditForm({...editForm, isWicketKeeper: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-[#009270]" />
               <Label htmlFor="wk-check" className="text-xs font-bold text-slate-700 cursor-pointer">Official Wicket Keeper</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateProfile} className="w-full h-14 font-black uppercase tracking-widest shadow-lg bg-[#009270] hover:bg-[#007a5d] rounded-xl text-lg">Update Profile</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}