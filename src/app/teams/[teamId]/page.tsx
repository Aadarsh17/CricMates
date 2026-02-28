
"use client"

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import Link from 'next/link';

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
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman', battingStyle: 'Right-hand bat' });

  const handleAddPlayer = () => {
    if (!user) return;
    if (!newPlayer.name.trim()) return;

    const playerId = doc(collection(db, 'players')).id;
    const playerData = {
      id: playerId,
      name: newPlayer.name,
      teamId: teamId,
      ownerId: user.uid,
      role: newPlayer.role,
      battingStyle: newPlayer.battingStyle,
      isWicketKeeper: false,
      isRetired: false,
      matchesPlayed: 0,
      runsScored: 0,
      wicketsTaken: 0,
      highestScore: 0,
      bestBowlingFigures: '0/0',
      careerCVP: 0,
      imageUrl: `https://picsum.photos/seed/${playerId}/200`
    };

    setDocumentNonBlocking(doc(db, 'players', playerId), playerData, { merge: true });
    setIsAddPlayerOpen(false);
    setNewPlayer({ name: '', role: 'Batsman', battingStyle: 'Right-hand bat' });
    toast({ title: "Player Added", description: `${playerData.name} joined the squad.` });
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Remove ${name} from squad?`)) {
      deleteDocumentNonBlocking(doc(db, 'players', id));
      toast({ title: "Player Removed", description: `${name} has been released.` });
    }
  };

  if (isTeamLoading) return <div className="p-8 text-center">Loading team details...</div>;
  if (!team) return <div className="p-8 text-center">Team not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-16 h-16 border-2 border-primary">
          <AvatarImage src={team.logoUrl} />
          <AvatarFallback>{team.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold font-headline">{team.name}</h1>
          <p className="text-muted-foreground">Squad Management & Performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Played', value: team.matchesWon + team.matchesLost + team.matchesDrawn, icon: History },
          { label: 'Won', value: team.matchesWon, icon: Trophy, color: 'text-secondary' },
          { label: 'Lost', value: team.matchesLost, icon: Activity, color: 'text-destructive' },
          { label: 'NRR', value: team.netRunRate.toFixed(3), icon: Activity },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-muted rounded-lg">
                <stat.icon className={`w-5 h-5 ${stat.color || ''}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">{stat.label}</p>
                <p className="text-2xl font-black">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Active Squad</h2>
        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary hover:bg-secondary/90">
              <UserPlus className="mr-2 h-4 w-4" /> Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Player to Squad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="e.g. Virat Kohli" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button onClick={handleAddPlayer}>Add to Squad</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {players?.map(player => (
          <Card key={player.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={player.imageUrl} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{player.name}</p>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{player.role}</Badge>
                  </div>
                </div>
                {user?.uid === player.ownerId && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePlayer(player.id, player.name)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Runs</p>
                  <p className="font-bold">{player.runsScored}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Wkts</p>
                  <p className="font-bold">{player.wicketsTaken}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">CVP</p>
                  <p className="font-bold text-primary">{player.careerCVP}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!players || players.length === 0) && !isPlayersLoading && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
            <p className="text-muted-foreground">No players in this squad yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
