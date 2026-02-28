"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Info, Users, Undo2, PlayCircle, Sparkles, Trophy, MessageSquare, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { generateMatchSummary } from '@/ai/flows/generate-match-summary';
import { calculateCvp } from '@/ai/flows/calculate-cvp-flow';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('live');

  // AI States
  const [aiSummary, setAiSummary] = useState<string>('');
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

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
  const activeInningRef = activeInningView === 1 ? inn1Ref : inn2Ref;

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

  const handleGenerateAiReport = async () => {
    if (!match || !inn1 || !allPlayers) return;
    setIsAiLoading(true);
    try {
      // 1. Process stats for all players involved
      const playerStats: Record<string, any> = {};
      const allDeliveries = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];

      allDeliveries.forEach(d => {
        if (!playerStats[d.strikerPlayerId]) playerStats[d.strikerPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, runsConceded: 0, overs: 0, catches: 0, stumpings: 0, runOuts: 0 };
        if (!playerStats[d.bowlerPlayerId]) playerStats[d.bowlerPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, runsConceded: 0, overs: 0, catches: 0, stumpings: 0, runOuts: 0 };
        
        playerStats[d.strikerPlayerId].runs += d.runsScored;
        if (d.extraType !== 'wide') playerStats[d.strikerPlayerId].balls += 1;
        if (d.runsScored === 4) playerStats[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) playerStats[d.strikerPlayerId].sixes += 1;

        if (d.extraType === 'none') playerStats[d.bowlerPlayerId].overs += (1/6);
        playerStats[d.bowlerPlayerId].runsConceded += d.totalRunsOnDelivery;
        if (d.isWicket && !['runout'].includes(d.dismissalType)) playerStats[d.bowlerPlayerId].wickets += 1;

        if (d.isWicket && d.fielderPlayerId !== 'none') {
          if (!playerStats[d.fielderPlayerId]) playerStats[d.fielderPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, runsConceded: 0, overs: 0, catches: 0, stumpings: 0, runOuts: 0 };
          if (d.dismissalType === 'caught') playerStats[d.fielderPlayerId].catches += 1;
          if (d.dismissalType === 'stumping') playerStats[d.fielderPlayerId].stumpings += 1;
          if (d.dismissalType === 'runout') playerStats[d.fielderPlayerId].runOuts += 1;
        }
      });

      // 2. Calculate CVPs for top 5 performers
      const playersToCalculate = Object.keys(playerStats).sort((a,b) => (playerStats[b].runs + playerStats[b].wickets * 20) - (playerStats[a].runs + playerStats[a].wickets * 20)).slice(0, 5);
      
      const performers = await Promise.all(playersToCalculate.map(async pid => {
        const stats = playerStats[pid];
        const player = allPlayers.find(p => p.id === pid);
        const cvpData = await calculateCvp({
          playerId: pid,
          playerName: player?.name || 'Player',
          isInPlayingXI: true,
          batting: { runsScored: stats.runs, fours: stats.fours, sixes: stats.sixes, ballsFaced: stats.balls },
          bowling: { wicketsTaken: stats.wickets, maidens: stats.maidens, oversBowled: Number(stats.overs.toFixed(1)), runsConceded: stats.runsConceded },
          fielding: { catches: stats.catches, stumpings: stats.stumpings, runOuts: stats.runOuts }
        });
        return { name: player?.name, ...stats, cvp: cvpData.cvpPoints, breakdown: cvpData.breakdown };
      }));

      setTopPerformers(performers.sort((a,b) => b.cvp - a.cvp));

      // 3. Generate Summary
      const summary = await generateMatchSummary({
        matchId,
        matchOverall: {
          date: match.matchDate,
          totalOversScheduled: match.totalOvers,
          result: match.resultDescription,
          team1Name: getTeamName(match.team1Id),
          team2Name: getTeamName(match.team2Id),
          team1FinalScore: `${inn1.score}/${inn1.wickets}`,
          team2FinalScore: inn2 ? `${inn2.score}/${inn2.wickets}` : 'N/A',
          tossWinner: getTeamName(match.tossWinnerTeamId),
          tossDecision: match.tossDecision
        },
        inningsSummaries: [
          {
            inningNumber: 1,
            battingTeamName: getTeamName(inn1.battingTeamId),
            bowlingTeamName: getTeamName(inn1.bowlingTeamId),
            score: inn1.score,
            wickets: inn1.wickets,
            overs: Number(`${inn1.oversCompleted}.${inn1.ballsInCurrentOver}`),
            topPerformersBatting: performers.filter(p => p.runs > 0).slice(0, 2).map(p => ({ playerName: p.name, runs: p.runs, ballsFaced: p.balls })),
            topPerformersBowling: performers.filter(p => p.wickets > 0).slice(0, 2).map(p => ({ playerName: p.name, overs: p.overs, maidens: p.maidens, runsConceded: p.runsConceded, wickets: p.wickets })),
            keyMoments: ['Match started with high intensity.']
          }
        ],
        playerOverallPerformance: performers.map(p => ({
          playerName: p.name,
          teamName: 'Squad',
          role: 'All-rounder',
          cvpScore: p.cvp,
          battingStats: { runs: p.runs, ballsFaced: p.balls, strikeRate: p.balls > 0 ? (p.runs/p.balls)*100 : 0, fours: p.fours, sixes: p.sixes },
          bowlingStats: { overs: p.overs, maidens: p.maidens, runsConceded: p.runsConceded, wickets: p.wickets, economy: p.overs > 0 ? p.runsConceded/p.overs : 0 }
        }))
      });

      setAiSummary(summary);
      toast({ title: "AI Analysis Complete" });
    } catch (e) {
      console.error(e);
      toast({ title: "AI Error", description: "Failed to process analytics.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
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

    deliveries.forEach((d: any) => {
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

  if (isMatchLoading) return <div className="p-20 text-center">Loading scoreboard...</div>;
  if (!match) return <div className="p-20 text-center">Match data missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm text-center">
        <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 scrollbar-hide sticky top-16 z-40 bg-background/95 backdrop-blur">
          {['Info', 'Live', 'Scorecard', 'Overs', 'AI Analytics'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab.toLowerCase().replace(' ', '-')} 
              className="px-4 py-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary whitespace-nowrap"
            >
              {tab === 'AI Analytics' ? <div className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Analytics</div> : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="border shadow-none rounded-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2"><Info className="w-3 h-3" /> INFO</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Match</span><span className="font-black text-slate-900">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{new Date(match.matchDate).toLocaleDateString()}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Toss</span><span className="font-medium text-slate-900">{match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won & opt to ${match.tossDecision}` : '---'}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-analytics" className="mt-4 space-y-6">
          {!aiSummary && !isAiLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-white space-y-4">
              <Sparkles className="w-12 h-12 text-primary/20" />
              <div className="text-center">
                <h3 className="font-black text-slate-900">AI Match Insights</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Generate summary & player CVP scores</p>
              </div>
              <Button onClick={handleGenerateAiReport} className="bg-primary hover:bg-primary/90 font-bold">
                Generate AI Analytics
              </Button>
            </div>
          ) : isAiLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Consulting AI Commentator...</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <Card className="border-l-4 border-l-secondary shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-secondary" />
                    <CardTitle className="text-sm font-black uppercase tracking-tighter">Match Narrative</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-slate-700 font-medium italic whitespace-pre-wrap">{aiSummary}</p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">MVP Performance Breakdown (v1.2.5)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topPerformers.map((p, idx) => (
                    <Card key={idx} className="overflow-hidden border shadow-none hover:border-primary/50 transition-colors">
                      <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                        <span className="font-black text-xs text-slate-900">{p.name}</span>
                        <Badge variant="secondary" className="font-black text-[10px]">{p.cvp} CVP</Badge>
                      </div>
                      <CardContent className="p-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-100/50 p-2 rounded">
                            <p className="text-[8px] font-black text-slate-400 uppercase">Runs</p>
                            <p className="text-sm font-black">{p.runs}</p>
                          </div>
                          <div className="bg-slate-100/50 p-2 rounded">
                            <p className="text-[8px] font-black text-slate-400 uppercase">Wkts</p>
                            <p className="text-sm font-black text-secondary">{p.wickets}</p>
                          </div>
                          <div className="bg-slate-100/50 p-2 rounded">
                            <p className="text-[8px] font-black text-slate-400 uppercase">SR</p>
                            <p className="text-sm font-black text-primary">{p.balls > 0 ? ((p.runs/p.balls)*100).toFixed(0) : '0'}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium leading-tight">{p.breakdown}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleGenerateAiReport}>
                <Undo2 className="w-4 h-4 mr-2" /> Recalculate Analytics
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Other tabs remain same... */}
        <TabsContent value="live" className="mt-4 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-4 text-center">
            <div className="text-blue-600 font-bold text-sm uppercase tracking-widest">{match.resultDescription}</div>
            <div className="space-y-3">
              {inn1 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets} <span className="text-slate-400 font-bold text-xs">({inn1.oversCompleted}.{inn1.ballsInCurrentOver})</span></span>{match.currentInningNumber === 1 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
              {inn2 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets} <span className="text-slate-400 font-bold text-xs">({inn2.oversCompleted}.{inn2.ballsInCurrentOver})</span></span>{match.currentInningNumber === 2 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
            </div>
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

        <TabsContent value="overs" className="mt-4 space-y-6">
          <div className="text-center py-10 text-slate-400 font-bold uppercase text-xs">Ball-by-ball history coming soon.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
