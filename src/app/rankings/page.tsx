
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, ChevronRight, Loader2, ArrowUp, ArrowDown, User, Star, Target, Zap, Shield, Hand } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type LeaderboardCategory = 'runs' | 'wickets' | 'avg' | 'sr' | 'econ' | 'catches' | 'runouts' | 'potm';

export default function RankingsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'cvp', direction: 'desc' });
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('runs');

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

  const allDeliveries = useMemo(() => {
    if (!rawDeliveries || !matches || matches.length === 0) return [];
    const validMatchIds = new Set(matches.map(m => m.id));
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && validMatchIds.has(matchId);
    });
  }, [rawDeliveries, matches]);

  const teamStandings = useMemo(() => {
    if (!teams || !matches) return [];
    const standings: Record<string, any> = {};
    
    teams.forEach(t => {
      standings[t.id] = { 
        id: t.id, 
        name: t.name, 
        logoUrl: t.logoUrl, 
        played: 0, won: 0, lost: 0, tied: 0, nr: 0, points: 0, 
        forR: 0, forB: 0, agR: 0, agB: 0,
        form: [] as ('W' | 'L' | 'T' | 'NR')[]
      };
    });

    const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

    sortedMatches.forEach(m => {
      if (m.status !== 'completed') return;
      const t1Id = m.team1Id; const t2Id = m.team2Id;
      if (!standings[t1Id] || !standings[t2Id]) return;
      
      standings[t1Id].played += 1; standings[t2Id].played += 1;
      const result = m.resultDescription?.toLowerCase() || '';
      const t1Name = standings[t1Id].name.toLowerCase();
      const t2Name = standings[t2Id].name.toLowerCase();

      if (result.includes(t1Name) && result.includes('won')) { 
        standings[t1Id].won += 1; standings[t1Id].points += 2; standings[t1Id].form.push('W');
        standings[t2Id].lost += 1; standings[t2Id].form.push('L');
      } else if (result.includes(t2Name) && result.includes('won')) { 
        standings[t2Id].won += 1; standings[t2Id].points += 2; standings[t2Id].form.push('W');
        standings[t1Id].lost += 1; standings[t1Id].form.push('L');
      } else if (result.includes('tied') || result.includes('drawn')) { 
        standings[t1Id].tied += 1; standings[t1Id].points += 1; standings[t1Id].form.push('T');
        standings[t2Id].tied += 1; standings[t2Id].points += 1; standings[t2Id].form.push('T');
      } else {
        standings[t1Id].nr += 1; standings[t1Id].points += 1; standings[t1Id].form.push('NR');
        standings[t2Id].nr += 1; standings[t2Id].points += 1; standings[t2Id].form.push('NR');
      }
    });

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      
      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingTeamId = battingTeamId === match.team1Id ? match.team2Id : match.team1Id;

      if (standings[battingTeamId]) {
        standings[battingTeamId].forR += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') standings[battingTeamId].forB += 1;
      }
      if (standings[bowlingTeamId]) {
        standings[bowlingTeamId].agR += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') standings[bowlingTeamId].agB += 1;
      }
    });

    return Object.values(standings).map((s: any) => {
      const forRR = s.forB > 0 ? (s.forR / (s.forB / 6)) : 0;
      const agRR = s.agB > 0 ? (s.agR / (s.agB / 6)) : 0;
      return { ...s, nrr: forRR - agRR };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return b.nrr - a.nrr;
    });
  }, [teams, matches, allDeliveries]);

  const topPlayers = useMemo(() => {
    if (!players || !matches) return [];
    const pMatchStats: Record<string, Record<string, any>> = {};
    const careerTotals: Record<string, any> = {};

    players.forEach(p => {
      careerTotals[p.id] = { id: p.id, name: p.name, runs: 0, wickets: 0, cvp: 0, matches: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, catches: 0, runouts: 0, potm: 0, outs: 0 };
    });

    const activeMatchIds = new Set(matches.map(m => m.id));

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;

      const sId = d.strikerPlayerId; 
      const bId = d.bowlerId || d.bowlerPlayerId;
      const fId = d.fielderPlayerId; 

      const involvedIds = [sId, bId, fId].filter(id => id && id !== 'none');
      involvedIds.forEach(pid => {
        if (!careerTotals[pid]) return;
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId]) {
          pMatchStats[pid][matchId] = { id: pid, runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, runOuts: 0, out: false };
          careerTotals[pid].matches += 1;
        }
      });

      if (careerTotals[sId]) {
        pMatchStats[sId][matchId].runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') pMatchStats[sId][matchId].ballsFaced += 1;
        careerTotals[sId].runs += (d.runsScored || 0);
        careerTotals[sId].ballsFaced += (d.extraType !== 'wide' ? 1 : 0);
      }

      if (bId && careerTotals[bId]) {
        pMatchStats[bId][matchId].runsConceded += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') pMatchStats[bId][matchId].ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') {
          pMatchStats[bId][matchId].wickets += 1;
          careerTotals[bId].wickets += 1;
        }
        careerTotals[bId].runsConceded += (d.totalRunsOnDelivery || 0);
        careerTotals[bId].ballsBowled += (d.extraType !== 'wide' && d.extraType !== 'noball' ? 1 : 0);
      }

      if (fId && careerTotals[fId]) {
        if (d.dismissalType === 'caught') {
          pMatchStats[fId][matchId].catches += 1;
          careerTotals[fId].catches += 1;
        }
        if (d.dismissalType === 'runout') {
          pMatchStats[fId][matchId].runOuts += 1;
          careerTotals[fId].runouts += 1;
        }
      }

      if (d.isWicket && d.batsmanOutPlayerId && careerTotals[d.batsmanOutPlayerId]) {
        pMatchStats[d.batsmanOutPlayerId][matchId].out = true;
        careerTotals[d.batsmanOutPlayerId].outs += 1;
      }
    });

    matches.forEach(m => {
      if (m.status === 'completed' && m.potmPlayerId && careerTotals[m.potmPlayerId]) {
        careerTotals[m.potmPlayerId].potm += 1;
      }
    });

    return players.map(p => {
      const stats = careerTotals[p.id];
      const matchHistory = pMatchStats[p.id] || {};
      let totalCvp = 0;
      Object.values(matchHistory).forEach(ms => {
        totalCvp += calculatePlayerCVP(ms as any);
      });

      return { 
        ...stats, 
        cvp: totalCvp,
        avg: stats.outs > 0 ? (stats.runs / stats.outs) : (stats.runs > 0 ? stats.runs : 0),
        sr: stats.ballsFaced > 0 ? (stats.runs / stats.ballsFaced) * 100 : 0,
        econ: stats.ballsBowled >= 6 ? (stats.runsConceded / (stats.ballsBowled / 6)) : 0
      };
    }).sort((a: any, b: any) => {
      const key = activeCategory === 'avg' ? 'avg' : 
                  activeCategory === 'sr' ? 'sr' : 
                  activeCategory === 'econ' ? 'econ' :
                  activeCategory === 'catches' ? 'catches' :
                  activeCategory === 'runouts' ? 'runouts' :
                  activeCategory === 'potm' ? 'potm' :
                  activeCategory === 'wickets' ? 'wickets' : 'runs';
      
      const valA = a[key] || 0;
      const valB = b[key] || 0;
      
      if (activeCategory === 'econ') return valA - valB; // Lower econ is better
      return valB - valA;
    });
  }, [players, matches, allDeliveries, activeCategory]);

  const requestSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortConfig.key !== field) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 px-1 md:px-4">
      <div>
        <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900 uppercase">League Rankings</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Professional Series Standings</p>
      </div>

      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-11 bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="teams" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Points Table</TabsTrigger>
          <TabsTrigger value="players" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Player Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="teams">
          <Card className="bg-white border shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <Table className="min-w-max w-full">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="w-12 text-[10px] font-bold uppercase text-slate-500 text-center">Pos</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500">Teams</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500 underline underline-offset-4">M</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">W</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">L</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">T</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">N/R</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500 underline underline-offset-4">PTS</TableHead>
                    <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">NRR</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 pl-6">Series Form</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStandings.map((team, idx) => (
                    <TableRow key={team.id} className={cn("hover:bg-slate-50 transition-colors border-b", idx === 0 ? "bg-sky-50/50" : "")}>
                      <TableCell className="text-center font-black text-xs text-slate-400 py-4">{idx + 1}</TableCell>
                      <TableCell className="py-4">
                        <Link href={`/teams/${team.id}`} className="flex items-center gap-3 group">
                          <Avatar className="h-6 w-6 rounded-none border-none">
                            <AvatarImage src={team.logoUrl} className="object-contain" />
                            <AvatarFallback className="bg-slate-100 text-[10px]">{team.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-black text-slate-800 text-xs uppercase tracking-tight group-hover:text-primary transition-colors">{team.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.played}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.won}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.lost}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.tied}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-600">{team.nr}</TableCell>
                      <TableCell className="text-center text-xs font-black text-slate-900">{team.points}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-500">{(team.nrr || 0).toFixed(3)}</TableCell>
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-1.5">
                          {team.form.slice(-5).map((res, fIdx) => (
                            <div key={fIdx} className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm border border-white/20", res === 'W' ? "bg-emerald-500" : res === 'L' ? "bg-rose-500" : "bg-slate-400")}>{res}</div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'runs', label: 'Most Runs', icon: Zap },
              { id: 'wickets', label: 'Most Wickets', icon: Target },
              { id: 'avg', label: 'Best Average', icon: User },
              { id: 'sr', label: 'Best SR', icon: Zap },
              { id: 'econ', label: 'Best Econ', icon: Shield },
              { id: 'catches', label: 'Most Catches', icon: Hand },
              { id: 'runouts', label: 'Most Run Outs', icon: Hand },
              { id: 'potm', label: 'Most POTM', icon: Star },
            ].map(cat => (
              <Button 
                key={cat.id} 
                size="sm" 
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat.id as any)}
                className="font-black text-[9px] uppercase tracking-widest h-8"
              >
                <cat.icon className="w-3 h-3 mr-1" /> {cat.label}
              </Button>
            ))}
          </div>

          {isDeliveriesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Career Statistics...</p>
            </div>
          ) : (
            <Card className="shadow-sm border rounded-xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b py-3 px-4">
                <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">
                  {activeCategory.toUpperCase()} LEADERBOARD
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto scrollbar-hide">
                <Table className="min-w-max w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-12 text-[10px] font-black uppercase">Rank</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Player</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase">Matches</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">
                        {activeCategory === 'runs' ? 'Runs' : 
                         activeCategory === 'wickets' ? 'Wickets' :
                         activeCategory === 'avg' ? 'Average' :
                         activeCategory === 'sr' ? 'Strike Rate' :
                         activeCategory === 'econ' ? 'Economy' :
                         activeCategory === 'catches' ? 'Catches' :
                         activeCategory === 'runouts' ? 'Run Outs' : 'Awards'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPlayers.map((player, idx) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-black text-xs text-slate-400">{idx + 1}</TableCell>
                        <TableCell>
                          <Link href={`/players/${player.id}`} className="font-black text-primary hover:underline text-xs flex items-center gap-2 uppercase tracking-tighter">
                            {player.name} <ChevronRight className="w-3 h-3 text-slate-300" />
                          </Link>
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs text-slate-500">{player.matches}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-black text-xs px-3">
                            {activeCategory === 'runs' ? player.runs : 
                             activeCategory === 'wickets' ? player.wickets :
                             activeCategory === 'avg' ? player.avg.toFixed(2) :
                             activeCategory === 'sr' ? player.sr.toFixed(2) :
                             activeCategory === 'econ' ? player.econ.toFixed(2) :
                             activeCategory === 'catches' ? player.catches :
                             activeCategory === 'runouts' ? player.runouts : player.potm}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
