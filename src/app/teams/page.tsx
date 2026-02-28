
"use client"

import { useState } from 'react';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, LayoutGrid, List, Trash2, History, ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import Link from 'next/link';

function TeamMatchHistory({ teamId, matches, teams }: { teamId: string, matches: any[], teams: any[] }) {
  const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId).slice(0, 5);
  
  if (teamMatches.length === 0) return (
    <div className="mt-4 p-3 bg-slate-50/50 rounded-lg border border-dashed text-center">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No match history yet</p>
    </div>
  );

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <History className="w-3 h-3 text-slate-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Matches</p>
      </div>
      <div className="space-y-2">
        {teamMatches.map(match => {
          const isTeam1 = match.team1Id === teamId;
          const opponentId = isTeam1 ? match.team2Id : match.team1Id;
          const opponent = teams.find(t => t.id === opponentId);
          return (
            <div key={match.id} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm hover:border-primary/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-900 truncate max-w-[100px] inline-block">vs {opponent?.name || 'Unknown'}</span>
                  {match.status === 'live' && <Badge variant="destructive" className="h-3 text-[6px] px-1 animate-pulse">LIVE</Badge>}
                </div>
                <p className="text-[9px] text-slate-500 font-medium line-clamp-1">{match.resultDescription}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase text-primary hover:bg-primary/10 px-2 shrink-0" asChild>
                <Link href={`/match/${match.id}`}>Scorecard</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const db = useFirestore();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams, isLoading } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: allMatches = [] } = useCollection(matchesQuery);

  const handleCreateTeam = () => {
    if (!isUmpire || !user || !newTeamName.trim()) return;
    const teamId = doc(collection(db, 'teams')).id;
    const teamData = {
      id: teamId,
      name: newTeamName,
      logoUrl: `https://picsum.photos/seed/${teamId}/200`,
      ownerId: user.uid,
      matchesWon: 0, matchesLost: 0, matchesDrawn: 0,
      totalRunsScored: 0, totalRunsConceded: 0,
      totalOversFaced: 0, totalOversBowled: 0,
      totalWicketsTaken: 0, netRunRate: 0,
    };
    setDocumentNonBlocking(doc(db, 'teams', teamId), teamData, { merge: true });
    setIsCreateOpen(false);
    setNewTeamName('');
    toast({ title: "Team Registered", description: `${newTeamName} created.` });
  };

  const handleDeleteTeam = (id: string, name: string) => {
    if (confirm(`Delete ${name}?`)) {
      deleteDocumentNonBlocking(doc(db, 'teams', id));
      toast({ title: "Team Deleted" });
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1 md:px-0 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-headline tracking-tight text-slate-900">Franchises</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">League Management Hub</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="bg-slate-100 p-1 rounded flex border shrink-0">
            <Button variant={view === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setView('grid')} className="h-8 w-8 p-0"><LayoutGrid className="w-4 h-4"/></Button>
            <Button variant={view === 'list' ? "secondary" : "ghost"} size="sm" onClick={() => setView('list')} className="h-8 w-8 p-0"><List className="w-4 h-4"/></Button>
          </div>
          {isUmpire && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 font-bold h-10 px-4 flex-1 md:flex-none"><Plus className="mr-2 h-4 w-4"/> Register</Button></DialogTrigger>
              <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4"><Label>Team Name</Label><Input placeholder="e.g. Royal Challengers" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} /></div>
                <DialogFooter><Button onClick={handleCreateTeam} disabled={!newTeamName.trim()} className="w-full h-12">Register Franchise</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Card key={i} className="animate-pulse h-64 bg-slate-50" />)}
        </div>
      ) : (
        <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {teams?.map(team => (
            <Card key={team.id} className="hover:shadow-md transition-all group flex flex-col border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10 border rounded-lg bg-white"><AvatarImage src={team.logoUrl} /><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-black tracking-tight truncate max-w-[120px]">{team.name}</CardTitle>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Franchise</p>
                  </div>
                </div>
                {isUmpire && user?.uid === team.ownerId && <Button variant="ghost" size="icon" onClick={() => handleDeleteTeam(team.id, team.name)} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-4 pt-2">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-slate-50 p-2 rounded text-center"><p className="text-[8px] font-black uppercase text-slate-400">Wins</p><p className="text-sm font-black text-secondary">{team.matchesWon||0}</p></div>
                  <div className="bg-slate-50 p-2 rounded text-center"><p className="text-[8px] font-black uppercase text-slate-400">Losses</p><p className="text-sm font-black text-destructive">{team.matchesLost||0}</p></div>
                  <div className="bg-slate-50 p-2 rounded text-center"><p className="text-[8px] font-black uppercase text-slate-400">NRR</p><p className="text-xs font-black text-primary">{(team.netRunRate||0).toFixed(3)}</p></div>
                </div>
                <TeamMatchHistory teamId={team.id} matches={allMatches} teams={teams || []} />
                {isUmpire && (
                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest h-10" asChild><Link href={`/teams/${team.id}`}>Manage Squad & Stats</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
