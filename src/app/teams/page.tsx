
"use client"

import { useState, useMemo } from 'react';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, List, Plus, Trash2, History, ChevronDown, ChevronUp, Loader2, ChevronLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';

function TeamMatchHistory({ teamId, matches, teams }: { teamId: string, matches: any[], teams: any[] }) {
  const teamMatches = matches?.filter(m => m.team1Id === teamId || m.team2Id === teamId).slice(0, 5) || [];
  if (teamMatches.length === 0) return (<div className="mt-4 p-3 bg-slate-50/50 rounded-lg border border-dashed text-center"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No match history yet</p></div>);
  return (
    <div className="space-y-2 pt-2">
      {teamMatches.map(match => {
        const opponentId = match.team1Id === teamId ? match.team2Id : match.team1Id;
        const opponent = teams?.find(t => t.id === opponentId);
        return (
          <div key={match.id} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm hover:border-primary/30 transition-colors">
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-900 truncate max-w-[100px] inline-block">vs {opponent?.name || 'Unknown'}</span>{match.status === 'live' && <Badge variant="destructive" className="h-3 text-[6px] px-1 animate-pulse">LIVE</Badge>}</div><p className="text-[9px] text-slate-500 font-medium line-clamp-1">{match.resultDescription}</p></div>
            <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase text-primary hover:bg-primary/10 px-2 shrink-0" asChild><Link href={`/match/${match.id}`}>Scorecard</Link></Button>
          </div>
        );
      })}
    </div>
  );
}

export default function TeamsPage() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [openHistories, setOpenHistories] = useState<Record<string, boolean>>({});

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams, isLoading: isTeamsLoading } = useCollection(teamsQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: allMatches = [], isLoading: isMatchesLoading } = useCollection(allMatchesQuery);

  const allDeliveriesQuery = useMemoFirebase(() => query(collectionGroup(db, 'deliveryRecords')), [db]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(allDeliveriesQuery);

  const teamStats = useMemo(() => {
    const stats: Record<string, any> = {};
    if (!teams) return stats;
    const validMatchIds = new Set(allMatches.map(m => m.id));
    const totals: Record<string, { forR: number, forB: number, agR: number, agB: number, wins: number, losses: number }> = {};
    
    teams.forEach(t => { 
      stats[t.id] = { wins: 0, losses: 0, nrr: 0 }; 
      totals[t.id] = { forR: 0, forB: 0, agR: 0, agB: 0, wins: 0, losses: 0 };
    });

    if (rawDeliveries) {
      rawDeliveries.forEach(d => {
        const matchId = d.__fullPath?.split('/')[1];
        if (!matchId || !validMatchIds.has(matchId)) return;
        const match = allMatches.find(m => m.id === matchId); if (!match) return;
        const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
        
        const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
        const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
        const bowlingTeamId = battingTeamId === match.team1Id ? match.team2Id : match.team1Id;

        if (totals[battingTeamId]) {
          totals[battingTeamId].forR += (d.totalRunsOnDelivery || 0);
          if (d.extraType !== 'wide' && d.extraType !== 'noball') totals[battingTeamId].forB += 1;
        }
        if (totals[bowlingTeamId]) {
          totals[bowlingTeamId].agR += (d.totalRunsOnDelivery || 0);
          if (d.extraType !== 'wide' && d.extraType !== 'noball') totals[bowlingTeamId].agB += 1;
        }
      });
    }

    allMatches.filter(m => m.status === 'completed').forEach(m => {
      const res = m.resultDescription?.toLowerCase() || '';
      const t1 = teams.find(t => t.id === m.team1Id); const t2 = teams.find(t => t.id === m.team2Id);
      if (t1 && t2) {
        if (res.includes(t1.name.toLowerCase()) && res.includes('won')) { totals[t1.id].wins++; totals[t2.id].losses++; }
        else if (res.includes(t2.name.toLowerCase()) && res.includes('won')) { totals[t2.id].wins++; totals[t1.id].losses++; }
      }
    });

    teams.forEach(t => {
      const forRR = totals[t.id].forB > 0 ? (totals[t.id].forR / (totals[t.id].forB / 6)) : 0;
      const agRR = totals[t.id].agB > 0 ? (totals[t.id].agR / (totals[t.id].agB / 6)) : 0;
      stats[t.id] = { wins: totals[t.id].wins, losses: totals[t.id].losses, nrr: forRR - agRR };
    });
    return stats;
  }, [teams, allMatches, rawDeliveries]);

  const isLoading = isTeamsLoading || isMatchesLoading || isDeliveriesLoading;
  const defaultTeamLogo = PlaceHolderImages.find(img => img.id === 'team-logo')?.imageUrl || '';

  return (
    <div className="space-y-6 pb-24 px-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Franchise Hall</h1>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-2xl md:text-3xl font-black font-headline tracking-tight text-slate-900">Franchises</h1><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Calculated based on current league matches</p></div>
        <div className="flex items-center gap-2 w-full md:w-auto"><div className="bg-slate-100 p-1 rounded flex border shrink-0"><Button variant={view === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setView('grid')} className="h-8 w-8 p-0"><LayoutGrid className="w-4 h-4"/></Button><Button variant={view === 'list' ? "secondary" : "ghost"} size="sm" onClick={() => setView('list')} className="h-8 w-8 p-0"><List className="w-4 h-4"/></Button></div>
          {isUmpire && (<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}><DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 font-bold h-10 px-4 flex-1 md:flex-none"><Plus className="mr-2 h-4 w-4"/> Register</Button></DialogTrigger><DialogContent className="max-w-[90vw] sm:max-w-md"><DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader><div className="space-y-4 py-4"><Label>Team Name</Label><Input placeholder="e.g. Royal Challengers" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} /></div><DialogFooter><Button onClick={() => { if (!isUmpire || !user || !newTeamName.trim()) return; const teamId = doc(collection(db, 'teams')).id; setDocumentNonBlocking(doc(db, 'teams', teamId), { id: teamId, name: newTeamName, logoUrl: defaultTeamLogo, ownerId: user.uid, matchesWon: 0, matchesLost: 0, matchesDrawn: 0, totalRunsScored: 0, totalRunsConceded: 0, totalBallsFaced: 0, totalBallsBowled: 0, totalWicketsTaken: 0, netRunRate: 0 }, { merge: true }); setIsCreateOpen(false); setNewTeamName(''); toast({ title: "Team Registered" }); }} disabled={!newTeamName.trim()} className="w-full h-12">Register Franchise</Button></DialogFooter></DialogContent></Dialog>)}
        </div>
      </div>
      {isLoading ? (<div className="py-20 flex flex-col items-center justify-center space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Franchise Data...</p></div>) : (
        <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>{teams?.map(team => {
            const stats = teamStats[team.id] || { wins: 0, losses: 0, nrr: 0 };
            const isHistoryOpen = openHistories[team.id] ?? false;
            return (
              <Card key={team.id} className="hover:shadow-md transition-all group flex flex-col border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0"><div className="flex items-center space-x-3"><Avatar className="w-10 h-10 border rounded-lg bg-white shadow-sm"><AvatarImage src={team.logoUrl} /><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar><div className="min-w-0"><CardTitle className="text-base font-black tracking-tight truncate max-w-[120px] uppercase">{team.name}</CardTitle><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Franchise</p></div></div>{isUmpire && (<Button variant="ghost" size="icon" onClick={() => { if(confirm(`Delete ${team.name}?`)) { deleteDocumentNonBlocking(doc(db, 'teams', team.id)); toast({ title: "Team Deleted" }); } }} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>)}</CardHeader>
                <CardContent className="flex-1 flex flex-col p-4 pt-2">
                  <div className="grid grid-cols-3 gap-2 mb-4"><div className="bg-slate-50 p-2 rounded-lg text-center border"><p className="text-[8px] font-black uppercase text-slate-400">Wins</p><p className="text-sm font-black text-secondary">{stats.wins}</p></div><div className="bg-slate-50 p-2 rounded-lg text-center border"><p className="text-[8px] font-black uppercase text-slate-400">Losses</p><p className="text-sm font-black text-destructive">{stats.losses}</p></div><div className="bg-slate-50 p-2 rounded-lg text-center border"><p className="text-[8px] font-black uppercase text-slate-400">NRR</p><p className={cn("text-sm font-black", stats.nrr >= 0 ? "text-primary" : "text-amber-600")}>{(stats.nrr || 0).toFixed(3)}</p></div></div>
                  <Collapsible open={isHistoryOpen} onOpenChange={(open) => setOpenHistories(prev => ({...prev, [team.id]: open}))} className="border rounded-lg bg-slate-50/30 overflow-hidden"><CollapsibleTrigger asChild><Button variant="ghost" className="w-full flex items-center justify-between px-3 py-2 h-auto hover:bg-slate-100"><div className="flex items-center gap-2"><History className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-500 uppercase">Recent Form</span></div>{isHistoryOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}</Button></CollapsibleTrigger><CollapsibleContent className="px-2 pb-2"><TeamMatchHistory teamId={team.id} matches={allMatches} teams={teams || []} /></CollapsibleContent></Collapsible>
                  <div className="mt-4 pt-4 border-t"><Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest h-10 shadow-sm" asChild><Link href={`/teams/${team.id}`}>View Squad & Full Stats</Link></Button></div>
                </CardContent>
              </Card>
            );
          })}</div>
      )}
    </div>
  );
}
