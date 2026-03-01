
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

  const teamRef = useMemoFirebase(() => player?.teamId ? doc(db, 'teams', player.teamId) : null, [db, player?.teamId]);
  const { data: team } = useDoc(teamRef);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const matchesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches'), orderBy('matchDate', 'desc'), limit(50)), 
  [db]);
  const { data: allMatches } = useCollection(matchesQuery);

  const recentMatches = useMemo(() => {
    return allMatches?.filter(m => 
      m.team1SquadPlayerIds?.includes(playerId) || m.team2SquadPlayerIds?.includes(playerId)
    ) || [];
  }, [allMatches, playerId]);

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
      battingStyle: editForm.editBattingStyle || editForm.battingStyle,
      isWicketKeeper: editForm.isWicketKeeper
    });
    setIsEditOpen(false);
    toast({ title: "Profile Updated", description: "Player information has been saved successfully." });
  };

  if (isPlayerLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING PROFILE...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      {/* Header Section */}
      <div className="bg-[#009270] text-white p-4 pt-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-6 h-6"/>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
               <Flag className="w-3 h-3 text-white/70" />
               <span className="text-xs font-medium text-white/70">Member Player</span>
            </div>
          </div>
          {isUmpire && (
            <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="text-white hover:bg-white/10 rounded-full">
              <Edit2 className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        <div className="flex items-end gap-4">
           <Avatar className="w-24 h-24 border-4 border-white rounded-lg shadow-lg">
              <AvatarImage src={player.imageUrl} />
              <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-400">{player.name[0]}</AvatarFallback>
           </Avatar>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <div className="bg-[#009270] px-2">
          <TabsList className="bg-transparent h-12 flex justify-start gap-4 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Info', 'Batting', 'Bowling', 'Career'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab.toLowerCase()} 
                className="text-white/80 font-bold data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-4 h-full uppercase text-xs"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="info" className="p-4 space-y-6">
          <section>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-3 px-1">Personal Information</h3>
            <div className="border rounded-lg overflow-hidden">
               <Table>
                 <TableBody>
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="text-xs font-medium text-slate-400 py-3">Born</TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">Jan 01, 1995 (29 years)</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="text-xs font-medium text-slate-400 py-3">Role</TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">{player.role}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableCell className="text-xs font-medium text-slate-400 py-3">Batting Style</TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">{player.battingStyle || 'Right Handed Bat'}</TableCell>
                    </TableRow>
                 </TableBody>
               </Table>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-3 px-1">Recent Form</h3>
            <div className="space-y-3">
              {recentMatches.slice(0, 5).map(match => (
                 <Link key={match.id} href={`/match/${match.id}`}>
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{new Date(match.matchDate).toLocaleDateString()}</p>
                          <p className="font-bold text-sm">vs {match.team1Id === player.teamId ? (allTeams?.find(t => t.id === match.team2Id)?.name || 'Opponent') : (allTeams?.find(t => t.id === match.team1Id)?.name || 'Opponent')}</p>
                       </div>
                       <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                 </Link>
              ))}
              {recentMatches.length === 0 && (
                 <div className="text-center py-8 border-2 border-dashed rounded-lg bg-slate-50 text-slate-400 text-xs font-medium uppercase">No matches recorded</div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-3 px-1">Teams</h3>
            <div className="flex flex-wrap gap-2 px-1">
               {representedTeams.map(t => (
                 <Badge key={t.id} variant="outline" className="px-3 py-1 text-xs font-bold border-slate-200">
                    {t.name}
                 </Badge>
               ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="batting" className="p-4">
           <div className="border rounded-lg overflow-hidden shadow-sm">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase">Stat</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Value</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow><TableCell className="text-xs font-bold">Matches</TableCell><TableCell className="text-right text-xs font-black">{player.matchesPlayed}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Innings</TableCell><TableCell className="text-right text-xs font-black">{player.matchesPlayed}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Runs</TableCell><TableCell className="text-right text-xs font-black text-primary">{player.runsScored}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Highest Score</TableCell><TableCell className="text-right text-xs font-black">{player.highestScore}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Average</TableCell><TableCell className="text-right text-xs font-black">{player.matchesPlayed > 0 ? (player.runsScored / player.matchesPlayed).toFixed(2) : '0.00'}</TableCell></TableRow>
                 </TableBody>
              </Table>
           </div>
        </TabsContent>

        <TabsContent value="bowling" className="p-4">
           <div className="border rounded-lg overflow-hidden shadow-sm">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase">Stat</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Value</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow><TableCell className="text-xs font-bold">Matches</TableCell><TableCell className="text-right text-xs font-black">{player.matchesPlayed}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Wickets</TableCell><TableCell className="text-right text-xs font-black text-primary">{player.wicketsTaken}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Best Bowling</TableCell><TableCell className="text-right text-xs font-black">{player.bestBowlingFigures}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-bold">Average</TableCell><TableCell className="text-right text-xs font-black">{player.wicketsTaken > 0 ? (15).toFixed(2) : '0.00'}</TableCell></TableRow>
                 </TableBody>
              </Table>
           </div>
        </TabsContent>

        <TabsContent value="career" className="p-4">
           <Card className="bg-slate-900 text-white rounded-xl overflow-hidden border-none">
              <CardContent className="p-8 text-center">
                 <Trophy className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Cricket Value Points</p>
                 <h2 className="text-6xl font-black text-primary">{player.careerCVP}</h2>
                 <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/10">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase">Season Rank</p>
                       <p className="text-xl font-black">#12</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase">Consistency</p>
                       <p className="text-xl font-black">88%</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog for Umpires */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-5 h-5 text-primary" /> Edit Player Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label>
              <Input 
                value={editForm.name} 
                onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                placeholder="Player Name" 
                className="font-bold h-11"
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Primary Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                <SelectTrigger className="font-bold h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Batsman">Batsman</SelectItem>
                  <SelectItem value="Bowler">Bowler</SelectItem>
                  <SelectItem value="All-rounder">All-rounder</SelectItem>
                  <SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batting Style</Label>
              <Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}>
                <SelectTrigger className="font-bold h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Right Handed Bat">Right Handed Bat</SelectItem>
                  <SelectItem value="Left Handed Bat">Left Handed Bat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
               <input 
                  type="checkbox" 
                  id="wk-check" 
                  checked={editForm.isWicketKeeper} 
                  onChange={(e) => setEditForm({...editForm, isWicketKeeper: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
               />
               <Label htmlFor="wk-check" className="text-xs font-bold text-slate-700">Is Wicket Keeper</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateProfile} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">
               <Save className="w-4 h-4 mr-2" /> Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
