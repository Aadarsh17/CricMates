
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collectionGroup, query, where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag, Edit2, ShieldCheck, Star, Info as InfoIcon, Loader2, Trophy, Medal } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
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

  // Fetch basic player profile metadata
  const playerRef = useMemoFirebase(() => doc(db, 'players', playerId), [db, playerId]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  // FETCH ALL HISTORY-BASED DATA FROM COLLECTION GROUP
  const battingQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords'), where('strikerPlayerId', '==', playerId)), [db, playerId]);
  const { data: battingDeliveries, isLoading: isBattingLoading } = useCollection(battingQuery);

  const bowlingQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords'), where('bowlerPlayerId', '==', playerId)), [db, playerId]);
  const { data: bowlingDeliveries, isLoading: isBowlingLoading } = useCollection(bowlingQuery);

  const dismissalQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords'), where('batsmanOutPlayerId', '==', playerId)), [db, playerId]);
  const { data: dismissals, isLoading: isDismissalLoading } = useCollection(dismissalQuery);

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

  // CALCULATE LIVE STATS EXCLUSIVELY FROM HISTORY
  const historyStats = useMemo(() => {
    const stats = {
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      battingInnings: new Set<string>(),
      matchesPlayed: new Set<string>(),
      fifties: 0,
      hundreds: 0,
      
      wickets: 0,
      ballsBowled: 0,
      runsConceded: 0,
      bowlingInnings: new Set<string>(),
      maidens: 0,
      threeWktHauls: 0,
      
      catches: 0,
      stumpings: 0,
      runOuts: 0
    };

    if (battingDeliveries) {
      const matchRuns: Record<string, number> = {};
      battingDeliveries.forEach(d => {
        stats.runs += d.runsScored || 0;
        if (d.extraType !== 'wide') stats.ballsFaced += 1;
        if (d.runsScored === 4) stats.fours += 1;
        if (d.runsScored === 6) stats.sixes += 1;
        
        if (d.__fullPath) {
          const parts = d.__fullPath.split('/');
          const matchId = parts[1];
          const inningId = parts[3];
          const key = `${matchId}-${inningId}`;
          stats.battingInnings.add(key);
          stats.matchesPlayed.add(matchId);
          matchRuns[key] = (matchRuns[key] || 0) + (d.runsScored || 0);
        }
      });
      // Calculate milestones
      Object.values(matchRuns).forEach(runs => {
        if (runs >= 100) stats.hundreds += 1;
        else if (runs >= 50) stats.fifties += 1;
      });
    }

    if (bowlingDeliveries) {
      const matchWickets: Record<string, number> = {};
      bowlingDeliveries.forEach(d => {
        stats.runsConceded += d.totalRunsOnDelivery || 0;
        if (d.extraType !== 'wide' && d.extraType !== 'noball') stats.ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout') {
           stats.wickets += 1;
           if (d.__fullPath) {
              const parts = d.__fullPath.split('/');
              const key = `${parts[1]}-${parts[3]}`;
              matchWickets[key] = (matchWickets[key] || 0) + 1;
           }
        }
        
        if (d.__fullPath) {
          const parts = d.__fullPath.split('/');
          const matchId = parts[1];
          const inningId = parts[3];
          stats.bowlingInnings.add(`${matchId}-${inningId}`);
          stats.matchesPlayed.add(matchId);
        }
      });
      // Calculate bowling milestones
      Object.values(matchWickets).forEach(wkts => {
        if (wkts >= 3) stats.threeWktHauls += 1;
      });
    }

    if (dismissals) {
      dismissals.forEach(d => {
        if (d.fielderPlayerId === playerId) {
          if (d.dismissalType === 'caught') stats.catches += 1;
          if (d.dismissalType === 'stumped') stats.stumpings += 1;
          if (d.dismissalType === 'runout') stats.runOuts += 1;
        }
      });
    }

    return {
      ...stats,
      battingInningsCount: stats.battingInnings.size,
      bowlingInningsCount: stats.bowlingInnings.size,
      matchesPlayedCount: stats.matchesPlayed.size,
      strikeRate: stats.ballsFaced > 0 ? ((stats.runs / stats.ballsFaced) * 100).toFixed(2) : '0.00',
      economy: stats.ballsBowled > 0 ? (stats.runsConceded / (stats.ballsBowled / 6)).toFixed(2) : '0.00'
    };
  }, [battingDeliveries, bowlingDeliveries, dismissals, playerId]);

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

  const isLoading = isPlayerLoading || isBattingLoading || isBowlingLoading || isDismissalLoading;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing Match History...</p>
    </div>
  );

  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      <div className="bg-primary text-white p-4 pt-8 shadow-inner">
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
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center">
                 <p className="text-[8px] font-black uppercase text-white/50">Career CVP</p>
                 <p className="text-xl font-black">{player.careerCVP || 0}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center">
                 <p className="text-[8px] font-black uppercase text-white/50">Matches</p>
                 <p className="text-xl font-black">{historyStats.matchesPlayedCount}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="px-4 py-4 flex gap-4 overflow-x-auto scrollbar-hide">
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0">
            <Medal className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase">{historyStats.hundreds} Hundreds</span>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0">
            <Star className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black uppercase">{historyStats.fifties} Fifties</span>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0">
            <Trophy className="w-4 h-4 text-secondary" />
            <span className="text-xs font-black uppercase">{historyStats.threeWktHauls} 3+ Wkts</span>
         </div>
      </div>

      <Tabs defaultValue="batting" className="w-full">
        <div className="bg-primary px-2 border-t border-white/10 sticky top-16 z-40 shadow-md">
          <TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Batting', 'Bowling', 'Info'].map((tab) => (
              <TabsTrigger key={tab} value={tab.toLowerCase()} className="text-white/60 font-black data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-6 h-full uppercase text-[11px] tracking-widest transition-all">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="batting" className="p-0 animate-in fade-in duration-300">
           <div className="overflow-x-auto">
             <Table className="min-w-max">
                <TableBody>
                   {[
                     { label: 'Innings', value: historyStats.battingInningsCount },
                     { label: 'Runs Scored', value: historyStats.runs },
                     { label: 'Balls Played', value: historyStats.ballsFaced },
                     { label: 'Strike Rate', value: historyStats.strikeRate },
                     { label: '4s / 6s', value: `${historyStats.fours} / ${historyStats.sixes}` },
                     { label: '50s / 100s', value: `${historyStats.fifties} / ${historyStats.hundreds}` },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                         <TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell>
                         <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           </div>
        </TabsContent>

        <TabsContent value="bowling" className="p-0 animate-in fade-in duration-300">
           <div className="overflow-x-auto">
             <Table className="min-w-max">
                <TableBody>
                   {[
                     { label: 'Innings', value: historyStats.bowlingInningsCount },
                     { label: 'Wickets', value: historyStats.wickets },
                     { label: 'Balls Bowled', value: historyStats.ballsBowled },
                     { label: 'Runs Conceded', value: historyStats.runsConceded },
                     { label: 'Economy', value: historyStats.economy },
                     { label: '3+ Wkt Hauls', value: historyStats.threeWktHauls },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                         <TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell>
                         <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           </div>
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
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fielding: Catches</p>
                       <p className="text-sm font-bold">{historyStats.catches}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Stumpings/RO</p>
                       <p className="text-sm font-bold">{historyStats.stumpings} / {historyStats.runOuts}</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-primary">Edit Player Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label>
               <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12" />
            </div>
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-slate-400">Role</Label>
               <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                  <SelectTrigger className="font-bold h-12">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Batsman">Batsman</SelectItem>
                     <SelectItem value="Bowler">Bowler</SelectItem>
                     <SelectItem value="All-rounder">All-rounder</SelectItem>
                     <SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem>
                  </SelectContent>
               </Select>
            </div>
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-slate-400">Batting Style</Label>
               <Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}>
                  <SelectTrigger className="font-bold h-12">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Right Handed Bat">Right Handed Bat</SelectItem>
                     <SelectItem value="Left Handed Bat">Left Handed Bat</SelectItem>
                  </SelectContent>
               </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Wicket Keeper?</Label>
               <input type="checkbox" checked={editForm.isWicketKeeper} onChange={(e) => setEditForm({...editForm, isWicketKeeper: e.target.checked})} className="h-4 w-4" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateProfile} className="w-full h-12 font-black uppercase tracking-widest">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
