
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { calculatePlayerCVP, type PlayerMatchStats } from '@/lib/cvp-utils';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none'
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const activeInningData = match?.currentInningNumber === 1 ? inn1 : inn2;

  useEffect(() => {
    if (match?.currentInningNumber) {
      setActiveInningView(match.currentInningNumber);
    }
  }, [match?.currentInningNumber]);

  const inn1DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);

  const inn2DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayer = (pid: string) => allPlayers?.find(p => p.id === pid);
  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = getPlayer(pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire) return;

    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    
    let ballRuns = runs;
    let extraRuns = 0;
    let isLegalBall = true;

    if (extraType === 'wide') {
      extraRuns = runs + 1;
      ballRuns = 0;
      isLegalBall = false;
    } else if (extraType === 'noball') {
      extraRuns = 1;
      isLegalBall = false;
    } else if (extraType === 'bye' || extraType === 'legbye') {
      extraRuns = runs;
      ballRuns = 0;
    }

    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newScore = activeInningData.score + totalRunsOnDelivery;
    let newBalls = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOvers = activeInningData.oversCompleted;

    if (newBalls === 6) {
      newOvers += 1;
      newBalls = 0;
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      overNumber: newBalls === 0 && isLegalBall ? newOvers : newOvers + 1,
      ballNumberInOver: newBalls === 0 && isLegalBall ? 6 : newBalls,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: ballRuns,
      extraRuns: extraRuns,
      extraType,
      totalRunsOnDelivery,
      isWicket: false,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    updateDocumentNonBlocking(inningRef, {
      score: newScore,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: runs % 2 !== 0 ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId,
      nonStrikerPlayerId: runs % 2 !== 0 ? activeInningData.strikerPlayerId : activeInningData.nonStrikerPlayerId
    });

    if (newBalls === 0 && isLegalBall) {
      setIsBowlerDialogOpen(true);
      toast({ title: "Over Complete", description: "Select next bowler." });
    }
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire) return;

    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    
    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      overNumber: activeInningData.ballsInCurrentOver === 5 ? activeInningData.oversCompleted + 1 : activeInningData.oversCompleted + 1,
      ballNumberInOver: activeInningData.ballsInCurrentOver + 1,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: 0,
      extraRuns: 0,
      extraType: 'none',
      totalRunsOnDelivery: 0,
      isWicket: true,
      dismissalType: wicketForm.type,
      batsmanOutPlayerId: wicketForm.batterOutId,
      fielderPlayerId: wicketForm.fielderId,
      outcomeDescription: `${wicketForm.type} ${wicketForm.fielderId !== 'none' ? 'by ' + getPlayerName(wicketForm.fielderId) : ''}`,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);

    const newWickets = activeInningData.wickets + 1;
    let newBalls = activeInningData.ballsInCurrentOver + 1;
    let newOvers = activeInningData.oversCompleted;

    if (newBalls === 6) {
      newOvers += 1;
      newBalls = 0;
    }

    updateDocumentNonBlocking(inningRef, {
      wickets: newWickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: 'none' // Umpire must select new batter
    });

    setIsWicketDialogOpen(false);
    toast({ title: "OUT!", variant: "destructive" });
  };

  const handleEndMatch = async () => {
    if (!match || !inn1 || !allTeams) return;
    
    const team1Id = match.team1Id;
    const team2Id = match.team2Id;
    
    const i1Score = inn1.score;
    const i1Balls = (inn1.oversCompleted * 6) + (inn1.ballsInCurrentOver || 0);
    
    const i2Score = inn2?.score || 0;
    const i2Balls = inn2 ? (inn2.oversCompleted * 6) + (inn2.ballsInCurrentOver || 0) : 0;

    let result = '';
    let winnerId = '';
    let loserId = '';

    if (i1Score > i2Score) {
      result = `${getTeamName(team1Id)} won by ${i1Score - i2Score} runs`;
      winnerId = team1Id;
      loserId = team2Id;
    } else if (i2Score > i1Score) {
      result = `${getTeamName(team2Id)} won by ${10 - (inn2?.wickets || 0)} wickets`;
      winnerId = team2Id;
      loserId = team1Id;
    } else {
      result = "Match Drawn";
    }

    // --- CVP & POTM Calculation ---
    const allDeliveries = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];
    const perfMap: Record<string, PlayerMatchStats> = {};

    [...match.team1SquadPlayerIds, ...match.team2SquadPlayerIds].forEach(pid => {
      perfMap[pid] = {
        id: pid, name: getPlayerName(pid),
        runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
        wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0,
        catches: 0, stumpings: 0, runOuts: 0
      };
    });

    allDeliveries.forEach(d => {
      if (d.strikerPlayerId && perfMap[d.strikerPlayerId]) {
        perfMap[d.strikerPlayerId].runs += d.runsScored;
        if (d.extraType === 'none') perfMap[d.strikerPlayerId].ballsFaced += 1;
        if (d.runsScored === 4) perfMap[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) perfMap[d.strikerPlayerId].sixes += 1;
      }
      if (d.bowlerPlayerId && perfMap[d.bowlerPlayerId]) {
        if (d.extraType === 'none') perfMap[d.bowlerPlayerId].ballsBowled += 1;
        if (d.extraType === 'wide') perfMap[d.bowlerPlayerId].runsConceded += d.extraRuns;
        else if (d.extraType === 'noball') perfMap[d.bowlerPlayerId].runsConceded += (d.runsScored + 1);
        else perfMap[d.bowlerPlayerId].runsConceded += d.runsScored;
        
        if (d.isWicket && !['runout'].includes(d.dismissalType)) perfMap[d.bowlerPlayerId].wickets += 1;
      }
      if (d.isWicket && d.fielderPlayerId && perfMap[d.fielderPlayerId]) {
        if (d.dismissalType === 'catch') perfMap[d.fielderPlayerId].catches += 1;
        if (d.dismissalType === 'stumping') perfMap[d.fielderPlayerId].stumpings += 1;
        if (d.dismissalType === 'runout') perfMap[d.fielderPlayerId].runOuts += 1;
      }
    });

    let maxCVP = -Infinity;
    let potmId = '';
    const playerMatchPoints: Record<string, number> = {};

    Object.entries(perfMap).forEach(([pid, stats]) => {
      const pts = calculatePlayerCVP(stats);
      playerMatchPoints[pid] = pts;
      if (pts > maxCVP) {
        maxCVP = pts;
        potmId = pid;
      }
    });

    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { 
      status: 'completed', 
      resultDescription: result,
      potmPlayerId: potmId,
      potmCvpScore: maxCVP
    });

    // Update Player Career CVP
    Object.entries(playerMatchPoints).forEach(([pid, pts]) => {
      const p = getPlayer(pid);
      if (p) {
        batch.update(doc(db, 'players', pid), {
          careerCVP: (p.careerCVP || 0) + pts,
          matchesPlayed: (p.matchesPlayed || 0) + 1
        });
      }
    });

    const t1 = allTeams?.find(t => t.id === team1Id);
    const t2 = allTeams?.find(t => t.id === team2Id);

    if (t1 && t2) {
      const newT1RunsScored = (t1.totalRunsScored || 0) + i1Score;
      const newT1RunsConceded = (t1.totalRunsConceded || 0) + i2Score;
      const newT1BallsFaced = (t1.totalBallsFaced || 0) + i1Balls;
      const newT1BallsBowled = (t1.totalBallsBowled || 0) + i2Balls;

      const newT2RunsScored = (t2.totalRunsScored || 0) + i2Score;
      const newT2RunsConceded = (t2.totalRunsConceded || 0) + i1Score;
      const newT2BallsFaced = (t2.totalBallsFaced || 0) + i2Balls;
      const newT2BallsBowled = (t2.totalBallsBowled || 0) + i1Balls;

      // NRR = (Runs * 6 / Balls Faced) - (Runs * 6 / Balls Bowled)
      const t1NRR = (newT1RunsScored * 6 / (newT1BallsFaced || 1)) - (newT1RunsConceded * 6 / (newT1BallsBowled || 1));
      const t2NRR = (newT2RunsScored * 6 / (newT2BallsFaced || 1)) - (newT2RunsConceded * 6 / (newT2BallsBowled || 1));

      batch.update(doc(db, 'teams', team1Id), {
        matchesWon: (t1.matchesWon || 0) + (winnerId === team1Id ? 1 : 0),
        matchesLost: (t1.matchesLost || 0) + (loserId === team1Id ? 1 : 0),
        matchesDrawn: (t1.matchesDrawn || 0) + (winnerId === '' ? 1 : 0),
        totalRunsScored: newT1RunsScored,
        totalRunsConceded: newT1RunsConceded,
        totalBallsFaced: newT1BallsFaced,
        totalBallsBowled: newT1BallsBowled,
        netRunRate: t1NRR
      });

      batch.update(doc(db, 'teams', team2Id), {
        matchesWon: (t2.matchesWon || 0) + (winnerId === team2Id ? 1 : 0),
        matchesLost: (t2.matchesLost || 0) + (loserId === team2Id ? 1 : 0),
        matchesDrawn: (t2.matchesDrawn || 0) + (winnerId === '' ? 1 : 0),
        totalRunsScored: newT2RunsScored,
        totalRunsConceded: newT2RunsConceded,
        totalBallsFaced: newT2BallsFaced,
        totalBallsBowled: newT2BallsBowled,
        netRunRate: t2NRR
      });
    }

    await batch.commit();
    toast({ title: "Match Concluded", description: result });
  };

  const groupedOvers = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return [];
    
    const oversMap: Record<number, { 
      overNumber: number; 
      balls: any[]; 
      overRuns: number; 
      cumulativeScore: number; 
      cumulativeWickets: number;
      bowlerId: string;
      batterIds: string[];
    }> = {};

    let runningScore = 0;
    let runningWickets = 0;

    const sortedDeliveries = [...deliveries].sort((a, b) => a.timestamp - b.timestamp);

    sortedDeliveries.forEach(d => {
      runningScore += d.totalRunsOnDelivery;
      if (d.isWicket) runningWickets++;

      if (!oversMap[d.overNumber]) {
        oversMap[d.overNumber] = {
          overNumber: d.overNumber,
          balls: [],
          overRuns: 0,
          cumulativeScore: 0,
          cumulativeWickets: 0,
          bowlerId: d.bowlerPlayerId,
          batterIds: []
        };
      }
      
      oversMap[d.overNumber].balls.push(d);
      oversMap[d.overNumber].overRuns += d.totalRunsOnDelivery;
      oversMap[d.overNumber].cumulativeScore = runningScore;
      oversMap[d.overNumber].cumulativeWickets = runningWickets;
      if (!oversMap[d.overNumber].batterIds.includes(d.strikerPlayerId)) {
        oversMap[d.overNumber].batterIds.push(d.strikerPlayerId);
      }
    });
    
    return Object.values(oversMap).sort((a, b) => b.overNumber - a.overNumber);
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center">Loading scoreboard...</div>;
  if (!match) return <div className="p-20 text-center">Match data missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm text-center">
        <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</h1>
        <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">{match.status === 'completed' ? match.resultDescription : 'Match In Progress'}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 scrollbar-hide sticky top-16 z-40 bg-background/95 backdrop-blur">
          {['Info', 'Live', 'Scorecard', 'Overs'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab.toLowerCase()} 
              className="px-6 py-4 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary whitespace-nowrap uppercase tracking-widest"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="border shadow-none rounded-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">MATCH INFO</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Venue</span><span className="font-black text-slate-900">League Grounds</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{isMounted ? new Date(match.matchDate).toLocaleDateString() : '---'}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Toss</span><span className="font-medium text-slate-900">{match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won & opt to ${match.tossDecision}` : '---'}</span></div>
              </div>
            </CardContent>
          </Card>

          {match.status === 'completed' && match.potmPlayerId && (
            <Card className="border shadow-sm rounded-xl bg-primary/5 overflow-hidden border-primary/20">
              <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                 <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                      <AvatarImage src={getPlayer(match.potmPlayerId)?.imageUrl} />
                      <AvatarFallback><Star className="w-8 h-8 text-yellow-500" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 bg-secondary text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                      <Trophy className="w-4 h-4" />
                    </div>
                 </div>
                 <div className="text-center md:text-left space-y-1">
                    <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Player of the Match</p>
                    <h3 className="text-2xl font-black text-slate-900">{getPlayerName(match.potmPlayerId)}</h3>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                      <Badge className="bg-secondary text-white font-bold">{getPlayer(match.potmPlayerId)?.role}</Badge>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">Impact Score: {match.potmCvpScore?.toFixed(1)}</span>
                    </div>
                 </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inn1 && <div className={cn("p-4 rounded-xl border flex justify-between items-center transition-all", match.currentInningNumber === 1 ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-slate-50 opacity-60")}><div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400">1st Innings</p><h4 className="font-black text-xl">{getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Overs</p><h4 className="font-bold">{inn1.oversCompleted}.{inn1.ballsInCurrentOver}</h4></div></div>}
              {inn2 && <div className={cn("p-4 rounded-xl border flex justify-between items-center transition-all", match.currentInningNumber === 2 ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-slate-50 opacity-60")}><div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400">2nd Innings</p><h4 className="font-black text-xl">{getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Overs</p><h4 className="font-bold">{inn2.oversCompleted}.{inn2.ballsInCurrentOver}</h4></div></div>}
            </div>

            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-black text-xs">BAT</div>
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase">On Strike</p>
                      <p className="text-sm font-bold truncate max-w-[120px]">{getPlayerName(activeInningData.strikerPlayerId)}*</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Target</p>
                    <p className="text-sm font-black">{match.currentInningNumber === 2 && inn1 ? inn1.score + 1 : '---'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[0, 1, 2, 3, 4, 6].map(runs => (
                    <Button key={runs} onClick={() => handleRecordBall(runs)} className="h-14 font-black text-lg bg-slate-100 text-slate-900 hover:bg-slate-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1 transition-all">
                      {runs === 0 ? "•" : runs}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 font-bold border-amber-200 text-amber-700 bg-amber-50">WIDE</Button>
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-12 font-bold border-amber-200 text-amber-700 bg-amber-50">NO BALL</Button>
                  <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-12 font-bold border-red-200 text-red-700 bg-red-50">WICKET</Button>
                  <Button variant="outline" onClick={() => setIsBowlerDialogOpen(true)} className="h-12 font-bold border-slate-200 text-slate-600">CHANGE BOWLER</Button>
                </div>

                <Button onClick={handleEndMatch} variant="destructive" className="w-full font-black uppercase text-xs h-12 tracking-widest mt-4">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Finish Match
                </Button>
              </div>
            )}

            {!isUmpire && match.status === 'live' && (
              <div className="mt-4 p-8 bg-slate-50 rounded-2xl border border-dashed flex flex-col items-center text-center gap-3">
                <ShieldAlert className="w-10 h-10 text-slate-300" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live scoring is restricted to Umpires only</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4 space-y-8">
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-8">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-8" disabled={!inn2}>Innings 2</Button>
          </div>
          <div className="p-4 text-center text-slate-400 text-xs italic">Scorecard data populated from live deliveries...</div>
        </TabsContent>

        <TabsContent value="overs" className="mt-4 space-y-0 divide-y bg-white rounded-lg border shadow-sm">
          <div className="flex gap-2 overflow-x-auto p-4 border-b bg-slate-50/50">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-8">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-8" disabled={!inn2}>Innings 2</Button>
          </div>
          
          {groupedOvers.length > 0 ? (
            groupedOvers.map((over) => (
              <div key={over.overNumber} className="p-4 flex flex-col md:flex-row gap-4 md:items-start md:justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1 min-w-[120px]">
                  <p className="font-black text-sm text-slate-900">Over {over.overNumber} <span className="text-slate-400 font-bold ml-1">- {over.overRuns} runs</span></p>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">
                    {getAbbr(getTeamName(activeInningData?.battingTeamId || ''))} {over.cumulativeScore}-{over.cumulativeWickets}
                  </p>
                </div>
                
                <div className="flex-1 space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    {getPlayerName(over.bowlerId)} to {over.batterIds.map((id, idx) => (
                      <span key={id}>{idx > 0 && ' & '}{getPlayerName(id)}</span>
                    ))}
                  </p>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {over.balls.map((ball, idx) => {
                      let bgColor = 'bg-slate-400';
                      let text = ball.totalRunsOnDelivery;
                      
                      if (ball.isWicket) {
                        bgColor = 'bg-red-600';
                        text = 'W';
                      } else if (ball.runsScored === 6) {
                        bgColor = 'bg-purple-600';
                      } else if (ball.runsScored === 4) {
                        bgColor = 'bg-blue-600';
                      } else if (ball.extraType === 'wide') {
                        bgColor = 'bg-amber-700';
                        text = 'Wd';
                      } else if (ball.extraType === 'noball') {
                        bgColor = 'bg-amber-700';
                        text = 'Nb';
                      }
                      
                      return (
                        <div key={idx} className={cn("w-7 h-7 flex items-center justify-center rounded-sm text-[10px] font-black text-white shadow-sm", bgColor)}>
                          {text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 space-y-3">
              <History className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No deliveries recorded yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Wicket Dialog */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Who is out?</Label>
              <Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Batter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeInningData?.strikerPlayerId || 'none'}>{getPlayerName(activeInningData?.strikerPlayerId || '')}</SelectItem>
                  <SelectItem value={activeInningData?.nonStrikerPlayerId || 'none'}>{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dismissal Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="catch">Caught</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumping">Stumped</SelectItem>
                  <SelectItem value="hitwicket">Hit Wicket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fielder (Optional)</Label>
              <Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Fielder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allPlayers?.filter(p => p.teamId === activeInningData?.bowlingTeamId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full font-black uppercase tracking-widest">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bowler Dialog */}
      <Dialog open={isBowlerDialogOpen} onOpenChange={setIsBowlerDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Bowler</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Bowler for Next Over</Label>
              <Select onValueChange={(v) => {
                updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v });
                setIsBowlerDialogOpen(false);
              }}>
                <SelectTrigger><SelectValue placeholder="Select Bowler" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => p.teamId === activeInningData?.bowlingTeamId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
