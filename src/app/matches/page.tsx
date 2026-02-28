
'use client';

import { useCollection, useMemoFirebase, useFirestore, useDoc, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, limit } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, PlayCircle, History as HistoryIcon, RefreshCcw, Trash2, Edit2, Star, ChevronDown, ChevronUp, Info, Trophy } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

function MatchScoreCard({ match, teams, isUmpire, isMounted, allPlayers }: { match: any, teams: any[], isUmpire: boolean, isMounted: boolean, allPlayers: any[] }) {
  const db = useFirestore();
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editedResult, setEditedResult] = useState(match.resultDescription);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_1'), [db, match.id]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_2'), [db, match.id]);
  const { data: inn2 } = useDoc(inn2Ref);

  const getTeam = (id: string) => teams.find(t => t.id === id);
  const getPlayer = (id: string) => allPlayers.find(p => p.id === id);

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const formatDate = (dateString: string) => {
    if (!isMounted || !dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric'
    });
  };

  const executeDelete = () => {
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
      <div className="flex justify-between items-center w-full py-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border bg-muted">
            <AvatarImage src={`https://picsum.photos/seed/${inning.battingTeamId}/100`} />
            <AvatarFallback>{getAbbr(team?.name || '')[0]}</AvatarFallback>
          </Avatar>
          <span className="font-black text-lg text-slate-800 tracking-tight">{getAbbr(team?.name || '')}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-black text-2xl text-slate-900">
            {inning.score}/{inning.wickets}
          </span>
          <span className="text-sm font-bold text-slate-500">
            ({inning.oversCompleted}.{inning.ballsInCurrentOver || 0})
          </span>
        </div>
      </div>
    );
  };

  const tossText = match.tossWinnerTeamId 
    ? `${getTeam(match.tossWinnerTeamId)?.name} won & chose to ${match.tossDecision}`
    : 'Toss details unavailable';

  const potm = match.potmPlayerId ? getPlayer(match.potmPlayerId) : null;

  return (
    <Card className="border shadow-sm bg-white overflow-hidden group relative transition-all hover:border-primary/50 border-l-4 border-l-primary rounded-xl">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {formatDate(match.matchDate)}
            </span>
            <div className="text-xs font-black text-primary mt-1">
              {match.resultDescription}
            </div>
          </div>
          {isUmpire && (
            <div className="flex items-center gap-1">
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Edit Match Result</DialogTitle></DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Result Description</Label>
                      <Input value={editedResult} onChange={(e) => setEditedResult(e.target.value)} placeholder="e.g. Team A won by 5 runs" />
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleUpdateResult} className="w-full">Save Changes</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this Match?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. All delivery records and stats for this match will be lost.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Match</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="space-y-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          {renderInningRow(inn1)}
          {renderInningRow(inn2)}
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mt-4">
          <CollapsibleContent className="space-y-5 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Match Info</p>
                  <p className="text-xs font-bold text-slate-700">{tossText}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Format: {match.totalOvers} Overs Match</p>
                </div>
              </div>

              {match.status === 'completed' && match.potmPlayerId && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Player of the Match</p>
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border shadow-sm border-secondary/20 bg-secondary/5">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={potm?.imageUrl || `https://picsum.photos/seed/${match.id}/100`} />
                      <AvatarFallback><Star className="w-4 h-4 text-yellow-500" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-black text-slate-800">{potm?.name || 'Top Performer'}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[8px] h-4 px-1">{potm?.role || 'MVP'}</Badge>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">CVP Score: {match.potmCvpScore?.toFixed(1) || '0.0'}</span>
                      </div>
                    </div>
                    <Trophy className="ml-auto w-5 h-5 text-secondary mr-2" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <Button asChild className="flex-1 bg-primary font-bold h-9">
                <Link href={`/match/${match.id}`}>Full Scorecard</Link>
              </Button>
              {match.status === 'completed' && (
                <Button asChild variant="outline" className="flex-1 border-secondary text-secondary hover:bg-secondary/5 font-bold h-9">
                  <Link href={`/match/new?t1=${match.team1Id}&t2=${match.team2Id}&overs=${match.totalOvers}`}>
                    <RefreshCcw className="w-3 h-3 mr-2" /> Play Again
                  </Link>
                </Button>
              )}
            </div>
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full mt-2 h-8 text-slate-400 hover:bg-slate-50 hover:text-primary transition-colors">
              {isOpen ? (
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase"><ChevronUp className="w-3 h-3" /> Show Less</div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase"><ChevronDown className="w-3 h-3" /> View Details</div>
              )}
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

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers = [] } = useCollection(playersQuery);

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'completed') || [];

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900">Match History</h1>
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
          <div className="w-8 h-0.5 bg-primary" /> League Records & Results
        </div>
      </div>

      <Tabs defaultValue="past" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="live" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
            Live <Badge variant="destructive" className="ml-2 h-4 px-1 text-[8px] animate-pulse">NEW</Badge>
          </TabsTrigger>
          <TabsTrigger value="past" className="font-bold data-[state=active]:bg-white rounded-lg">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="live" className="mt-0 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Card key={i} className="h-48 animate-pulse bg-slate-50 rounded-xl" />)}
            </div>
          ) : liveMatches.length > 0 ? ( 
            liveMatches.map(match => (
              <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} isMounted={isMounted} allPlayers={allPlayers} />
            ))
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
              <PlayCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No active matches found</p>
              <Button asChild variant="link" className="mt-2 text-primary">
                <Link href="/match/new">Setup a Match</Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-0 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-slate-50 rounded-xl" />)}
            </div>
          ) : pastMatches.length > 0 ? (
            pastMatches.map(match => (
              <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} isMounted={isMounted} allPlayers={allPlayers} />
            ))
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
              <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Archive is empty</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
