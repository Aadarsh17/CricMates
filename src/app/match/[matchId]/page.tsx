
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('live');

  useEffect(() => {
    if (match?.currentInningNumber) {
      setActiveInningView(match.currentInningNumber);
    }
  }, [match?.currentInningNumber]);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const activeInningData = activeInningView === 1 ? inn1 : inn2;

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

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = allPlayers?.find(p => p.id === pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

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

  const handleEndMatch = async () => {
    if (!match || !inn1) return;
    
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

    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { status: 'completed', resultDescription: result });

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

      // NRR Formula: (Runs * 6 / Balls Faced) - (Runs * 6 / Balls Bowled)
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

  const scorecard = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return { batting: [], bowling: [], fow: [], partnerships: [], extras: { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 } };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};
    const extras = { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 };
    const fow: any[] = [];
    const partnerships: any[] = [];

    let runningScore = 0;
    let runningWickets = 0;
    
    let p1 = { id: '', runs: 0, balls: 0 };
    let p2 = { id: '', runs: 0, balls: 0 };
    let partTotalRuns = 0;
    let partTotalBalls = 0;

    const sortedDeliveries = [...deliveries].sort((a, b) => a.timestamp - b.timestamp);

    sortedDeliveries.forEach((d: any) => {
      runningScore += d.totalRunsOnDelivery;

      if (d.extraType !== 'none') {
        const type = d.extraType as keyof typeof extras;
        if (extras[type] !== undefined) {
          extras[type] += d.extraRuns;
          extras.total += d.extraRuns;
        }
      }

      if (!p1.id && d.strikerPlayerId !== 'none') p1.id = d.strikerPlayerId;
      if (d.strikerPlayerId !== p1.id && !p2.id && d.strikerPlayerId !== 'none') p2.id = d.strikerPlayerId;

      partTotalRuns += d.totalRunsOnDelivery;
      if (d.extraType === 'none') partTotalBalls += 1;

      if (d.strikerPlayerId && d.strikerPlayerId !== 'none') {
        if (!battingMap[d.strikerPlayerId]) {
          battingMap[d.strikerPlayerId] = { id: d.strikerPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' };
        }
        battingMap[d.strikerPlayerId].runs += d.runsScored;
        
        if (d.strikerPlayerId === p1.id) {
          p1.runs += d.runsScored;
          if (d.extraType === 'none') p1.balls += 1;
        } else if (d.strikerPlayerId === p2.id) {
          p2.runs += d.runsScored;
          if (d.extraType === 'none') p2.balls += 1;
        }

        if (d.extraType !== 'wide') battingMap[d.strikerPlayerId].balls += 1;
        if (d.runsScored === 4) battingMap[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) battingMap[d.strikerPlayerId].sixes += 1;
        
        if (d.isWicket && d.batsmanOutPlayerId === d.strikerPlayerId) {
          battingMap[d.strikerPlayerId].out = true;
          battingMap[d.strikerPlayerId].dismissal = d.outcomeDescription;
        }
      }

      if (d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== d.strikerPlayerId && d.batsmanOutPlayerId !== 'none') {
         if (!battingMap[d.batsmanOutPlayerId]) {
           battingMap[d.batsmanOutPlayerId] = { id: d.batsmanOutPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: true, dismissal: d.outcomeDescription };
         } else {
           battingMap[d.batsmanOutPlayerId].out = true;
           battingMap[d.batsmanOutPlayerId].dismissal = d.outcomeDescription;
         }
      }

      if (d.bowlerPlayerId && d.bowlerPlayerId !== 'none') {
        if (!bowlingMap[d.bowlerPlayerId]) {
          bowlingMap[d.bowlerPlayerId] = { id: d.bowlerPlayerId, legalBalls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0 };
        }
        if (d.extraType === 'none') bowlingMap[d.bowlerPlayerId].legalBalls += 1;
        if (d.extraType === 'wide') {
          bowlingMap[d.bowlerPlayerId].wides += d.extraRuns;
          bowlingMap[d.bowlerPlayerId].runs += d.extraRuns;
        } else if (d.extraType === 'noball') {
          bowlingMap[d.bowlerPlayerId].noballs += 1;
          bowlingMap[d.bowlerPlayerId].runs += (d.runsScored + 1);
        } else {
          bowlingMap[d.bowlerPlayerId].runs += d.runsScored;
        }
        if (d.isWicket && !['runout'].includes(d.dismissalType)) bowlingMap[d.bowlerPlayerId].wickets += 1;
      }

      if (d.isWicket) {
        runningWickets++;
        fow.push({
          wicket: runningWickets,
          score: runningScore,
          batterId: d.batsmanOutPlayerId,
          over: `${d.overNumber}.${d.ballNumberInOver}`
        });

        partnerships.push({ p1: { ...p1 }, p2: { ...p2 }, totalRuns: partTotalRuns, totalBalls: partTotalBalls, wicket: runningWickets });

        const survivorId = d.batsmanOutPlayerId === p1.id ? p2.id : p1.id;
        p1 = { id: survivorId, runs: 0, balls: 0 };
        p2 = { id: '', runs: 0, balls: 0 };
        partTotalRuns = 0;
        partTotalBalls = 0;
      }
    });

    return { batting: Object.values(battingMap), bowling: Object.values(bowlingMap), fow, partnerships, extras };
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
              value={tab.toLowerCase().replace(' ', '-')} 
              className="px-4 py-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary whitespace-nowrap"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="border shadow-none rounded-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">INFO</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Match</span><span className="font-black text-slate-900">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{isMounted ? new Date(match.matchDate).toLocaleDateString() : '---'}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Toss</span><span className="font-medium text-slate-900">{match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won & opt to ${match.tossDecision}` : '---'}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-4 text-center">
             <div className="space-y-3">
              {inn1 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets} <span className="text-slate-400 font-bold text-xs">({inn1.oversCompleted}.{inn1.ballsInCurrentOver})</span></span>{match.currentInningNumber === 1 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
              {inn2 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets} <span className="text-slate-400 font-bold text-xs">({inn2.oversCompleted}.{inn2.ballsInCurrentOver})</span></span>{match.currentInningNumber === 2 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
            </div>
            {isUmpire && match.status === 'live' && (
              <Button onClick={handleEndMatch} variant="destructive" className="w-full font-black uppercase text-xs h-12 tracking-widest mt-4">
                <CheckCircle2 className="w-4 h-4 mr-2" /> End Match
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4 space-y-8">
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-8">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-8" disabled={!inn2}>Innings 2</Button>
          </div>

          {activeInningData && (
            <div className="space-y-6">
              <div className="bg-primary text-white p-3 flex justify-between items-center rounded-sm">
                <span className="font-bold text-xs uppercase truncate">{getTeamName(activeInningData.battingTeamId)}</span>
                <span className="font-black text-xs whitespace-nowrap">{activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver})</span>
              </div>

              <div className="overflow-x-auto border rounded-sm">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold uppercase">Batter</TableHead><TableHead className="text-right text-[10px] font-bold">R</TableHead><TableHead className="text-right text-[10px] font-bold">B</TableHead><TableHead className="text-right text-[10px] font-bold">SR</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scorecard.batting.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="py-2"><p className="text-xs font-bold text-blue-600">{getPlayerName(b.id)}{b.id === activeInningData.strikerPlayerId && '*'}</p><p className="text-[9px] text-slate-400 italic">{b.out ? b.dismissal : 'not out'}</p></TableCell>
                        <TableCell className="text-right font-black text-xs">{b.runs}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-x-auto border rounded-sm">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold uppercase">Bowler</TableHead><TableHead className="text-right text-[10px] font-bold">O</TableHead><TableHead className="text-right text-[10px] font-bold">R</TableHead><TableHead className="text-right text-[10px] font-bold">W</TableHead><TableHead className="text-right text-[10px] font-bold">ECO</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scorecard.bowling.map(bw => (
                      <TableRow key={bw.id}>
                        <TableCell className="text-blue-600 font-bold text-xs py-2">{getPlayerName(bw.id)}</TableCell>
                        <TableCell className="text-right text-xs">{Math.floor(bw.legalBalls/6)}.{bw.legalBalls%6}</TableCell>
                        <TableCell className="text-right text-xs font-black">{bw.runs}</TableCell>
                        <TableCell className="text-right text-xs font-black text-secondary">{bw.wickets}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{bw.legalBalls > 0 ? ((bw.runs/(bw.legalBalls/6))).toFixed(2) : '0.00'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400">Fall of Wickets</p>
                <div className="overflow-x-auto border rounded-sm">
                   <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold">Wkt</TableHead><TableHead className="text-[10px] font-bold">Batter</TableHead><TableHead className="text-right text-[10px] font-bold">Score</TableHead><TableHead className="text-right text-[10px] font-bold">Over</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {scorecard.fow.map(f => (
                        <TableRow key={f.wicket}><TableCell className="text-xs font-bold">{f.wicket}</TableCell><TableCell className="text-xs text-blue-600 font-medium">{getPlayerName(f.batterId)}</TableCell><TableCell className="text-right text-xs font-bold">{f.score}</TableCell><TableCell className="text-right text-xs text-slate-500">{f.over}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400">Partnerships</p>
                <div className="overflow-x-auto border rounded-sm">
                   <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold">Wkt</TableHead><TableHead className="text-[10px] font-bold">Batter 1</TableHead><TableHead className="text-center text-[10px] font-bold">Total</TableHead><TableHead className="text-right text-[10px] font-bold">Batter 2</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {scorecard.partnerships.map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-bold">{p.wicket}</TableCell>
                          <TableCell className="text-xs"><span className="text-blue-600 font-medium">{getPlayerName(p.p1.id)}</span><br/><span className="text-[10px] text-slate-400">{p.p1.runs} ({p.p1.balls})</span></TableCell>
                          <TableCell className="text-center font-black text-xs">{p.totalRuns}<br/><span className="text-[10px] font-normal text-slate-400">({p.totalBalls} balls)</span></TableCell>
                          <TableCell className="text-right text-xs"><span className="text-blue-600 font-medium">{getPlayerName(p.p2.id)}</span><br/><span className="text-[10px] text-slate-400">{p.p2.runs} ({p.p2.balls})</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
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
                        <div 
                          key={idx} 
                          className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-sm text-[10px] font-black text-white shadow-sm",
                            bgColor
                          )}
                        >
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
    </div>
  );
}
