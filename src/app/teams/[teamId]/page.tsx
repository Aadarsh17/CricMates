
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, History as HistoryIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { cn } from '@/lib/utils';

export default function TeamDetailsPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const teamRef = useMemoFirebase(() => doc(db, 'teams', teamId), [db, teamId]);
  const { data: team, isLoading: isTeamLoading } = useDoc(teamRef);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), where('teamId', '==', teamId)), [db, teamId]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman' });

  const handleAddPlayer = () => {
    if (!user || !newPlayer.name.trim()) return;
    const playerId = doc(collection(db, 'players')).id;
    const playerData = {
      id: playerId, name: newPlayer.name, teamId, ownerId: user.uid,
      role: newPlayer.role, battingStyle: 'Right-hand bat', isWicketKeeper: false, isRetired: false,
      matchesPlayed: 0, runsScored: 0, wicketsTaken: 0, highestScore: 0,
      bestBowlingFigures: '0/0', careerCVP: 0,
      imageUrl: `https://picsum.photos/seed/${playerId}/200`
    };
    setDocumentNonBlocking(doc(db, 'players', playerId), playerData, { merge: true });
    setIsAddPlayerOpen(false);
    setNewPlayer({ name: '', role: 'Batsman' });
    toast({ title: "Player Added", description: `${newPlayer.name} joined the squad.` });
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Remove ${name}?`)) {
      deleteDocumentNonBlocking(doc(db, 'players', id));
      toast({ title: "Player Released" });
    }
  };

  if (isTeamLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!team) return <div className="p-8 text-center">Not found.</div>;

  return (
    <div className="space-y-6 pb-24 px-1 md:px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0"><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-12 h-12 border-2 border-primary"><AvatarImage src={team.logoUrl}/><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-black font-headline truncate">{team.name}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Squad Management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Won', value: team.matchesWon, icon: Trophy, color: 'text-secondary' },
          { label: 'Lost', value: team.matchesLost, icon: Activity, color: 'text-destructive' },
          { label: 'NRR', value: (team.netRunRate || 0).toFixed(3), icon: HistoryIcon },
          { label: 'Played', value: (team.matchesWon||0)+(team.matchesLost||0)+(team.matchesDrawn||0), icon: HistoryIcon },
        ].map((stat, i) => (
          <Card key={i} className="shadow-none border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-1.5 bg-slate-50 rounded">
                <stat.icon className={cn("w-4 h-4", stat.color)}/>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">{stat.label}</p>
                <p className="text-lg font-black">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center gap-4">
        <h2 className="text-lg md:text-2xl font-black">Active Squad</h2>
        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogTrigger asChild><Button className="bg-secondary hover:bg-secondary/90 font-bold"><UserPlus className="mr-2 h-4 w-4"/> Add Player</Button></DialogTrigger>
          <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Register Player</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1"><Label>Full Name</Label><Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="e.g. Jasprit Bumrah" /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem><SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button onClick={handleAddPlayer} className="w-full h-12">Confirm Registration</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players?.map(player => (
          <Card key={player.id} className="border-l-4 border-l-primary shadow-sm hover:border-primary transition-all">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <Link href={`/players/${player.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="w-10 h-10"><AvatarImage src={player.imageUrl} /><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate max-w-[120px]">{player.name}</p>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">{player.role}</Badge>
                  </div>
                </Link>
                {user?.uid === player.ownerId && <Button variant="ghost" size="icon" onClick={() => handleDeletePlayer(player.id, player.name)} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                <div><p className="text-[8px] font-black text-slate-400 uppercase">Runs</p><p className="font-black text-xs">{player.runsScored}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase">Wkts</p><p className="font-black text-xs">{player.wicketsTaken}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase">CVP</p><p className="font-black text-xs text-primary">{player.careerCVP}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
