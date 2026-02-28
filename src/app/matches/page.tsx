
'use client';

import { useCollection, useMemoFirebase, useFirestore, useDoc, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, PlayCircle, History as HistoryIcon, RefreshCcw, Trash2, Edit2, Check, X, AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

function MatchScoreCard({ match, teams, isUmpire }: { match: any, teams: any[], isUmpire: boolean }) {
  const db = useFirestore();
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editedResult, setEditedResult] = useState(match.resultDescription);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_1'), [db, match.id]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_2'), [db, match.id]);
  const { data: inn2 } = useDoc(inn2Ref);

  // Mocking "Player of the Match" for the UI prototype
  // In a real app, this would come from the match data or a CVP calculation
  const [potm, setPotm] = useState<any>(null);
  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), limit(1)), [db]);
  const { data: samplePlayers } = useCollection(playersQuery);
  
  useEffect(() => {
    if (samplePlayers && samplePlayers.length > 0) {
      setPotm(samplePlayers[0]);
    }
  }, [samplePlayers]);

  const getTeam = (id: string) => teams.find(t => t.id === id);
  const t1 = getTeam(match.team1Id);
  const t2 = getTeam(match.team2Id);

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const executeDelete = () => {
    if (!user) {
      toast({ title: "Session Error", description: "Login required.", variant: "destructive" });
      return;
    }
    deleteDocumentNonBlocking(doc(db, 'matches', match.id));
    toast({ title: "Match Deleted", description: "Record removed successfully." });
  };

  const handleUpdateResult = () => {
    if (!editedResult.trim()) return;
    updateDocumentNonBlocking(doc(db, 'matches', match.id), { resultDescription: editedResult });
    setIsEditing(false);
    toast({ title: "Result Updated" });
  };

  const renderInningRow = (inning: any) => {
    if (!inning) return null;
    const team = getTeam(inning.battingTeamId);
    return (
      <div className="flex justify-between items-center w-full py-1">
        <div className="flex items-center gap-2">
          <span className="font-black text-lg text-slate-700 w-10">{getAbbr(team?.name || '')}</span>
          <span className="font-bold text-xl text-slate-900">
            {inning.score}/{inning.wickets}
          </span>
          <span className="text-sm font-bold text-slate-500">
            ({inning.oversCompleted})
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="border shadow-sm bg-white overflow-hidden group relative transition-all hover:border-primary/50">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
            {match.resultDescription}
          </div>
          {isUmpire && (
            <div className="flex items-center gap-1">
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="w-3.5 h-3.5" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Result</DialogTitle></DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label>Result Description</Label>
                    <Input value={editedResult} onChange={(e) => setEditedResult(e.target.value)} />
                  </div>
                  <DialogFooter><Button onClick={handleUpdateResult}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Match?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the match history record.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="space-y-0">
          {renderInningRow(inn1)}
          {renderInningRow(inn2)}
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mt-4">
          <CollapsibleContent className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Player of the Match</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-slate-100">
                  <AvatarImage src={potm?.imageUrl || `https://picsum.photos/seed/${match.id}/100`} />
                  <AvatarFallback><Star className="w-4 h-4 text-yellow-500" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-slate-800">{potm?.name || 'Loading...'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{potm?.role || 'Performer'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-500 tracking-tighter pt-2">
              <Link href={`/match/${match.id}`} className="hover:text-primary underline decoration-2 underline-offset-4">Full Scorecard</Link>
              {match.status === 'completed' && (
                <Link 
                  href={`/match/new?t1=${match.team1Id}&t2=${match.team2Id}&overs=${match.totalOvers}`} 
                  className="flex items-center gap-1 text-secondary hover:underline"
                >
                  <RefreshCcw className="w-3 h-3" /> Play Again
                </Link>
              )}
            </div>
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full mt-2 h-8 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>
    </Card>
  );
}

export default function MatchHistoryPage() {
  const { isUmpire } = useApp();
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches, isLoading } = useCollection(matchesQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams = [] } = useCollection(teamsQuery);

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'completed') || [];

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black font-headline tracking-tight">Match History</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Leagues & Championships</p>
      </div>

      <Tabs defaultValue="past" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
          <TabsTrigger value="live" className="font-bold">Live Now</TabsTrigger>
          <TabsTrigger value="past" className="font-bold">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="live" className="mt-0">
          <div className="grid grid-cols-1 gap-4">
            {liveMatches.length > 0 ? ( liveMatches.map(match => (
                <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} />
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                <PlayCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-bold uppercase">No active matches</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="past" className="mt-0">
          <div className="grid grid-cols-1 gap-4">
            {pastMatches.length > 0 ? (
              pastMatches.map(match => (
                <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} />
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                <HistoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-bold uppercase">No records found</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
