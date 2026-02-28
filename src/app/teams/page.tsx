
"use client"

import { useState } from 'react';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ChevronRight, LayoutGrid, List, Trash2, Edit } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';

export default function TeamsPage() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const db = useFirestore();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams, isLoading } = useCollection(teamsQuery);

  const handleCreateTeam = () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "You must be logged in to create a team.", variant: "destructive" });
      return;
    }
    if (!newTeamName.trim()) return;

    const teamId = doc(collection(db, 'teams')).id;
    const teamData = {
      id: teamId,
      name: newTeamName,
      logoUrl: `https://picsum.photos/seed/${teamId}/200`,
      ownerId: user.uid,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
      totalRunsScored: 0,
      totalWicketsTaken: 0,
      netRunRate: 0,
    };

    setDocumentNonBlocking(doc(db, 'teams', teamId), teamData, { merge: true });
    setIsCreateOpen(false);
    setNewTeamName('');
    toast({ title: "Team Registered", description: `${newTeamName} has been created.` });
  };

  const handleDeleteTeam = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteDocumentNonBlocking(doc(db, 'teams', id));
      toast({ title: "Team Deleted", description: `${name} has been removed.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Team Management</h1>
          <p className="text-muted-foreground">Manage franchises, squads, and overall performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted p-1 rounded-lg flex">
            <Button variant={view === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setView('grid')} className="px-2">
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={view === 'list' ? "secondary" : "ghost"} size="sm" onClick={() => setView('list')} className="px-2">
              <List className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Register Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Franchise</DialogTitle>
                <DialogDescription>Enter the name of the team you want to create.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Mumbai Indians" 
                    value={newTeamName} 
                    onChange={(e) => setNewTeamName(e.target.value)} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Create Team</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse h-64 bg-muted" />
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {teams.map(team => (
            <Card key={team.id} className="hover:shadow-lg transition-all group border-t-4 border-t-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-12 h-12 border-2 border-muted shadow-sm group-hover:border-secondary transition-colors">
                    <AvatarImage src={team.logoUrl} />
                    <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{team.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Franchise</p>
                  </div>
                </div>
                {user?.uid === team.ownerId && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTeam(team.id, team.name)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center mb-6">
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Won</p>
                    <p className="text-lg font-black text-secondary">{team.matchesWon}</p>
                  </div>
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Lost</p>
                    <p className="text-lg font-black text-destructive">{team.matchesLost}</p>
                  </div>
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">NRR</p>
                    <p className="text-sm font-bold text-primary">{team.netRunRate.toFixed(3)}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-xs font-bold" asChild>
                    <Link href={`/teams/${team.id}`}>Manage Squad</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed rounded-2xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground mb-4">No franchises registered in the league.</p>
          <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register First Team
          </Button>
        </div>
      )}
    </div>
  );
}
