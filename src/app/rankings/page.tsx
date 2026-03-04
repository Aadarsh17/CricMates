
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, ChevronRight, UserCircle, Loader2, ArrowUp, ArrowDown, TrendingUp, BarChart3 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { cn } from '@/lib/utils';

export default function RankingsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'runs' | 'wickets' | 'cvp', direction: 'asc' | 'desc' }>({ key: 'cvp', direction: 'desc' });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const allDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(allDeliveriesQuery);

  const playerToTeam = useMemo(() => {
    const map: Record<string, string> = {};
    if (!players) return map;
    players.forEach(p => {
      if (p.teamId) map[p.id] = p.teamId;
    });
    return map;
  }, [players]);

  const allDeliveries = useMemo(() => {
    if (!rawDeliveries || !matches || matches.length === 0) return [];
    const validMatchIds = new Set(matches.map(m => m.id));
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && validMatchIds.has(matchId);
    });
  }, [rawDeliveries, matches]);

  const teamStandings = useMemo(() => {
    if (!teams) return [];
    const standings: Record<string, any> = {};
    const nrrCalc: Record<string, { runsScored: number, oversFaced: number, runsConceded: number, oversBowled: number }> = {};
    teams.forEach(t => {
      standings[t.id] = { id: t.id, name: t.name, logoUrl: t.logoUrl, played: 0, won: 0, lost: 0, drawn: 0, points: 0, nrr: 0 };
      nrrCalc[t.id] = { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 };
    });
    const matchInnings: Record<string, { runs: number, balls: number, wickets: number, battingTeamId: string, matchId: string }> = {};
    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const innId = d.__fullPath?.split('/')[3];
      const key = `${matchId}_${innId}`;
      if (matchId && innId) {
        if (!matchInnings[key]) {
          matchInnings[key] = { runs: 0, balls: 0, wickets: 0, battingTeamId: playerToTeam[d.strikerPlayerId] || '', matchId: matchId };
        }
        matchInnings[key].runs += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') matchInnings[key].balls += 1;
        if (d.isWicket) matchInnings[key].wickets += 1;
      }
    });
    Object.values(matchInnings).forEach(mi => {
      const match = matches?.find(m => m.id === mi.matchId);
      if (!match || !mi.battingTeamId) return;
      const oversUsed = (mi.wickets >= 10) ? match.totalOvers : (mi.balls / 6);
      const battingTeamId = mi.battingTeamId;
      const opponentId = match.team1Id === battingTeamId ? match.team2Id : match.team1Id;
      if (nrrCalc[battingTeamId]) { nrrCalc[battingTeamId].runsScored += mi.runs; nrrCalc[battingTeamId].oversFaced += oversUsed; }
      if (nrrCalc[opponentId]) { nrrCalc[opponentId].runsConceded += mi.runs; nrrCalc[opponentId].oversBowled += oversUsed; }
    });
    if (matches) {
      matches.filter(m => m.status === 'completed').forEach(m => {
        const t1Id = m.team1Id; const t2Id = m.team2Id;
        if (!standings[t1Id] || !standings[t2Id]) return;
        standings[t1Id].played += 1; standings[t2Id].played += 1;
        const result = m.resultDescription?.toLowerCase() || '';
        const t1Name = standings[t1Id].name.toLowerCase();
        const t2Name = standings[t2Id].name.toLowerCase();
        if (result.includes(t1Name) && result.includes('won')) { standings[t1Id].won += 1; standings[t1Id].points += 2; standings[t2Id].lost += 1; }
        else if (result.includes(t2Name) && result.includes('won')) { standings[t2Id].won += 1; standings[t2Id].points += 2; standings[t1Id].lost += 1; }
        else if (result.includes('tied') || result.includes('drawn')) { standings[t1Id].drawn += 1; standings[t1Id].points += 1; standings[t2Id].drawn += 1; standings[t2Id].points += 1; }
      });
    }
    teams.forEach(t => {
      const nc = nrrCalc[t.id];
      if (nc) {
        const forRR = nc.oversFaced > 0 ? nc.runsScored / nc.oversFaced : 0;
        const againstRR = nc.oversBowled > 0 ? nc.runsConceded / nc.oversBowled : 0;
        standings[t.id].nrr = forRR - againstRR;
      }
    });
    return Object.values(standings).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return b.nrr - a.nrr;
    });
  }, [teams, matches, allDeliveries, playerToTeam]);

  const topPlayers = useMemo(() => {
    if (!players) return [];
    const pStats: Record<string, any> = {};
    players.forEach(p => {
      pStats[p.id] = { id: p.id, name: p.name, role: p.role, imageUrl: p.imageUrl, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, matchCount: 0, cvp: 0, matchesSeen: new Set<string>() };
    });
    allDeliveries.forEach(d => {
      const sId = d.strikerPlayerId; 
      const bId = d.bowlerId || d.bowlerPlayerId; // Unify field name
      const fId = d.fielderPlayerId; 
      const matchId = d.__fullPath?.split('/')[1];
      
      if (pStats[sId]) { 
        pStats[sId].runs += (d.runsScored || 0); 
        if (d.extraType !== 'wide') pStats[sId].ballsFaced += 1; 
        if (d.runsScored === 4) pStats[sId].fours += 1; 
        if (d.runsScored === 6) pStats[sId].sixes += 1; 
        if (matchId) pStats[sId].matchesSeen.add(matchId); 
      }
      if (bId && pStats[bId]) { 
        pStats[bId].runsConceded += (d.totalRunsOnDelivery || 0); 
        if (d.extraType !== 'wide' && d.extraType !== 'noball') pStats[bId].ballsBowled += 1; 
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') pStats[bId].wickets += 1; 
        if (matchId) pStats[bId].matchesSeen.add(matchId); 
      }
      if (fId && pStats[fId]) { 
        if (d.dismissalType === 'caught') pStats[fId].catches += 1; 
        if (d.dismissalType === 'stumped') pStats[fId].stumpings += 1; 
        if (d.dismissalType === 'runout') pStats[fId].runOuts += 1; 
      }
    });
    return Object.values(pStats).map((ps: any) => {
      ps.matchCount = ps.matchesSeen.size;
      ps.cvp = calculatePlayerCVP(ps as any);
      return ps;
    }).sort((a: any, b: any) => {
      const valA = a[sortConfig.key] || 0;
      const valB = b[sortConfig.key] || 0;
      return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
    });
  }, [players, allDeliveries, sortConfig]);

  const requestSort = (key: 'runs' | 'wickets' | 'cvp') => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const SortIcon = ({ field }: { field: 'runs' | 'wickets' | 'cvp' }) => {
    if (sortConfig.key !== field) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 px-4">
      <div>
        <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900 uppercase">League Rankings</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Validated Historical Match Analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Team Net Run Rate</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamStandings}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={8} tick={{ fill: '#94a3b8' }} />
                <YAxis fontSize={8} tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                <Bar dataKey="nrr">
                  {teamStandings.map((entry, index) => (
                    <Cell key={`cell-nrr-${index}`} fill={entry.nrr >= 0 ? 'hsl(var(--secondary))' : 'hsl(var(--destructive))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Player MVP Distribution</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPlayers.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={8} tick={{ fill: '#94a3b8' }} />
                <YAxis fontSize={8} tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                <Bar dataKey="cvp" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-11 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="players" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Player Stats</TabsTrigger>
          <TabsTrigger value="teams" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Points Table</TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="mt-6">
          {isDeliveriesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Career Statistics...</p>
            </div>
          ) : (
            <Card className="shadow-sm border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Player</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase cursor-pointer" onClick={() => requestSort('runs')}>Runs <SortIcon field="runs" /></TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase cursor-pointer" onClick={() => requestSort('wickets')}>Wkts <SortIcon field="wickets" /></TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase cursor-pointer" onClick={() => requestSort('cvp')}>CVP <SortIcon field="cvp" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPlayers.map((player, idx) => (
                    <TableRow key={`rank-row-${player.id}-${idx}`}>
                      <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <Link href={`/players/${player.id}`} className="font-black text-primary hover:underline text-xs flex items-center gap-2 uppercase tracking-tighter">
                          {player.name} <ChevronRight className="w-3 h-3 text-slate-300" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-black text-xs">{player.runs}</TableCell>
                      <TableCell className="text-right font-black text-xs">{player.wickets}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline" className="font-black text-[10px]">{player.cvp.toFixed(1)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <Card className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-[10px] font-black uppercase text-center">Rank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Team</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">P</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">W</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">PTS</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase pr-8">NRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStandings.map((team, idx) => (
                  <TableRow key={`team-row-${team.id}-${idx}`}>
                    <TableCell className="text-center font-black text-xs text-slate-400 py-4">{idx + 1}</TableCell>
                    <TableCell className="py-4">
                      <Link href={`/teams/${team.id}`} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 rounded-lg border"><AvatarImage src={team.logoUrl} /><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar>
                        <span className="font-black text-primary hover:underline text-xs uppercase tracking-tighter">{team.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center text-xs font-black">{team.played}</TableCell>
                    <TableCell className="text-center text-xs font-black">{team.won}</TableCell>
                    <TableCell className="text-center text-xs font-black">{team.points}</TableCell>
                    <TableCell className="text-right text-xs font-black pr-8">
                      <Badge variant={(team.nrr || 0) >= 0 ? 'secondary' : 'outline'} className="font-black text-[10px]">
                        {(team.nrr || 0) >= 0 ? '+' : ''}{(team.nrr || 0).toFixed(3)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
