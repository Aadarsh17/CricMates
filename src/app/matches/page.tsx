
'use client';

import { useCollection, useMemoFirebase, useFirestore, useDoc, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, PlayCircle, History as HistoryIcon, RefreshCcw, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  const [editedResult, setEditedResult] = useState(match.resultDescription);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_1'), [db, match.id]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_2'), [db, match.id]);
  const { data: inn2 } = useDoc(inn2Ref);

  const getTeam = (id: string) => teams.find(t => t.id === id);
  const t1 = getTeam(match.team1Id);
  const t2 = getTeam(match.team2Id);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const executeDelete = () => {
    if (!user) {
      toast({ 
        title: "Session Error", 
        description: "Please enable Umpire mode to delete.",
        variant: "destructive"
      });
      return;
    }

    toast({ 
      title: "Match Deleted", 
      description: "The record has been permanently removed." 
    });
    
    deleteDocumentNonBlocking(doc(db, 'matches', match.id));
  };

  const handleUpdateResult = () => {
    if (!editedResult.trim()) return;
    updateDocumentNonBlocking(doc(db, 'matches', match.id), {
      resultDescription: editedResult
    });
    setIsEditing(false);
    toast({ title: "Result Updated", description: "Match result description has been updated." });
  };

  const getInningDisplay = (inning: any) => {
    if (!inning) return null;
    const team = getTeam(inning.battingTeamId);
    return (
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <Avatar className="w-6 h-6">
            <AvatarImage src={team?.logoUrl} />
            <AvatarFallback>{team?.name?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <span className={`font-bold ${match.status === 'live' ? 'text-foreground' : 'text-muted-foreground'}`}>
            {team?.name || 'Unknown Team'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-black text-lg">{inning.score}-{inning.wickets}</span>
          <span className="text-xs text-muted-foreground">({inning.oversCompleted}.{inning.ballsInCurrentOver})</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="hover:shadow-lg transition-all border-none shadow-sm bg-card overflow-hidden group relative">
      <div className="p-4 space-y-3">
        <div className="text-[10px] text-muted-foreground font-medium flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span>Match • {formatDate(match.matchDate)}</span>
            {match.status === 'live' && (
              <div className="flex items-center text-destructive">
                <span className="animate-pulse w-1.5 h-1.5 bg-destructive rounded-full mr-1.5" />
                LIVE
              </div>
            )}
          </div>
          {isUmpire && (
            <div className="flex items-center gap-1">
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Match Result</DialogTitle>
                    <DialogDescription>Manually update the final result description for this match.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label htmlFor="result">Result Summary</Label>
                    <Input 
                      id="result" 
                      value={editedResult} 
                      onChange={(e) => setEditedResult(e.target.value)} 
                      placeholder="e.g. Team A won by 10 runs"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleUpdateResult}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="text-destructive w-5 h-5" />
                      Confirm Deletion
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to permanently delete the match between <strong>{t1?.name}</strong> and <strong>{t2?.name}</strong>? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Match
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="space-y-2 py-2">
          {getInningDisplay(inn1)}
          {getInningDisplay(inn2)}
        </div>

        <div className="text-xs font-bold text-primary italic border-l-2 border-primary/20 pl-2">
          {match.resultDescription}
        </div>

        <div className="flex items-center gap-4 pt-2 border-t text-[11px] font-bold text-primary uppercase tracking-tight">
          <Link href={`/match/${match.id}`} className="hover:underline">
            {match.status === 'live' ? 'Live Score' : 'Scorecard'}
          </Link>
          {match.status === 'completed' && (
            <Link 
              href={`/match/new?t1=${match.team1Id}&t2=${match.team2Id}&overs=${match.totalOvers}`} 
              className="flex items-center gap-1 text-secondary hover:underline"
            >
              <RefreshCcw className="w-3 h-3" /> Play Again
            </Link>
          )}
        </div>
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Match History</h1>
          <p className="text-muted-foreground text-sm">Real-time scores and archived championships.</p>
        </div>
        {isUmpire && (
          <Button className="bg-secondary hover:bg-secondary/90 h-9" asChild>
            <Link href="/match/new">
              <PlayCircle className="mr-2 h-4 w-4" /> Start New Match
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="past" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="live">Live Now</TabsTrigger>
          <TabsTrigger value="past">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="live" className="mt-0">
          {isLoading ? (
             <div className="py-12 text-center text-muted-foreground">Loading matches...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {liveMatches.length > 0 ? ( liveMatches.map(match => (
                  <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} />
                ))
              ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                  <PlayCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground text-sm">No matches are currently active.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-0">
          {isLoading ? (
             <div className="py-12 text-center text-muted-foreground">Loading history...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pastMatches.length > 0 ? (
                pastMatches.map(match => (
                  <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} />
                ))
              ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                  <HistoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground text-sm">No completed matches found.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
