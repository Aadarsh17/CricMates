
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, Loader2, Edit2, Camera, Users, Scale, ShieldCheck, X, Zap, Target, Medal, Clock, History as HistoryIcon, UserMinus, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { cn, formatTeamName } from '@/lib/utils';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';

export default function TeamDetailsPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teamLogoInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const teamRef = useMemoFirebase(() => teamId ? doc(db, 'teams', teamId) : null, [db, teamId]);
  const { data: team, isLoading: isTeamLoading } = useDoc(teamRef);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers, isLoading: isAllPlayersLoading } = useCollection(allPlayersQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches, isLoading: isMatchesLoading } = useCollection(allMatchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);
  const completedMatchIds = useMemo(() => new Set(allMatches?.filter(m => m.status === 'completed').map(m => m.id) || []), [allMatches]);

  const squadData = useMemo(() => {
    if (!allPlayers || !allMatches || !teamId) return { active: [], legacy: [] };
    
    const participationIds = new Set<string>();
    allMatches.forEach(m => {
      if (m.team1Id === teamId || m.team2Id === teamId) {
        const squad = m.team1Id === teamId ? m.team1SquadPlayerIds : m.team2SquadPlayerIds;
        squad?.forEach((id: string) => participationIds.add(id));
      }
    });

    const registered = allPlayers.filter(p => p.teamId === teamId || (participationIds.has(p.id) && !p.teamId));
    const registeredIds = new Set(registered.map(p => p.id));
    const legacy = allPlayers.filter(p => participationIds.has(p.id) && !registeredIds.has(p.id));
    
    return { 
      active: registered.sort((a,b) => a.name.localeCompare(b.name)), 
      legacy: legacy.sort((a,b) => a.name.localeCompare(b.name)) 
    };
  }, [allPlayers, allMatches, teamId]);

  const squadStats = useMemo(() => {
    if (!allPlayers || !allMatches || !rawDeliveries || !teamId) return {};
    const stats: Record<string, any> = {};
    const pMatchStats: Record<string, Record<string, any>> = {};

    allPlayers.forEach(p => { 
      stats[p.id] = { 
        id: p.id, runs: 0, wickets: 0, cvp: 0, matches: 0, 
        batInn: 0, bowlInn: 0, fours: 0, sixes: 0, 
        ballsFaced: 0, ballsBowled: 0, runsConceded: 0 
      };
    });

    allMatches?.forEach(m => {
      if (!activeMatchIds.has(m.id)) return;
      const isTeam1 = m.team1Id === teamId;
      const isTeam2 = m.team2Id === teamId;
      if (!isTeam1 && !isTeam2) return;
      const teamSquad = isTeam1 ? m.team1SquadPlayerIds : m.team2SquadPlayerIds;
      teamSquad?.forEach((pid: string) => { if (stats[pid]) stats[pid].matches++; });
    });

    rawDeliveries?.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;

      const match = allMatches?.find(m => m.id === matchId);
      if (!match) return;

      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingTeamId = battingTeamId === teamId ? (battingTeamId === match.team1Id ? match.team2Id : match.team1Id) : teamId;

      if (battingTeamId === teamId) {
        const sId = d.strikerPlayerId;
        const nsId = d.nonStrikerPlayerId;
        
        [sId, nsId].forEach(pid => {
          if (pid && stats[pid]) {
            if (!pMatchStats[pid]) pMatchStats[pid] = {};
            if (!pMatchStats[pid][matchId]) {
              pMatchStats[pid][matchId] = { id: pid, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, hasBatted: false, hasBowled: false };
            }
            if (!pMatchStats[pid][matchId].hasBatted) {
              pMatchStats[pid][matchId].hasBatted = true;
              stats[pid].batInn++;
            }
          }
        });

        if (sId && stats[sId]) {
          const s = pMatchStats[sId][matchId];
          s.runs += (d.runsScored || 0);
          stats[sId].runs += (d.runsScored || 0);
          if (d.extraType !== 'wide') {
            s.ballsFaced++;
            stats[sId].ballsFaced++;
          }
          if (d.runsScored === 4) { s.fours++; stats[sId].fours++; }
          if (d.runsScored === 6) { s.sixes++; stats[sId].sixes++; }
        }
      }

      if (bowlingTeamId === teamId) {
        const bId = d.bowlerId || d.bowlerPlayerId;
        if (bId && stats[bId]) {
          if (!pMatchStats[bId]) pMatchStats[bId] = {};
          if (!pMatchStats[bId][matchId]) {
            pMatchStats[bId][matchId] = { id: bId, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, hasBatted: false, hasBowled: false };
          }
          if (!pMatchStats[bId][matchId].hasBowled) {
            pMatchStats[bId][matchId].hasBowled = true;
            stats[bId].bowlInn++;
          }
          const b = pMatchStats[bId][matchId];
          b.runsConceded += (d.totalRunsOnDelivery || 0);
          stats[bId].runsConceded += (d.totalRunsOnDelivery || 0);
          if (d.extraType === 'none') {
            b.ballsBowled++;
            stats[bId].ballsBowled++;
          }
          if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
            b.wickets++;
            stats[bId].wickets++;
          }
        }
        
        const fId = d.fielderPlayerId;
        if (fId && fId !== 'none' && stats[fId]) {
          if (!pMatchStats[fId]) pMatchStats[fId] = {};
          if (!pMatchStats[fId][matchId]) pMatchStats[fId][matchId] = { id: fId, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, hasBatted: false, hasBowled: false };
          const f = pMatchStats[fId][matchId];
          if (d.dismissalType === 'caught') f.catches++;
          if (d.dismissalType === 'stumped') f.stumpings++;
          if (d.dismissalType === 'runout') f.runOuts++;
        }
      }
    });

    Object.keys(stats).forEach(id => {
      let totalCvp = 0;
      Object.values(pMatchStats[id] || {}).forEach(mS => { totalCvp += calculatePlayerCVP(mS as any); });
      stats[id].cvp = totalCvp;
    });
    return stats;
  }, [allPlayers, allMatches, rawDeliveries, teamId, activeMatchIds]);

  const standingsForThisTeam = useMemo(() => {
    if (!teamId || !allMatches || !allMatches.length) return { played: 0, won: 0, lost: 0, drawn: 0, nrr: 0 };
    let forR = 0, forB = 0, agR = 0, agB = 0;
    let played = 0, won = 0, lost = 0, drawn = 0;
    
    allMatches.forEach(m => {
      if (m.status !== 'completed' || !activeMatchIds.has(m.id) || (m.team1Id !== teamId && m.team2Id !== teamId)) return;
      played++;
      if (m.isTie) drawn++;
      else if (m.winnerTeamId === teamId) won++;
      else if (m.winnerTeamId && m.winnerTeamId !== 'none') lost++;
    });

    if (played === 0) return { played: 0, won: 0, lost: 0, drawn: 0, nrr: 0 };

    rawDeliveries?.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !completedMatchIds.has(matchId)) return;
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;
      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingTeamId = battingTeamId === teamId ? (battingTeamId === match.team1Id ? match.team2Id : match.team1Id) : teamId;
      if (battingTeamId === teamId) { forR += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none' && d.dismissalType !== 'retired') forB++; }
      if (bowlingTeamId === teamId && battingTeamId !== teamId) { agR += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none' && d.dismissalType !== 'retired') agB++; }
    });

    const forRR = forB > 0 ? (forR / (forB / 6)) : 0;
    const agRR = agB > 0 ? (agR / (agB / 6)) : 0;
    return { played, won, lost, drawn, nrr: forRR - agRR };
  }, [allMatches, teamId, rawDeliveries, activeMatchIds, completedMatchIds]);

  const teamHonors = useMemo(() => {
    const allKnown = [...squadData.active, ...squadData.legacy];
    if (allKnown.length === 0) return null;

    const statsArray = allKnown.map(p => {
      const s = squadStats[p.id] || { runs: 0, wickets: 0, cvp: 0, fours: 0, sixes: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0 };
      const sr = s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : 0;
      const er = s.ballsBowled > 0 ? (s.runsConceded / (s.ballsBowled / 6)) : 99;
      return { ...s, name: p.name, sr, er };
    });

    const topScorer = [...statsArray].sort((a,b) => b.runs - a.runs || b.sr - a.sr)[0];
    const topWkt = [...statsArray].sort((a,b) => b.wickets - a.wickets || a.er - b.er)[0];
    const mvp = [...statsArray].sort((a,b) => b.cvp - a.cvp)[0];
    const top4s = [...statsArray].sort((a,b) => b.fours - a.fours || b.sr - a.sr)[0];
    const top6s = [...statsArray].sort((a,b) => b.sixes - a.sixes || b.sr - a.sr)[0];

    if (!topScorer || (topScorer.runs === 0 && topWkt.wickets === 0)) return null;
    
    return { topScorer, topWkt, mvp, top4s, top6s };
  }, [squadData, squadStats]);

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman' });
  const [teamForm, setTeamForm] = useState({ name: '', logoUrl: '', captainId: '', viceCaptainId: '', wicketKeeperId: '' });
  const [editForm, setEditForm] = useState({ name: '', role: 'Batsman', imageUrl: '', battingStyle: 'Right Handed Bat', isWicketKeeper: false });

  const defaultAvatar = PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl || '';
  const defaultTeamLogo = PlaceHolderImages.find(img => img.id === 'team-logo')?.imageUrl || '';

  useEffect(() => { if (team) { setTeamForm({ name: team.name, logoUrl: team.logoUrl || '', captainId: team.captainId || '', viceCaptainId: team.viceCaptainId || '', wicketKeeperId: team.wicketKeeperId || '' }); } }, [team]);

  const handleUpdateTeam = () => { if (!teamId || !teamForm.name.trim()) return; updateDocumentNonBlocking(doc(db, 'teams', teamId), { name: teamForm.name, logoUrl: teamForm.logoUrl, captainId: teamForm.captainId === 'none' ? '' : teamForm.captainId, viceCaptainId: teamForm.viceCaptainId === 'none' ? '' : teamForm.viceCaptainId, wicketKeeperId: teamForm.wicketKeeperId === 'none' ? '' : teamForm.wicketKeeperId }); setIsEditTeamOpen(false); toast({ title: "Franchise Updated" }); };
  const handleAddPlayer = () => { if (!user || !newPlayer.name.trim()) return; const pid = doc(collection(db, 'players')).id; const pData = { id: pid, name: newPlayer.name, teamId, ownerId: user.uid, role: newPlayer.role, battingStyle: 'Right Handed Bat', isWicketKeeper: false, isRetired: false, matchesPlayed: 0, runsScored: 0, wicketsTaken: 0, highestScore: 0, bestBowlingFigures: '0/0', careerCVP: 0, imageUrl: '' }; setDocumentNonBlocking(doc(db, 'players', pid), pData, { merge: true }); setIsAddPlayerOpen(false); setNewPlayer({ name: '', role: 'Batsman' }); toast({ title: "Player Added" }); };
  const openEditDialog = (p: any) => { setEditingPlayerId(p.id); setEditForm({ name: p.name, role: p.role, imageUrl: p.imageUrl || '', battingStyle: p.battingStyle || 'Right Handed Bat', isWicketKeeper: !!p.isWicketKeeper }); setIsEditOpen(true); };
  const handleUpdatePlayer = () => { if (editingPlayerId) updateDocumentNonBlocking(doc(db, 'players', editingPlayerId), editForm); setIsEditOpen(false); toast({ title: "Profile Updated" }); };
  
  const handleReleasePlayer = (p: any) => {
    if (!confirm(`Release ${p.name} from ${team?.name}?`)) return;
    updateDocumentNonBlocking(doc(db, 'players', p.id), { teamId: '' });
    const teamUpdates: any = {};
    if (team?.captainId === p.id) teamUpdates.captainId = '';
    if (team?.viceCaptainId === p.id) teamUpdates.viceCaptainId = '';
    if (team?.wicketKeeperId === p.id) teamUpdates.wicketKeeperId = '';
    if (Object.keys(teamUpdates).length > 0) updateDocumentNonBlocking(doc(db, 'teams', teamId), teamUpdates);
    toast({ title: "Released" });
  };

  const handleReinstatePlayer = (p: any) => {
    if (!confirm(`Reinstate ${p.name} to ${team?.name}?`)) return;
    updateDocumentNonBlocking(doc(db, 'players', p.id), { teamId: teamId });
    toast({ title: "Reinstated" });
  };

  const handleDeletePlayer = (p: any) => {
    if (!confirm(`Permanently delete ${p.name}?`)) return;
    deleteDocumentNonBlocking(doc(db, 'players', p.id));
    const teamUpdates: any = {};
    if (team?.captainId === p.id) teamUpdates.captainId = '';
    if (team?.viceCaptainId === p.id) teamUpdates.viceCaptainId = '';
    if (team?.wicketKeeperId === p.id) teamUpdates.wicketKeeperId = '';
    if (Object.keys(teamUpdates).length > 0) updateDocumentNonBlocking(doc(db, 'teams', teamId), teamUpdates);
    toast({ title: "Deleted" });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'player' | 'team') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 200;
          let width = img.width;
          let height = img.height;
          if (width > height) { if (width > size) { height *= size / width; width = size; } }
          else { if (height > size) { width *= size / height; height = size; } }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (target === 'player') setEditForm(prev => ({ ...prev, imageUrl: dataUrl }));
          else setTeamForm(prev => ({ ...prev, logoUrl: dataUrl }));
          toast({ title: "Photo Ready" });
        };
      };
    }
  };

  if (!isMounted || isTeamLoading || isDeliveriesLoading || isMatchesLoading || isAllPlayersLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Team Dashboard...</p></div>);

  return (
    <div className="space-y-10 pb-32 px-1 md:px-4 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/teams')} className="rounded-full"><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-16 h-16 border-4 border-primary rounded-2xl shadow-lg"><AvatarImage src={team?.logoUrl || defaultTeamLogo} className="object-cover" /><AvatarFallback className="bg-primary text-white font-black text-2xl">{team?.name[0]}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-4xl font-black truncate uppercase tracking-tighter">{team ? formatTeamName(team.name) : 'Team'}</h1>
            {isUmpire && <Button variant="ghost" size="icon" onClick={() => setIsEditTeamOpen(true)} className="h-8 w-8 text-slate-300 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>}
          </div>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Official Franchise Control</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[ 
          { label: 'Wins', value: standingsForThisTeam.won, icon: Trophy, color: 'text-secondary' }, 
          { label: 'Losses', value: standingsForThisTeam.lost, icon: Activity, color: 'text-destructive' }, 
          { label: 'Tied/NR', value: standingsForThisTeam.drawn, icon: Scale, color: 'text-amber-500' }, 
          { label: 'NRR', value: (standingsForThisTeam.nrr || 0).toFixed(3), icon: HistoryIcon, color: 'text-primary' }, 
          { label: 'Matches', value: standingsForThisTeam.played, icon: Users, color: 'text-slate-600' } 
        ].map((stat, i) => (
          <Card key={i} className="shadow-xl border-none overflow-hidden hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-slate-50 rounded-xl"><stat.icon className={cn("w-5 h-5", stat.color)}/></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p><p className="text-xl font-black">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teamHonors && (
        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Medal className="w-6 h-6 text-amber-500" /> Season Honours</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {teamHonors.topScorer.runs > 0 && (
              <Card className="border-none shadow-lg bg-white overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-amber-50 p-2 rounded-xl group-hover:rotate-12 transition-transform shrink-0"><Zap className="w-5 h-5 text-amber-500" /></div>
                  <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Top Scorer</p><p className="font-black text-[10px] uppercase truncate">{teamHonors.topScorer.name}</p><p className="text-xs font-black text-primary">{teamHonors.topScorer.runs} R</p></div>
                </CardContent>
              </Card>
            )}
            {teamHonors.topWkt.wickets > 0 && (
              <Card className="border-none shadow-lg bg-white overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl group-hover:rotate-12 transition-transform shrink-0"><Target className="w-5 h-5 text-primary" /></div>
                  <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Wicket King</p><p className="font-black text-[10px] uppercase truncate">{teamHonors.topWkt.name}</p><p className="text-xs font-black text-secondary">{teamHonors.topWkt.wickets} W</p></div>
                </CardContent>
              </Card>
            )}
            {teamHonors.mvp.cvp > 0 && (
              <Card className="border-none shadow-lg bg-white overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-secondary/10 p-2 rounded-xl group-hover:rotate-12 transition-transform shrink-0"><ShieldCheck className="w-5 h-5 text-secondary" /></div>
                  <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">MVP</p><p className="font-black text-[10px] uppercase truncate">{teamHonors.mvp.name}</p><p className="text-xs font-black text-emerald-600">{teamHonors.mvp.cvp.toFixed(1)} P</p></div>
                </CardContent>
              </Card>
            )}
            {teamHonors.top4s.fours > 0 && (
              <Card className="border-none shadow-lg bg-white overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-orange-50 p-2 rounded-xl group-hover:rotate-12 transition-transform shrink-0"><Zap className="w-5 h-5 text-orange-500" /></div>
                  <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Boundary King</p><p className="font-black text-[10px] uppercase truncate">{teamHonors.top4s.name}</p><p className="text-xs font-black text-orange-600">{teamHonors.top4s.fours}x4</p></div>
                </CardContent>
              </Card>
            )}
            {teamHonors.top6s.sixes > 0 && (
              <Card className="border-none shadow-lg bg-white overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-indigo-50 p-2 rounded-xl group-hover:rotate-12 transition-transform shrink-0"><Zap className="w-5 h-5 text-indigo-500" /></div>
                  <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Six Machine</p><p className="font-black text-[10px] uppercase truncate">{teamHonors.top6s.name}</p><p className="text-xs font-black text-indigo-600">{teamHonors.top6s.sixes}x6</p></div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="current" className="font-black text-[10px] uppercase">Active Squad</TabsTrigger>
          <TabsTrigger value="history" className="font-black text-[10px] uppercase">Legacy Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          <div className="flex justify-between items-center gap-4 px-2">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> Squad Control</h2>
            {isUmpire && (
              <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
                <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 font-black uppercase text-[10px] h-10 px-6"><UserPlus className="mr-2 h-4 w-4"/> Registry</Button></DialogTrigger>
                <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
                  <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Official Registration</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Full Name</Label><Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Role</Label><Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent></Select></div>
                  </div>
                  <DialogFooter><Button onClick={handleAddPlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl bg-primary">Commit Player</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {squadData.active.length > 0 ? squadData.active.map(player => (
              <PlayerStatCard 
                key={player.id} 
                player={player} 
                stats={squadStats[player.id]} 
                team={team} 
                isUmpire={isUmpire} 
                onEdit={() => openEditDialog(player)} 
                onRelease={() => handleReleasePlayer(player)} 
                onDelete={() => handleDeletePlayer(player)} 
              />
            )) : (<div className="col-span-full py-12 border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center text-center"><Users className="w-10 h-10 text-slate-200 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No active members found</p></div>)}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="px-2">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Clock className="w-6 h-6 text-slate-400" /> Historic Representatives</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Players who represented the team in the past</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {squadData.legacy.length > 0 ? squadData.legacy.map(player => (
              <PlayerStatCard 
                key={player.id} 
                player={player} 
                stats={squadStats[player.id]} 
                isLegacy 
                isUmpire={isUmpire} 
                onReinstate={() => handleReinstatePlayer(player)} 
                onDelete={() => handleDeletePlayer(player)} 
              />
            )) : (<div className="col-span-full py-12 border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center text-center"><Clock className="w-10 h-10 text-slate-200 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry clean</p></div>)}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Franchise Details</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => teamLogoInputRef.current?.click()}>
                <Avatar className="w-28 h-28 border-4 border-white shadow-xl rounded-2xl overflow-hidden ring-4 ring-slate-100">
                  <AvatarImage src={teamForm.logoUrl || defaultTeamLogo} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white font-black text-4xl font-black">{teamForm.name?.[0] || 'T'}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center text-white text-center">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[8px] font-black uppercase">Change Logo</span>
                </div>
                <input type="file" ref={teamLogoInputRef} onChange={(e) => handleFileChange(e, 'team')} className="hidden" accept="image/*" />
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Franchise Name</Label><Input value={teamForm.name} onChange={(e) => setTeamForm({...teamForm, name: e.target.value})} className="font-bold h-12" /></div>
            <div className="space-y-4 pt-2 border-t">
              <p className="text-[10px] font-black uppercase text-slate-500">Leadership</p>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Official Captain</Label><Select value={teamForm.captainId || 'none'} onValueChange={(v) => setTeamForm({...teamForm, captainId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign Leader" /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]">{squadData.active.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Vice-Captain</Label><Select value={teamForm.viceCaptainId || 'none'} onValueChange={(v) => setTeamForm({...teamForm, viceCaptainId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign VC" /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]">{squadData.active.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Wicket-Keeper</Label><Select value={teamForm.wicketKeeperId || 'none'} onValueChange={(v) => setTeamForm({...teamForm, wicketKeeperId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign WK" /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]">{squadData.active.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateTeam} className="w-full h-14 font-black uppercase tracking-widest shadow-xl bg-primary">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Player Profile</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="w-28 h-28 border-4 border-white shadow-xl rounded-3xl overflow-hidden ring-4 ring-slate-100"><AvatarImage src={editForm.imageUrl || defaultAvatar} className="object-cover" /><AvatarFallback className="bg-primary text-white text-4xl font-black">{editForm.name?.[0] || '?'}</AvatarFallback></Avatar>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center text-white"><Camera className="w-6 h-6 mb-1"/><span className="text-[8px] font-black uppercase">Change Photo</span></div>
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'player')} className="hidden" accept="image/*" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Official Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Role</Label><Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Batting Style</Label><Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="Right Handed Bat">RHB</SelectItem><SelectItem value="Left Handed Bat">LHB</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border"><Checkbox id="wk-edit" checked={editForm.isWicketKeeper} onCheckedChange={(c) => setEditForm({...editForm, isWicketKeeper: !!c})} /><Label htmlFor="wk-edit" className="text-xs font-black uppercase">Wicket Keeper</Label></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl bg-primary">Commit Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayerStatCard({ player, stats, team, isUmpire, onEdit, onRelease, onDelete, onReinstate, isLegacy }: { player: any, stats: any, team?: any, isUmpire?: boolean, onEdit?: () => void, onRelease?: () => void, onDelete?: () => void, onReinstate?: () => void, isLegacy?: boolean }) {
  const isCaptain = player.id === team?.captainId;
  const isVC = player.id === team?.viceCaptainId;
  const isWK = player.id === team?.wicketKeeperId;
  const defaultAvatar = PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl || '';
  const s = stats || { runs: 0, wickets: 0, cvp: 0, matches: 0, batInn: 0, bowlInn: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0 };
  
  const strikeRate = s.ballsFaced > 0 ? ((s.runs / s.ballsFaced) * 100).toFixed(1) : '0.0';
  const economy = s.ballsBowled > 0 ? (s.runsConceded / (s.ballsBowled / 6)).toFixed(2) : '0.00';

  return (
    <Card className={cn("border-l-8 shadow-lg hover:translate-y-[-2px] transition-all group rounded-2xl bg-white overflow-hidden", isLegacy ? "border-l-slate-200" : (isCaptain ? "border-l-amber-500" : isVC ? "border-l-slate-600" : "border-l-primary"))}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={cn("w-16 h-16 rounded-2xl shadow-md border-2 border-white overflow-hidden ring-4", isLegacy ? "ring-slate-50 opacity-60" : "ring-slate-50")}>
                <AvatarImage src={player.imageUrl || defaultAvatar} className="object-cover" />
                <AvatarFallback className="font-black text-slate-400 bg-slate-50">{player.name[0]}</AvatarFallback>
              </Avatar>
              {!isLegacy && isUmpire && (
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(); }} 
                  className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-lg border shadow-sm text-primary hover:scale-110 transition-transform z-10"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <Link href={`/players/${player.id}`} className="min-w-0">
              <p className={cn("font-black text-sm truncate max-w-[140px] uppercase tracking-tight transition-colors", isLegacy ? "text-slate-400" : "text-slate-900 group-hover:text-primary")}>{player.name} {!isLegacy && isCaptain && '(C)'} {!isLegacy && isVC && '(VC)'}</p>
              <div className="flex gap-1 items-center mt-1"><Badge variant="secondary" className={cn("text-[8px] font-black uppercase px-2 h-5 border-none", isLegacy ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>{player.role}</Badge>{!isLegacy && isWK && <Badge className="bg-secondary text-white text-[7px] font-black h-5 px-1.5">WK</Badge>}{isLegacy && <Badge variant="outline" className="text-[7px] font-black uppercase h-5 text-slate-300 border-slate-200">Ex-Player</Badge>}</div>
            </Link>
          </div>
          {isUmpire && (
            <div className="flex flex-col gap-1">
              {!isLegacy ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRelease?.(); }} 
                    className="h-8 w-8 text-slate-300 hover:text-amber-500"
                  >
                    <UserMinus className="w-4 h-4"/>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }} 
                    className="h-8 w-8 text-slate-200 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReinstate?.(); }} 
                    className="h-8 w-8 text-slate-300 hover:text-primary"
                  >
                    <UserPlus className="w-4 h-4"/>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }} 
                    className="h-8 w-8 text-slate-200 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Statistics Grid - Professional Dashboard */}
        <div className="mt-6 border-t pt-4 -mx-5 -mb-5 bg-slate-50/50 p-4 space-y-4">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">M</p><p className={cn("font-black text-xs", isLegacy ? "text-slate-400" : "text-slate-900")}>{s.matches}</p></div>
            <div className="flex flex-col items-center">
              <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Inn</p>
              <div className="flex flex-col -space-y-0.5">
                <span className={cn("text-[8px] font-black", isLegacy ? "text-slate-300" : "text-primary")}>B:{s.batInn}</span>
                <span className={cn("text-[8px] font-black", isLegacy ? "text-slate-300" : "text-secondary")}>W:{s.bowlInn}</span>
              </div>
            </div>
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">Impact</p><p className={cn("font-black text-xs text-primary")}>{s.cvp.toFixed(1)}</p></div>
          </div>
          
          <div className="grid grid-cols-4 gap-1 text-center border-t border-slate-200 pt-3">
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">Runs</p><p className={cn("font-black text-[11px]", isLegacy ? "text-slate-400" : "text-slate-900")}>{s.runs}</p></div>
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">SR</p><p className={cn("font-black text-[11px] text-primary")}>{strikeRate}</p></div>
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">Wkts</p><p className={cn("font-black text-[11px]", isLegacy ? "text-slate-400" : "text-slate-900")}>{s.wickets}</p></div>
            <div><p className="text-[7px] font-black text-slate-400 uppercase mb-1">Econ</p><p className={cn("font-black text-[11px] text-secondary")}>{economy}</p></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
