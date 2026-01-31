'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import type { Team, Player, Match, Inning, DeliveryRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isWicketKeeper?: boolean;
  battingStyle?: string;
  bowlingStyle?: string;
}

interface AppContextType {
  addTeam: (name: string) => Promise<void>;
  editTeam: (teamId: string, name: string) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  addPlayer: (playerData: PlayerData) => Promise<void>;
  editPlayer: (playerId: string, playerData: PlayerData) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  addMatch: (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; team1PlayerIds: string[]; team2PlayerIds: string[]; team1CaptainId: string, team2CaptainId: string }) => Promise<string>;
  recordDelivery: (match: Match, teams: Team[], players: Player[], outcome: { runs: number, isWicket: boolean, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null, outcome: string, wicketDetails?: { batsmanOutId: string; dismissalType: string; newBatsmanId?: string; fielderId?: string; } }) => Promise<void>;
  setPlayerInMatch: (match: Match, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => Promise<void>;
  swapStrikers: (match: Match) => Promise<void>;
  undoDelivery: (match: Match) => Promise<void>;
  retireStriker: (match: Match) => Promise<void>;
  forceEndInning: (match: Match, teams: Team[], players: Player[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { firestore: db } = useFirebase();

  const handleInningEnd = useCallback((match: Match, teams: Team[], players: Player[]): Match => {
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];

    const battingTeamPlayers = players.filter(p => (updatedMatch.team1PlayerIds?.includes(p.id) && updatedMatch.team1Id === inning.battingTeamId) || (updatedMatch.team2PlayerIds?.includes(p.id) && updatedMatch.team2Id === inning.battingTeamId));
    const numberOfPlayers = battingTeamPlayers.length > 0 ? battingTeamPlayers.length : 11;
    const allOutWickets = numberOfPlayers - 1;

    let inningIsOver = false;
    if (inning.wickets >= allOutWickets || inning.overs >= updatedMatch.overs) {
        inningIsOver = true;
    }

    if (updatedMatch.currentInning === 2 && updatedMatch.innings.length > 1 && updatedMatch.innings[0].score < inning.score) {
        inningIsOver = true;
    }

    if (inningIsOver) {
        if (updatedMatch.currentInning === 1) {
            const nextBattingTeamId = updatedMatch.team1Id === inning.battingTeamId ? updatedMatch.team2Id : updatedMatch.team1Id;
            const nextBowlingTeamId = inning.battingTeamId;
            updatedMatch.innings.push({
                battingTeamId: nextBattingTeamId,
                bowlingTeamId: nextBowlingTeamId,
                score: 0,
                wickets: 0,
                overs: 0,
                strikerId: null,
                nonStrikerId: null,
                bowlerId: null,
                deliveryHistory: [],
            });
            updatedMatch.currentInning = 2;
        } else {
            updatedMatch.status = 'completed';
            const firstInning = updatedMatch.innings[0];
            const secondInning = updatedMatch.innings[1];
            const firstInningTeam = teams.find(t => t.id === firstInning.battingTeamId);
            const secondInningTeam = teams.find(t => t.id === secondInning.battingTeamId);

            if (!firstInningTeam || !secondInningTeam) {
                updatedMatch.result = "Result could not be determined."
            }
            else if (secondInning.score > firstInning.score) {
                const secondInningBattingTeamPlayers = players.filter(p => (updatedMatch.team1PlayerIds?.includes(p.id) && updatedMatch.team1Id === secondInning.battingTeamId) || (updatedMatch.team2PlayerIds?.includes(p.id) && updatedMatch.team2Id === secondInning.battingTeamId));
                const numberOfPlayersInSecondTeam = secondInningBattingTeamPlayers.length > 0 ? secondInningBattingTeamPlayers.length : 11;
                const wicketsRemaining = numberOfPlayersInSecondTeam - 1 - secondInning.wickets;
                updatedMatch.result = `${secondInningTeam?.name} won by ${wicketsRemaining} wickets.`;
            } else if (firstInning.score > secondInning.score) {
                updatedMatch.result = `${firstInningTeam?.name} won by ${firstInning.score - secondInning.score} runs.`;
            } else {
                updatedMatch.result = "Match is a Tie.";
            }
        }
    }
    return updatedMatch;
  }, []);


  const addTeam = useCallback(async (name: string) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }
    const newTeam: Omit<Team, 'id'> = {
      name,
      logoUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/128/128`,
      imageHint: 'logo abstract',
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
    };
    try {
      await addDoc(collection(db, 'teams'), newTeam);
      toast({ title: "Team Added", description: `${name} has been added successfully.` });
    } catch(e: any) {
        console.error("Failed to add team:", e);
        toast({ variant: "destructive", title: "Error Adding Team", description: "Could not add the team. Please check your connection and try again." });
    }
  }, [db, toast]);

  const editTeam = useCallback(async (teamId: string, name: string) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }
    try {
      await updateDoc(doc(db, 'teams', teamId), { name });
      toast({ title: "Team Updated", description: "Team name has been updated." });
    } catch (e: any) {
        console.error("Failed to edit team:", e);
        toast({ variant: "destructive", title: "Error Editing Team", description: "Could not update the team. Please try again." });
    }
  }, [db, toast]);

  const deleteTeam = useCallback(async (teamId: string) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }
    try {
      await deleteDoc(doc(db, 'teams', teamId));
      toast({ title: "Team Deleted", description: "The team has been deleted." });
    } catch (e: any) {
        console.error("Failed to delete team:", e);
        toast({ variant: "destructive", title: "Error Deleting Team", description: "Could not delete the team. Please try again." });
    }
  }, [db, toast]);
  
  const addPlayer = useCallback(async (playerData: PlayerData) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }

    const newPlayer: Omit<Player, 'id'> = {
      name: playerData.name,
      role: playerData.role,
      battingStyle: playerData.battingStyle,
      bowlingStyle: playerData.bowlingStyle === 'None' ? null : playerData.bowlingStyle,
      isWicketKeeper: playerData.isWicketKeeper || false,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    
    try {
      await addDoc(collection(db, 'players'), newPlayer);
      toast({ title: "Player Added", description: `${playerData.name} has been added.` });
    } catch (e: any) {
        console.error("Failed to add player:", e);
        toast({ variant: "destructive", title: "Error Adding Player", description: "Could not add the player. Please try again." });
    }
  }, [db, toast]);

  const editPlayer = useCallback(async (playerId: string, playerData: PlayerData) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }

    const dataToUpdate = {
        ...playerData,
        bowlingStyle: playerData.bowlingStyle === 'None' ? null : playerData.bowlingStyle,
    };
    
    try {
      await updateDoc(doc(db, 'players', playerId), dataToUpdate);
      toast({ title: "Player Updated", description: "Player details have been updated." });
    } catch (e: any) {
      console.error("Failed to edit player:", e);
      toast({ variant: "destructive", title: "Error Editing Player", description: "Could not update the player. Please try again." });
    }
  }, [db, toast]);

  const deletePlayer = useCallback(async (playerId: string) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }
    try {
      await deleteDoc(doc(db, 'players', playerId));
      toast({ title: "Player Deleted", description: "The player has been deleted." });
    } catch(e: any) {
      console.error("Failed to delete player:", e);
      toast({ variant: "destructive", title: "Error Deleting Player", description: "Could not delete the player. Please try again." });
    }
  }, [db, toast]);

  const addMatch = useCallback(async (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; team1PlayerIds: string[]; team2PlayerIds: string[]; team1CaptainId: string, team2CaptainId: string }) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return '';
    }
    const { team1Id, team2Id, overs, tossWinnerId, tossDecision, team1PlayerIds, team2PlayerIds, team1CaptainId, team2CaptainId } = matchConfig;
    
    const otherTeamId = tossWinnerId === team1Id ? team2Id : team1Id;
    const battingTeamId = tossDecision === 'bat' ? tossWinnerId : otherTeamId;
    const bowlingTeamId = tossDecision === 'bowl' ? tossWinnerId : otherTeamId;

    const newMatch: Omit<Match, 'id'> = {
      team1Id,
      team2Id,
      team1PlayerIds,
      team2PlayerIds,
      team1CaptainId,
      team2CaptainId,
      overs,
      status: 'live',
      tossWinnerId,
      tossDecision,
      innings: [{
        battingTeamId: battingTeamId,
        bowlingTeamId: bowlingTeamId,
        score: 0,
        wickets: 0,
        overs: 0,
        strikerId: null,
        nonStrikerId: null,
        bowlerId: null,
        deliveryHistory: [],
      }],
      currentInning: 1,
      date: new Date().toISOString(),
    };
    
    try {
      const docRef = await addDoc(collection(db, 'matches'), newMatch);
      toast({ title: "Match Started!", description: "The match has been created successfully." });
      return docRef.id;
    } catch (e: any) {
        console.error("Failed to add match:", e);
        toast({ variant: "destructive", title: "Error Creating Match", description: "Could not create the match. Please try again." });
        return '';
    }
  }, [db, toast]);

  const updateMatch = useCallback(async (matchId: string, updatedMatchData: Partial<Match>) => {
      if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again." });
        return;
      }
      try {
          await updateDoc(doc(db, 'matches', matchId), updatedMatchData);
      } catch (e: any) {
          console.error("Failed to update match:", e);
          toast({ variant: "destructive", title: "Error Updating Match", description: "Could not save match progress. Please try again." });
      }
  }, [db, toast]);

  const swapStrikers = useCallback(async (match: Match) => {
    if (!match) return;
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    const temp = inning.strikerId;
    inning.strikerId = inning.nonStrikerId;
    inning.nonStrikerId = temp;
    await updateMatch(match.id, updatedMatch);
  }, [updateMatch]);

  const setPlayerInMatch = useCallback(async (match: Match, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => {
    if (!match) return;
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];

    if ((role === 'striker' || role === 'nonStriker') && inning.retiredHurtPlayerIds?.includes(playerId)) {
      inning.retiredHurtPlayerIds = inning.retiredHurtPlayerIds.filter((id: string) => id !== playerId);
      toast({ title: "Player Resuming", description: "The retired batsman is returning to bat." });
    }

    if (role === 'striker') inning.strikerId = playerId;
    if (role === 'nonStriker') inning.nonStrikerId = playerId;
    if (role === 'bowler') inning.bowlerId = playerId;
    await updateMatch(match.id, updatedMatch);
  }, [updateMatch, toast]);
  
  const retireStriker = useCallback(async (match: Match) => {
    if (!match || match.status !== 'live') return;
    
    let updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    
    if (!inning.strikerId) {
        toast({ variant: "destructive", title: "Striker not selected!"});
        return;
    }
    
    if (!inning.retiredHurtPlayerIds) {
      inning.retiredHurtPlayerIds = [];
    }
    if (!inning.retiredHurtPlayerIds.includes(inning.strikerId)) {
      inning.retiredHurtPlayerIds.push(inning.strikerId);
    }
    
    inning.strikerId = null;
    
    toast({ title: "Player Retired Hurt", description: "The batsman can return to bat later." });
    await updateMatch(match.id, updatedMatch);
  }, [updateMatch, toast]);

  const undoDelivery = useCallback(async (match: Match) => {
    if (!match) return;

    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    
    if (inning.deliveryHistory.length === 0) {
        toast({ variant: 'destructive', title: 'No deliveries to undo.'});
        return;
    }

    const lastDelivery = inning.deliveryHistory.pop();

    let newScore = 0;
    let newWickets = 0;
    let newOvers = 0;
    
    inning.strikerId = lastDelivery.strikerId;
    inning.nonStrikerId = lastDelivery.nonStrikerId;
    inning.bowlerId = lastDelivery.bowlerId;

    inning.deliveryHistory.forEach((delivery: DeliveryRecord) => {
       newScore += delivery.runs;
        if (delivery.extra === 'wide' || delivery.extra === 'noball') {
          newScore += 1;
        }
        if (delivery.isWicket) newWickets += 1;

        const isLegalDelivery = delivery.extra !== 'wide' && delivery.extra !== 'noball';
        if (isLegalDelivery) {
            const currentOverInt = Math.floor(newOvers);
            const currentBalls = Math.round((newOvers % 1) * 10);
            if (currentBalls === 5) {
                newOvers = currentOverInt + 1;
            } else {
                newOvers = parseFloat((currentOverInt + (currentBalls + 1) / 10).toFixed(1));
            }
        }
    });

    inning.score = newScore;
    inning.wickets = newWickets;
    inning.overs = newOvers;

    await updateMatch(match.id, updatedMatch);
  }, [updateMatch, toast]);

  const recordDelivery = useCallback(async (match: Match, teams: Team[], players: Player[], outcome: { runs: number; isWicket: boolean; extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null; outcome: string; wicketDetails?: { batsmanOutId: string; dismissalType: string; newBatsmanId?: string; fielderId?: string; }}) => {
    if (!match || match.status !== 'live') return;

    let updatedMatch = JSON.parse(JSON.stringify(match)); 
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    
    if (!inning.strikerId || !inning.nonStrikerId || !inning.bowlerId) {
        toast({ variant: "destructive", title: "Players not set!", description: "Please select a striker, non-striker, and bowler."});
        return;
    }

    const deliveryRecord: DeliveryRecord = { 
      strikerId: inning.strikerId,
      nonStrikerId: inning.nonStrikerId,
      bowlerId: inning.bowlerId,
      runs: outcome.runs,
      isWicket: outcome.isWicket,
      extra: outcome.extra,
      outcome: outcome.isWicket ? outcome.wicketDetails!.dismissalType : outcome.outcome,
      dismissal: outcome.isWicket ? {
          type: outcome.wicketDetails!.dismissalType,
          batsmanOutId: outcome.wicketDetails!.batsmanOutId,
          fielderId: outcome.wicketDetails!.fielderId
      } : undefined,
      timestamp: Date.now() 
    };
    inning.deliveryHistory.push(deliveryRecord);

    inning.score += outcome.runs;
    if(outcome.extra === 'wide' || outcome.extra === 'noball'){
        inning.score += 1;
    }
    
    const isLegalDelivery = outcome.extra !== 'wide' && outcome.extra !== 'noball';

    if (isLegalDelivery) {
        const currentOverInt = Math.floor(inning.overs);
        const currentBalls = Math.round((inning.overs % 1) * 10);
        
        if (currentBalls === 5) {
            inning.overs = currentOverInt + 1;
            const temp = inning.strikerId;
            inning.strikerId = inning.nonStrikerId;
            inning.nonStrikerId = temp;
            inning.bowlerId = null;
        } else {
            inning.overs = parseFloat((currentOverInt + (currentBalls + 1) / 10).toFixed(1));
        }
    }
    
    if (outcome.isWicket) {
        inning.wickets += 1;
        const { batsmanOutId, newBatsmanId } = outcome.wicketDetails!;
        
        if (inning.strikerId === batsmanOutId) {
            inning.strikerId = newBatsmanId || null;
        } else if (inning.nonStrikerId === batsmanOutId) {
            inning.nonStrikerId = newBatsmanId || null;
        }
    }

    const runsConsideredForStrikerSwap = (outcome.extra === 'byes' || outcome.extra === 'legbyes') ? 0 : outcome.runs;
    if (isLegalDelivery && (runsConsideredForStrikerSwap % 2 !== 0) && !outcome.isWicket) {
        const temp = inning.strikerId;
        inning.strikerId = inning.nonStrikerId;
        inning.nonStrikerId = temp;
    }

    updatedMatch = handleInningEnd(updatedMatch, teams, players);
    await updateMatch(match.id, updatedMatch);
  }, [handleInningEnd, updateMatch, toast]);

  const forceEndInning = useCallback(async (match: Match, teams: Team[], players: Player[]) => {
    if (!match || match.status !== 'live') return;

    let updatedMatch = JSON.parse(JSON.stringify(match));

    if (updatedMatch.currentInning === 1) {
        const currentInning = updatedMatch.innings[0];
        const nextBattingTeamId = updatedMatch.team1Id === currentInning.battingTeamId ? updatedMatch.team2Id : updatedMatch.team1Id;
        const nextBowlingTeamId = currentInning.battingTeamId;
        updatedMatch.innings.push({
            battingTeamId: nextBattingTeamId,
            bowlingTeamId: nextBowlingTeamId,
            score: 0,
            wickets: 0,
            overs: 0,
            strikerId: null,
            nonStrikerId: null,
            bowlerId: null,
            deliveryHistory: [],
        });
        updatedMatch.currentInning = 2;
        toast({ title: "Inning Ended Manually", description: "The first inning has been concluded. Starting second inning." });
    } else { 
        updatedMatch = handleInningEnd({...updatedMatch, status: 'completed'}, teams, players); // Force completion check
        toast({ title: "Match Ended", description: `Match has been manually concluded. ${updatedMatch.result}` });
    }
    await updateMatch(match.id, updatedMatch);
  }, [handleInningEnd, updateMatch, toast]);

  const value: AppContextType = useMemo(() => ({
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      addMatch,
      recordDelivery,
      setPlayerInMatch,
      swapStrikers,
      undoDelivery,
      retireStriker,
      forceEndInning,
  }), [
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      addMatch,
      recordDelivery,
      setPlayerInMatch,
      swapStrikers,
      undoDelivery,
      retireStriker,
      forceEndInning
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
