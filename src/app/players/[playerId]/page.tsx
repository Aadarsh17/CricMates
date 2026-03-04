
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collectionGroup, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag, Edit2, Loader2, Calendar, Camera, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', role: '', battingStyle: '', isWicketKeeper: false, imageUrl: ''
  });

  useEffect(() => { setIsMounted(true); }, []);

  const playerRef = useMemoFirebase(() => {
    if (!db || !playerId || !isMounted) return null;
    return doc(db, 'players', playerId);
  }, [db, playerId, isMounted]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  const historyQuery = useMemoFirebase(() => {
    if (!db || !playerId || !isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, playerId, isMounted]);
  const { data: allDeliveries, isLoading: isHistoryLoading } = useCollection(historyQuery);

  useEffect(() => {
    if (player) {
      setEditForm({
        name: player.name || '', role: player.role || 'Batsman', battingStyle: player.battingStyle || 'Right Handed Bat', isWicketKeeper: player.isWicketKeeper || false, imageUrl: player.imageUrl || ''
      });
    }
  }, [player]);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const matchWiseLog = useMemo(() => {
    if (!isMounted || !player || !allDeliveries || !allMatches) return [];
    const logs: Record<string, any> = {};
    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;
      if (!logs[matchId]) {
        const m = allMatches.find(match => match.id === matchId); if (!m) return;
        const opponentId = m.team1Id === player.teamId ? m.team2Id : m.team1Id;
        const opponent = allTeams?.find(t => t.id === opponentId);
        logs[matchId] = { matchId, matchName: opponent ? `vs ${opponent.name}` : 'League Match', date: m.matchDate || '', batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false }, bowling: { wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, wides: 0, noBalls: 0 }, fielding: { catches: 0, stumpings: 0, runOuts: 0 } };
      }
      const log = logs[matchId];
      if (d.strikerPlayerId === playerId) {
        log.batting.runs += d.runsScored || 0; if (d.extraType !== 'wide') log.batting.ballsFaced += 1;
        if (d.runsScored === 4) log.batting.fours += 1; if (d.runsScored === 6) log.batting.sixes += 1;
      }
      if (d.isWicket && d.batsmanOutPlayerId === playerId) log.batting.out = true;
      if ((d.bowlerId || d.bowlerPlayerId) === playerId) {
        log.bowling.runsConceded += d.totalRunsOnDelivery || 0; if (d.extraType !== 'wide' && d.extraType !== 'noball') log.bowling.ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') log.bowling.wickets += 1;
        if (d.extraType === 'wide') log.bowling.wides += 1;
        if (d.extraType === 'noball') log.bowling.noBalls += 1;
      }
      if (d.fielderPlayerId === playerId) {
        if (d.dismissalType === 'caught') log.fielding.catches += 1;
        if (d.dismissalType === 'stumped') log.fielding.stumpings += 1;
        if (d.dismissalType === 'runout') log.fielding.runOuts += 1;
      }
    });
    return Object.values(logs).map(log => ({ ...log, totalCVP: calculatePlayerCVP({ ...log.batting, ...log.bowling, ...log.fielding, id: player.id, name: player.name }) })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allDeliveries, allMatches, player, allTeams, isMounted, playerId, activeMatchIds]);

  const historyStats = useMemo(() => {
    const stats = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, maidens: 0, wides: 0, noBalls: 0, catches: 0, stumpings: 0, runOuts: 0, careerCVP: 0, matchesPlayed: 0, inningsBatted: 0, inningsBowled: 0, highestScore: 0, totalDucks: 0, hundreds: 0, fifties: 0, forties: 0, thirties: 0, twenties: 0, tens: 0, oneWkt: 0, twoWkts: 0, threeWkts: 0, fourWkts: 0, fiveWkts: 0, timesOut: 0, bestBowling: { wkts: 0, runs: 0, display: '0/0' } };
    matchWiseLog.forEach(log => {
      stats.runs += log.batting.runs; stats.ballsFaced += log.batting.ballsFaced; stats.fours += log.batting.fours; stats.sixes += log.batting.sixes;
      if (log.batting.ballsFaced > 0 || log.batting.out) stats.inningsBatted += 1;
      if (log.batting.out) stats.timesOut += 1;
      if (log.batting.runs > stats.highestScore) stats.highestScore = log.batting.runs;
      
      if (log.batting.runs >= 100) stats.hundreds += 1;
      else if (log.batting.runs >= 50) stats.fifties += 1;
      else if (log.batting.runs >= 40) stats.forties += 1;
      else if (log.batting.runs >= 30) stats.thirties += 1;
      else if (log.batting.runs >= 20) stats.twenties += 1;
      else if (log.batting.runs >= 10) stats.tens += 1;

      if (log.batting.runs === 0 && log.batting.out) stats.totalDucks += 1;
      stats.wickets += log.bowling.wickets; stats.ballsBowled += log.bowling.ballsBowled; stats.runsConceded += log.bowling.runsConceded; stats.maidens += log.bowling.maidens;
      stats.wides += log.bowling.wides; stats.noBalls += log.bowling.noBalls;
      if (log.bowling.ballsBowled > 0) stats.inningsBowled += 1;
      if (log.bowling.wickets >= 5) stats.fiveWkts += 1; else if (log.bowling.wickets === 4) stats.fourWkts += 1; else if (log.bowling.wickets === 3) stats.threeWkts += 1; else if (log.bowling.wickets === 2) stats.twoWkts += 1; else if (log.bowling.wickets === 1) stats.oneWkt += 1;
      if (log.bowling.wickets > stats.bestBowling.wkts || (log.bowling.wickets === stats.bestBowling.wkts && log.bowling.runsConceded < stats.bestBowling.runs)) { stats.bestBowling = { wkts: log.bowling.wickets, runs: log.bowling.runsConceded, display: `${log.bowling.wickets}/${log.bowling.runsConceded}` }; }
      stats.catches += log.fielding.catches; stats.stumpings += log.fielding.stumpings; stats.runOuts += log.fielding.runOuts; stats.careerCVP += log.totalCVP; stats.matchesPlayed += 1;
    });
    return stats;
  }, [matchWiseLog]);

  if (!isMounted || isPlayerLoading || isHistoryLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Career Data...</p></div>);
  if (!player) return <div className="p-20 text-center">Player record missing.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      <div className="bg-primary text-white p-4 pt-8 shadow-inner">
        <div className="flex items-center gap-4 mb-4"><Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white shrink-0"><ArrowLeft className="w-6 h-6"/></Button><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-black text-2xl tracking-tighter uppercase truncate">{player.name}</span>{isUmpire && <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="text-white/70 hover:text-white rounded-full h-8 w-8"><Edit2 className="w-4 h-4" /></Button>}</div><div className="flex items-center gap-2 mt-0.5 opacity-70"><Flag className="w-3 h-3" /><span className="text-[10px] font-black uppercase tracking-widest">{player.role}</span></div></div></div>
        <div className="flex items-end gap-6 pb-2"><div className="relative group/avatar"><Avatar className="w-24 h-24 border-4 border-white/20 rounded-2xl shadow-xl shrink-0 overflow-hidden"><AvatarImage src={player.imageUrl} className="object-cover" /><AvatarFallback className="text-3xl font-black bg-white/10 text-white/50">{player.name[0]}</AvatarFallback></Avatar></div><div className="flex-1 grid grid-cols-2 gap-2 mb-2"><div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center"><p className="text-[8px] font-black uppercase text-white/50">History CVP</p><p className="text-xl font-black">{historyStats.careerCVP.toFixed(1)}</p></div><div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center"><p className="text-[8px] font-black uppercase text-white/50">Matches</p><p className="text-xl font-black">{historyStats.matchesPlayed}</p></div></div></div>
      </div>
      <Tabs defaultValue="match log" className="w-full">
        <div className="bg-primary px-2 border-t border-white/10 sticky top-16 z-40 shadow-md"><TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">{['Match Log', 'Career Stats'].map((tab) => (<TabsTrigger key={tab} value={tab.toLowerCase()} className="text-white/60 font-black data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-6 h-full uppercase text-[11px] tracking-widest whitespace-nowrap">{tab}</TabsTrigger>))}</TabsList></div>
        <TabsContent value="match log" className="p-0">
          <div className="overflow-x-auto scrollbar-hide">
            <Table className="min-w-max w-full">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase">Match/Date</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Wkts</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Total CVP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchWiseLog.map((log) => (
                  <TableRow key={log.matchId} className="hover:bg-slate-50">
                    <TableCell className="py-3">
                      <p className="text-[10px] font-black truncate max-w-[120px]">{log.matchName}</p>
                      <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase"><Calendar className="w-2.5 h-2.5" />{log.date ? new Date(log.date).toLocaleDateString() : '---'}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-[10px] text-slate-600">{log.batting.runs}</TableCell>
                    <TableCell className="text-right font-bold text-[10px] text-slate-600">{log.bowling.wickets}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary" className="font-black text-[10px] h-5">{log.totalCVP.toFixed(1)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="career stats" className="p-0"><Tabs defaultValue="batting" className="w-full"><div className="bg-slate-50 border-b"><TabsList className="bg-transparent h-10 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">{['Batting', 'Bowling', 'Fielding'].map((tab) => (<TabsTrigger key={tab} value={tab.toLowerCase()} className="text-slate-500 font-black data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 h-full uppercase text-[10px] tracking-widest">{tab}</TabsTrigger>))}</TabsList></div>
            <TabsContent value="batting" className="p-0">
              <Table>
                <TableBody>
                  {[
                    { label: 'Matches Played', value: historyStats.matchesPlayed },
                    { label: 'Innings Batted', value: historyStats.inningsBatted },
                    { label: 'Total Runs', value: historyStats.runs },
                    { label: 'Batting Average', value: historyStats.timesOut > 0 ? (historyStats.runs / historyStats.timesOut).toFixed(2) : (historyStats.runs > 0 ? historyStats.runs.toFixed(2) : '0.00') },
                    { label: 'Balls Faced', value: historyStats.ballsFaced },
                    { label: 'Highest Score', value: historyStats.highestScore },
                    { label: 'Strike Rate', value: historyStats.ballsFaced > 0 ? ((historyStats.runs / historyStats.ballsFaced) * 100).toFixed(2) : '0.00' },
                    { label: 'Fours / Sixes', value: `${historyStats.fours} / ${historyStats.sixes}` },
                    { label: '10s / 20s / 30s / 40s / 50s / 100s', value: `${historyStats.tens} / ${historyStats.twenties} / ${historyStats.thirties} / ${historyStats.forties} / ${historyStats.fifties} / ${historyStats.hundreds}` }
                  ].map((row, idx) => (
                    <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 pl-4 uppercase tracking-tighter">{row.label}</TableCell>
                      <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="bowling" className="p-0">
              <Table>
                <TableBody>
                  {[
                    { label: 'Matches Played', value: historyStats.matchesPlayed },
                    { label: 'Innings Bowled', value: historyStats.inningsBowled },
                    { label: 'Wickets', value: historyStats.wickets },
                    { label: 'Bowling Average', value: historyStats.wickets > 0 ? (historyStats.runsConceded / historyStats.wickets).toFixed(2) : '0.00' },
                    { label: 'Bowling Strike Rate', value: historyStats.wickets > 0 ? (historyStats.ballsBowled / historyStats.wickets).toFixed(2) : '0.00' },
                    { label: 'Runs Conceded', value: historyStats.runsConceded },
                    { label: 'Overs Bowled', value: `${Math.floor(historyStats.ballsBowled / 6)}.${historyStats.ballsBowled % 6}` },
                    { label: 'Best Bowling (BBF)', value: historyStats.bestBowling.display },
                    { label: 'Economy Rate', value: historyStats.ballsBowled >= 6 ? (historyStats.runsConceded / (historyStats.ballsBowled / 6)).toFixed(2) : '0.00' },
                    { label: '1w / 2w / 3w / 4w / 5w', value: `${historyStats.oneWkt} / ${historyStats.twoWkts} / ${historyStats.threeWkts} / ${historyStats.fourWkts} / ${historyStats.fiveWkts}` },
                    { label: 'Extras Conceded', value: `${historyStats.wides + historyStats.noBalls} (${historyStats.wides} WD & ${historyStats.noBalls} NB)` }
                  ].map((row, idx) => (
                    <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 pl-4 uppercase tracking-tighter">{row.label}</TableCell>
                      <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="fielding" className="p-0">
              <Table>
                <TableBody>
                  {[
                    { label: 'Catches', value: historyStats.catches },
                    { label: 'Stumpings', value: historyStats.stumpings },
                    { label: 'Run Outs', value: historyStats.runOuts }
                  ].map((row, idx) => (
                    <TableRow key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <TableCell className="text-[11px] font-black text-slate-400 py-3 pl-4 uppercase tracking-tighter">{row.label}</TableCell>
                      <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
