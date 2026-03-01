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
import { ArrowLeft, Trophy, Flag, Edit2, ShieldCheck, Star, Activity, BarChart3, Clock, User } from 'lucide-react';
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

  const facedQuery = useMemoFirebase(() => 
    playerId ? query(collectionGroup(db, 'deliveryRecords'), where('strikerPlayerId', '==', playerId)) : null
  , [db, playerId]);
  const { data: ballsFaced, isLoading: isFacedLoading } = useCollection(facedQuery);

  const bowledQuery = useMemoFirebase(() => 
    playerId ? query(collectionGroup(db, 'deliveryRecords'), where('bowlerPlayerId', '==', playerId)) : null
  , [db, playerId]);
  const { data: ballsBowled, isLoading: isBowledLoading } = useCollection(bowledQuery);

  const statsByFormat = useMemo(() => {
    if (!allMatches || !ballsFaced || !ballsBowled) return {};

    const formats: Record<number, any> = {};

    ballsFaced.forEach(ball => {
      const pathParts = ball.__fullPath?.split('/') || [];
      const matchId = pathParts[1];
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;

      const format = match.totalOvers;
      if (!formats[format]) formats[format] = { batting: {}, bowling: {}, matchIds: new Set() };
      
      formats[format].matchIds.add(match.id);
      
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

    ballsBowled.forEach(ball => {
      const pathParts = ball.__fullPath?.split('/') || [];
      const matchId = pathParts[1];
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;

      const format = match.totalOvers;
      if (!formats[format]) formats[format] = { batting: {}, bowling: {}, matchIds: new Set() };
      
      formats[format].matchIds.add(match.id);

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
    Object.keys(formats).forEach(fKey => {
      const fNum = parseInt(fKey);
      const f = formats[fNum];
      
      const batList = Object.values(f.batting);
      const bowlList = Object.values(f.bowling);

      const totalRuns = batList.reduce((acc: number, curr: any) => acc + curr.runs, 0);
      const totalBallsPlayed = batList.reduce((acc: number, curr: any) => acc + curr.balls, 0);
      const outs = batList.filter((m: any) => m.out).length;
      
      const totalWickets = bowlList.reduce((acc: number, curr: any) => acc + curr.wickets, 0);
      const totalRunsConceded = bowlList.reduce((acc: number, curr: any) => acc + curr.runs, 0);
      const totalBallsBowled = bowlList.reduce((acc: number, curr: any) => acc + curr.balls, 0);

      finalStats[fNum] = {
        matches: f.matchIds.size,
        innings: batList.length,
        runs: totalRuns,
        ballsPlayed: totalBallsPlayed,
        highest: batList.length > 0 ? Math.max(...batList.map((m: any) => m.runs)) : 0,
        average: outs > 0 ? (totalRuns / outs).toFixed(2) : totalRuns.toFixed(2),
        sr: totalBallsPlayed > 0 ? ((totalRuns / totalBallsPlayed) * 100).toFixed(2) : '0.00',
        notOut: batList.length - outs,
        fours: batList.reduce((acc: number, curr: any) => acc + curr.fours, 0),
        sixes: batList.reduce((acc: number, curr: any) => acc + curr.sixes, 0),
        
        bowlInnings: bowlList.length,
        ballsBowled: totalBallsBowled,
        runsConceded: totalRunsConceded,
        wickets: totalWickets,
        eco: totalBallsBowled > 0 ? (totalRunsConceded / (totalBallsBowled / 6)).toFixed(2) : '0.00',
        bbi: bowlList.length > 0 ? `${bowlList.sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs)[0].wickets}/${bowlList.sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs)[0].runs}` : '---',
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

  const isLoading = isPlayerLoading || isFacedLoading || isBowledLoading;

  if (isLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING ANALYTICS...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      <div className="bg-[#009270] text-white p-4 pt-8 shadow-inner">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 shrink-0">
            <ArrowLeft className="w-6 h-6"/>
          </Button>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2">
                <span className="font-black text-2xl tracking-tighter uppercase truncate">{player.name}</span>
                {isUmpire && (
                  <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
             </div>
            <div className="flex items-center gap-2 mt-0.5 opacity-70">
               <Flag className="w-3 h-3" />
               <span className="text-[10px] font-black uppercase tracking-widest">{player.role}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-end gap-6 pb-2">
           <Avatar className="w-24 h-24 border-4 border-white/20 rounded-2xl shadow-xl shrink-0 overflow-hidden">
              <AvatarImage src={player.imageUrl || `https://picsum.photos/seed/${playerId}/300`} className="object-cover" />
              <AvatarFallback className="text-3xl font-black bg-white/10 text-white/50">{player.name[0]}</AvatarFallback>
           </Avatar>
           <div className="flex-1 grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm text-center">
                 <p className="text-[8px] font-black uppercase text-white/50">CVP Points</p>
                 <p className="text-xl font-black">{player.careerCVP || 0}</p>
              </div>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm text-center">
                 <p className="text-[8px] font-black uppercase text-white/50">Style</p>
                 <p className="text-xs font-bold leading-tight truncate">{player.battingStyle}</p>
              </div>
           </div>
        </div>
      </div>

      <Tabs defaultValue="batting" className="w-full">
        <div className="bg-[#009270] px-2 border-t border-white/10 sticky top-16 z-40 shadow-md">
          <TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Batting', 'Bowling', 'Info'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab.toLowerCase()} 
                className="text-white/60 font-black data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-6 h-full uppercase text-[11px] tracking-widest transition-all"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="batting" className="p-0 animate-in fade-in duration-300">
           {activeFormats.length > 0 ? (
             <div className="overflow-x-auto">
               <div className="bg-[#f0f4f3] px-4 py-3 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-widest min-w-max border-b">
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
                       { label: 'Average', field: 'average' },
                       { label: 'Strike Rate', field: 'sr' },
                       { label: 'Not Out', field: 'notOut' },
                       { label: 'Fours', field: 'fours' },
                       { label: 'Sixes', field: 'sixes' },
                     ].map((row, idx) => (
                        <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]')}>
                           <TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell>
                           {activeFormats.map(f => (
                             <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-20">
                                {statsByFormat[f]?.[row.field!] ?? '---'}
                             </TableCell>
                           ))}
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
             </div>
           ) : (
             <div className="py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">No records available</div>
           )}
        </TabsContent>

        <TabsContent value="bowling" className="p-0 animate-in fade-in duration-300">
           {activeFormats.length > 0 ? (
             <div className="overflow-x-auto">
               <div className="bg-[#f0f4f3] px-4 py-3 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-widest min-w-max border-b">
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
                       { label: 'Economy', field: 'eco' },
                       { label: 'BBI', field: 'bbi' },
                     ].map((row, idx) => (
                        <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]')}>
                           <TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell>
                           {activeFormats.map(f => (
                             <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-20">
                                {statsByFormat[f]?.[row.field!] ?? '---'}
                             </TableCell>
                           ))}
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
             </div>
           ) : (
             <div className="py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">No records available</div>
           )}
        </TabsContent>

        <TabsContent value="info" className="p-4 space-y-6">
           <Card className="rounded-2xl bg-slate-50 border-none shadow-sm">
              <CardContent className="p-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Batting Style</p>
                       <p className="text-sm font-bold">{player.battingStyle}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Wicket Keeper</p>
                       <p className="text-sm font-bold">{player.isWicketKeeper ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                       <Badge variant={player.isRetired ? "outline" : "default"} className="font-black text-[9px] h-5 uppercase">
                          {player.isRetired ? 'Retired' : 'Active'}
                       </Badge>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-[#009270]">Edit Player Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label>
               <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12" />
            </div>
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-slate-400">Primary Role</Label>
               <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                  <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Batsman">Batsman</SelectItem>
                     <SelectItem value="Bowler">Bowler</SelectItem>
                     <SelectItem value="All-rounder">All-rounder</SelectItem>
                     <SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateProfile} className="w-full h-12 font-black uppercase bg-[#009270] hover:bg-[#007a5d]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}