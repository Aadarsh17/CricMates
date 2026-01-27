'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Team, Player, Match, Inning, DeliveryRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
  battingStyle?: string;
  bowlingStyle?: string;
}

interface AppContextType {
  loading: {
    teams: boolean;
    players: boolean;
  };
  teams: Team[];
  players: Player[];
  addTeam: (name: string) => Promise<void>;
  editTeam: (teamId: string, name: string) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  addPlayer: (teamId: string, playerData: PlayerData) => Promise<void>;
  editPlayer: (playerId: string, playerData: PlayerData) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  getPlayerCountForTeam: (teamId: string) => number;
  getTeamById: (teamId: string) => Team | undefined;
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayersByTeamId: (teamId: string) => Player[];
  addMatch: (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => Promise<string>;
  recordDelivery: (match: Match, outcome: { runs: number, isWicket: boolean, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null, outcome: string }) => Promise<void>;
  setPlayerInMatch: (match: Match, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => Promise<void>;
  swapStrikers: (match: Match) => Promise<void>;
  undoDelivery: (match: Match) => Promise<void>;
  retireStriker: (match: Match) => Promise<void>;
  forceEndInning: (match: Match) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { firestore: db } = useFirebase();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);

  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  
  const teams = teamsData || [];
  const players = playersData || [];

  const loading = {
      teams: teamsLoading,
      players: playersLoading,
  };

  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const handleInningEnd = useCallback((match: Match): Match => {
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];

    const battingTeamPlayers = playersRef.current.filter(p => p.teamId === inning.battingTeamId);
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
            const firstInningTeam = teamsRef.current.find(t => t.id === firstInning.battingTeamId);
            const secondInningTeam = teamsRef.current.find(t => t.id === secondInning.battingTeamId);

            if (!firstInningTeam || !secondInningTeam) {
                updatedMatch.result = "Result could not be determined."
            }
            else if (secondInning.score > firstInning.score) {
                const secondInningBattingTeamPlayers = playersRef.current.filter(p => p.teamId === secondInning.battingTeamId);
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
      const batch = writeBatch(db);
      batch.delete(doc(db, 'teams', teamId));
      const teamPlayers = playersRef.current.filter(p => p.teamId === teamId);
      teamPlayers.forEach(p => {
          batch.delete(doc(db, 'players', p.id));
      });
      await batch.commit();
      toast({ title: "Team Deleted", description: "The team and its players have been deleted." });
    } catch (e: any) {
        console.error("Failed to delete team:", e);
        toast({ variant: "destructive", title: "Error Deleting Team", description: "Could not delete the team. Please try again." });
    }
  }, [db, toast]);
  
  const addPlayer = useCallback(async (teamId: string, playerData: PlayerData) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return;
    }
    const batch = writeBatch(db);
    const newPlayerRef = doc(collection(db, 'players'));

    const newPlayer: Omit<Player, 'id'> = {
      teamId: teamId,
      name: playerData.name,
      role: playerData.role,
      battingStyle: playerData.battingStyle,
      bowlingStyle: playerData.bowlingStyle === 'None' ? undefined : playerData.bowlingStyle,
      isCaptain: playerData.isCaptain || false,
      isWicketKeeper: playerData.isWicketKeeper || false,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    
    if (newPlayer.isCaptain) {
        const currentCaptain = playersRef.current.find(p => p.teamId === teamId && p.isCaptain);
        if (currentCaptain) {
            batch.update(doc(db, 'players', currentCaptain.id), { isCaptain: false });
        }
    }

    batch.set(newPlayerRef, newPlayer);
    try {
      await batch.commit();
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
    const playerToEdit = playersRef.current.find(p => p.id === playerId);
    if (!playerToEdit) {
        toast({ variant: "destructive", title: "Error", description: "Player not found." });
        return;
    };

    const batch = writeBatch(db);
    const dataToUpdate = {
        ...playerData,
        bowlingStyle: playerData.bowlingStyle === 'None' ? undefined : playerData.bowlingStyle,
    };
    batch.update(doc(db, 'players', playerId), dataToUpdate);

    if (playerData.isCaptain) {
        const currentCaptain = playersRef.current.find(p => p.teamId === playerToEdit.teamId && p.isCaptain && p.id !== playerId);
        if (currentCaptain) {
            batch.update(doc(db, 'players', currentCaptain.id), { isCaptain: false });
        }
    }
    try {
      await batch.commit();
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

  const getPlayerCountForTeam = useCallback((teamId: string) => {
    return players.filter(p => p.teamId === teamId).length;
  }, [players]);
  
  const getTeamById = useCallback((teamId: string) => {
    return teams.find(t => t.id === teamId);
  }, [teams]);

  const getPlayerById = useCallback((playerId: string) => {
    return players.find(p => p.id === playerId);
  }, [players]);

  const getPlayersByTeamId = useCallback((teamId: string) => {
    return players.filter(p => p.teamId === teamId);
  }, [players]);

  const addMatch = useCallback(async (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => {
    if (!db) {
        toast({ variant: "destructive", title: "Database Error", description: "Database not available. Please try again later." });
        return '';
    }
    const { team1Id, team2Id, overs, tossWinnerId, tossDecision } = matchConfig;
    
    const otherTeamId = tossWinnerId === team1Id ? team2Id : team1Id;
    const battingTeamId = tossDecision === 'bat' ? tossWinnerId : otherTeamId;
    const bowlingTeamId = tossDecision === 'bowl' ? tossWinnerId : otherTeamId;

    const newMatch: Omit<Match, 'id'> = {
      team1Id,
      team2Id,
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
    if (role === 'striker') inning.strikerId = playerId;
    if (role === 'nonStriker') inning.nonStrikerId = playerId;
    if (role === 'bowler') inning.bowlerId = playerId;
    await updateMatch(match.id, updatedMatch);
  }, [updateMatch]);
  
  const retireStriker = useCallback(async (match: Match) => {
    if (!match || match.status !== 'live') return;
    
    let updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    
    if (!inning.strikerId) {
        toast({ variant: "destructive", title: "Striker not selected!"});
        return;
    }
    
    const deliveryRecord: DeliveryRecord = { 
        runs: 0, 
        isWicket: true, 
        extra: null, 
        outcome: `Retired`,
        strikerId: inning.strikerId,
        nonStrikerId: inning.nonStrikerId,
        bowlerId: inning.bowlerId || '',
        timestamp: Date.now() 
    };
    inning.deliveryHistory.push(deliveryRecord);
    inning.wickets += 1;
    inning.strikerId = null;
    
    updatedMatch = handleInningEnd(updatedMatch);
    await updateMatch(match.id, updatedMatch);
  }, [handleInningEnd, updateMatch, toast]);

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

  const recordDelivery = useCallback(async (match: Match, outcome: { runs: number; isWicket: boolean; extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null; outcome: string }) => {
    if (!match || match.status !== 'live') return;

    let updatedMatch = JSON.parse(JSON.stringify(match)); 
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
    
    if (!inning.strikerId || !inning.nonStrikerId || !inning.bowlerId) {
        toast({ variant: "destructive", title: "Players not set!", description: "Please select a striker, non-striker, and bowler."});
        return;
    }

    const deliveryRecord: DeliveryRecord = { 
      ...outcome, 
      strikerId: inning.strikerId,
      nonStrikerId: inning.nonStrikerId,
      bowlerId: inning.bowlerId,
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
        inning.strikerId = null; // New batsman needed
    }

    const runsConsideredForStrikerSwap = (outcome.extra === 'byes' || outcome.extra === 'legbyes') ? 0 : outcome.runs;
    if (isLegalDelivery && (runsConsideredForStrikerSwap % 2 !== 0)) {
        const temp = inning.strikerId;
        inning.strikerId = inning.nonStrikerId;
        inning.nonStrikerId = temp;
    }

    updatedMatch = handleInningEnd(updatedMatch);
    await updateMatch(match.id, updatedMatch);
  }, [handleInningEnd, updateMatch, toast]);

  const forceEndInning = useCallback(async (match: Match) => {
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
        updatedMatch = handleInningEnd({...updatedMatch, status: 'completed'}); // Force completion check
        toast({ title: "Match Ended", description: `Match has been manually concluded. ${updatedMatch.result}` });
    }
    await updateMatch(match.id, updatedMatch);
  }, [handleInningEnd, updateMatch, toast]);

  const value: AppContextType = useMemo(() => ({
      loading,
      teams,
      players,
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      getPlayerCountForTeam,
      getTeamById,
      getPlayerById,
      getPlayersByTeamId,
      addMatch,
      recordDelivery,
      setPlayerInMatch,
      swapStrikers,
      undoDelivery,
      retireStriker,
      forceEndInning,
  }), [
      loading,
      teams,
      players,
      addTeam,
      editTeam,
      deleteTeam,
      addPlayer,
      editPlayer,
      deletePlayer,
      getPlayerCountForTeam,
      getTeamById,
      getPlayerById,
      getPlayersByTeamId,
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
