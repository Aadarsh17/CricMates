
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag, Edit2, ShieldCheck, Star } from 'lucide-react';
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

  const playerRef = useMemoFirebase(() => doc(db, 'players', playerId), [db, playerId]);
  const { data: player, isLoading } = useDoc(playerRef);

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

  if (isLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING ANALYTICS...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  const sr = player.ballsFaced > 0 ? ((player.runsScored / player.ballsFaced) * 100).toFixed(2) : '0.00';
  const eco = player.ballsBowled > 0 ? (player.runsConceded / (player.ballsBowled / 6)).toFixed(2) : '0.00';

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
                     { label: 'Matches', value: player.matchesPlayed },
                     { label: 'Innings', value: player.battingInnings || 0 },
                     { label: 'Runs Scored', value: player.runsScored },
                     { label: 'Balls Played', value: player.ballsFaced || 0 },
                     { label: 'Highest Score', value: player.highestScore || 0 },
                     { label: 'Strike Rate', value: sr },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]')}>
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
                     { label: 'Matches', value: player.matchesPlayed },
                     { label: 'Innings', value: player.bowlingInnings || 0 },
                     { label: 'Wickets', value: player.wicketsTaken },
                     { label: 'Balls Bowled', value: player.ballsBowled || 0 },
                     { label: 'Runs Conceded', value: player.runsConceded || 0 },
                     { label: 'Economy', value: eco },
                     { label: 'Best Bowling', value: player.bestBowlingFigures || '---' },
                   ].map((row, idx) => (
                      <TableRow key={row.label} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]')}>
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
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateProfile} className="w-full h-12 font-black uppercase bg-[#009270] hover:bg-[#007a5d]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
