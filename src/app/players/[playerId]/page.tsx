
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Activity, History as HistoryIcon, Target, Star, TrendingUp, User, ShieldCheck, ChevronRight, Flag, Users, Edit2, Save, UserCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';

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

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const matchesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches'), orderBy('matchDate', 'desc'), limit(100)), 
  [db]);
  const { data: allMatches } = useCollection(matchesQuery);

  const recentMatches = useMemo(() => {
    return allMatches?.filter(m => 
      m.team1SquadPlayerIds?.includes(playerId) || m.team2SquadPlayerIds?.includes(playerId)
    ) || [];
  }, [allMatches, playerId]);

  // Dynamic Formats based on unique totalOvers in player's history (e.g., 4OF, 6OF)
  const activeFormats = useMemo(() => {
    const overs = new Set<number>();
    recentMatches.forEach(m => {
      if (m.totalOvers) overs.add(m.totalOvers);
    });
    // Default to a sensible format if no matches yet
    if (overs.size === 0) return [20];
    return Array.from(overs).sort((a, b) => a - b);
  }, [recentMatches]);

  const representedTeams = useMemo(() => {
    const teamIds = new Set<string>();
    if (player?.teamId) teamIds.add(player.teamId);
    recentMatches.forEach(m => {
      if (m.team1SquadPlayerIds?.includes(playerId)) teamIds.add(m.team1Id);
      if (m.team2SquadPlayerIds?.includes(playerId)) teamIds.add(m.team2Id);
    });
    return allTeams?.filter(t => teamIds.has(t.id)) || [];
  }, [recentMatches, player?.teamId, allTeams, playerId]);

  const handleUpdateProfile = () => {
    if (!editForm.name.trim()) return;
    updateDocumentNonBlocking(doc(db, 'players', playerId), {
      name: editForm.name,
      role: editForm.role,
      battingStyle: editForm.battingStyle,
      isWicketKeeper: editForm.isWicketKeeper
    });
    setIsEditOpen(false);
    toast({ title: "Profile Updated", description: "Player information has been saved successfully." });
  };

  if (isPlayerLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING PROFILE...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  const formatHeader = (overs: number) => `${overs}OF`;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      {/* Professional Hero Section */}
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
               <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">League Registered</span>
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

      <Tabs defaultValue="info" className="w-full">
        <div className="bg-[#009270] px-2 border-t border-white/10 sticky top-16 z-40">
          <TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Info', 'Batting', 'Bowling', 'Career'].map((tab) => (
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

        <TabsContent value="info" className="p-4 space-y-6 animate-in fade-in duration-300">
          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Personal Details</h3>
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
               <Table>
                 <TableBody>
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 w-1/3 uppercase">Role</TableCell>
                      <TableCell className="text-[11px] font-bold text-slate-900">{player.role}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 uppercase">Batting Style</TableCell>
                      <TableCell className="text-[11px] font-bold text-slate-900">{player.battingStyle || 'Right Handed Bat'}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 uppercase">Matches</TableCell>
                      <TableCell className="text-[11px] font-bold text-slate-900">{player.matchesPlayed || 0}</TableCell>
                    </TableRow>
                 </TableBody>
               </Table>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Recent Match Log</h3>
            <div className="space-y-2">
              {recentMatches.slice(0, 5).map(match => (
                 <Link key={match.id} href={`/match/${match.id}`}>
                    <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all shadow-sm bg-white">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          <p className="font-bold text-sm text-slate-900">vs {match.team1Id === player.teamId ? (allTeams?.find(t => t.id === match.team2Id)?.name || 'Opponent') : (allTeams?.find(t => t.id === match.team1Id)?.name || 'Opponent')}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{match.totalOvers} Overs Format</p>
                       </div>
                       <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                 </Link>
              ))}
              {recentMatches.length === 0 && (
                 <div className="text-center py-10 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">No match records found</div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Active Franchises</h3>
            <div className="flex flex-wrap gap-2 px-1">
               {representedTeams.map(t => (
                 <Badge key={t.id} variant="outline" className="px-3 py-1.5 text-[10px] font-bold border-slate-200 bg-white shadow-sm uppercase tracking-wider">
                    {t.name}
                 </Badge>
               ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="batting" className="p-0 animate-in fade-in duration-300 overflow-x-auto">
           <div className="bg-[#f0f4f3] px-4 py-2 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-wider min-w-max">
              <span className="w-32">Batting Statistics</span>
              {activeFormats.map(f => (
                <span key={f} className="w-16 text-right">{formatHeader(f)}</span>
              ))}
           </div>
           <Table className="min-w-max">
              <TableBody>
                 {[
                   { label: 'Matches', field: 'matchesPlayed' },
                   { label: 'Innings', field: 'matchesPlayed' },
                   { label: 'Runs', field: 'runsScored' },
                   { label: 'Balls Played', field: 'ballsPlayed' },
                   { label: 'Highest', field: 'highestScore' },
                   { label: 'Average', field: 'average' },
                   { label: 'SR', field: 'strikeRate' },
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
                         <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-16">
                            {row.label === 'Matches' ? recentMatches.filter(m => m.totalOvers === f).length : (row.label === 'Runs' ? player.runsScored : '---')}
                         </TableCell>
                       ))}
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </TabsContent>

        <TabsContent value="bowling" className="p-0 animate-in fade-in duration-300 overflow-x-auto">
           <div className="bg-[#f0f4f3] px-4 py-2 text-[10px] font-black text-slate-500 flex justify-between uppercase tracking-wider min-w-max">
              <span className="w-32">Bowling Statistics</span>
              {activeFormats.map(f => (
                <span key={f} className="w-16 text-right">{formatHeader(f)}</span>
              ))}
           </div>
           <Table className="min-w-max">
              <TableBody>
                 {[
                   { label: 'Matches', field: 'matchesPlayed' },
                   { label: 'Innings', field: 'matchesPlayed' },
                   { label: 'Balls Bowled', field: 'ballsBowled' },
                   { label: 'Runs', field: 'runsConceded' },
                   { label: 'Maidens', field: 'maidens' },
                   { label: 'Wickets', field: 'wicketsTaken' },
                   { label: 'Avg', field: 'average' },
                   { label: 'Eco', field: 'economy' },
                   { label: 'SR', field: 'strikeRate' },
                   { label: 'BBI', field: 'bbi' },
                   { label: 'BBM', field: 'bbm' },
                   { label: '1w', field: '1w' },
                   { label: '2w', field: '2w' },
                   { label: '3w', field: '3w' },
                   { label: '4w', field: '4w' },
                   { label: '5w', field: '5w' },
                 ].map((row, idx) => (
                    <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                       <TableCell className="text-[11px] font-medium text-slate-600 py-3 pl-4 w-32">{row.label}</TableCell>
                       {activeFormats.map(f => (
                         <TableCell key={f} className="text-right text-[11px] font-black text-slate-900 pr-4 w-16">
                            {row.label === 'Matches' ? recentMatches.filter(m => m.totalOvers === f).length : (row.label === 'Wickets' ? player.wicketsTaken : '---')}
                         </TableCell>
                       ))}
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </TabsContent>

        <TabsContent value="career" className="p-4 animate-in fade-in duration-300">
           <Card className="bg-slate-900 text-white rounded-2xl overflow-hidden border-none shadow-xl transform hover:scale-[1.01] transition-transform">
              <CardContent className="p-10 text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy className="w-32 h-32" />
                 </div>
                 <Trophy className="w-14 h-14 text-[#fbbf24] mx-auto mb-4" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Cricket Value Points</p>
                 <h2 className="text-7xl font-black text-white">{player.careerCVP}</h2>
                 <div className="grid grid-cols-2 gap-8 mt-10 pt-10 border-t border-white/10">
                    <div className="text-left">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Ranking</p>
                       <p className="text-2xl font-black text-[#009270]">#12</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">League Standing</p>
                       <p className="text-2xl font-black text-[#009270]">Pro Elite</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Profile Editor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-[#009270]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2 text-[#009270]">
               <ShieldCheck className="w-5 h-5" /> Professional Profile Editor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Full Name</Label>
              <Input 
                value={editForm.name} 
                onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                placeholder="Name" 
                className="font-bold h-12 rounded-xl focus:ring-[#009270]"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Primary Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                <SelectTrigger className="font-bold h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Batsman">Batsman</SelectItem>
                  <SelectItem value="Bowler">Bowler</SelectItem>
                  <SelectItem value="All-rounder">All-rounder</SelectItem>
                  <SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Batting Style</Label>
              <Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}>
                <SelectTrigger className="font-bold h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Right Handed Bat">Right Handed Bat</SelectItem>
                  <SelectItem value="Left Handed Bat">Left Handed Bat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
               <input 
                  type="checkbox" 
                  id="wk-check" 
                  checked={editForm.isWicketKeeper} 
                  onChange={(e) => setEditForm({...editForm, isWicketKeeper: e.target.checked})}
                  className="w-5 h-5 rounded border-slate-300 text-[#009270] focus:ring-[#009270]"
               />
               <Label htmlFor="wk-check" className="text-xs font-bold text-slate-700 cursor-pointer">Official Wicket Keeper</Label>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button onClick={handleUpdateProfile} className="w-full h-14 font-black uppercase tracking-widest shadow-lg bg-[#009270] hover:bg-[#007a5d] rounded-xl text-lg">
               <Save className="w-5 h-5 mr-2" /> Commit Profile Updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
