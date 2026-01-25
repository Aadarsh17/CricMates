'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import type { Team, Player, Match, Inning, DeliveryRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
}

interface AppContextType {
  loading: {
    teams: boolean;
    players: boolean;
    matches: boolean;
  };
  teams: Team[];
  players: Player[];
  matches: Match[];
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
  addMatch: (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => Promise<string | undefined>;
  getMatchById: (matchId: string) => Match | undefined;
  recordDelivery: (matchId: string, outcome: { runs: number, isWicket: boolean, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null, outcome: string }) => Promise<void>;
  setPlayerInMatch: (matchId: string, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => Promise<void>;
  swapStrikers: (matchId: string) => Promise<void>;
  undoDelivery: (matchId: string) => Promise<void>;
  retireStriker: (matchId: string) => Promise<void>;
  forceEndInning: (matchId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { db } = useFirebase();

  const { data: teams, loading: teamsLoading } = useCollection<Team>('teams');
  const { data: players, loading: playersLoading } = useCollection<Player>('players');
  const { data: matches, loading: matchesLoading } = useCollection<Match>('matches');
  
  const loading = {
      teams: teamsLoading,
      players: playersLoading,
      matches: matchesLoading
  };

  const handleInningEnd = async (match: Match): Promise<Match> => {
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const inning = updatedMatch.innings[updatedMatch.currentInning - 1];

    const battingTeamPlayers = players.filter(p => p.teamId === inning.battingTeamId);
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

            if (secondInning.score > firstInning.score) {
                const secondInningBattingTeamPlayers = players.filter(p => p.teamId === secondInning.battingTeamId);
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
  };


  const addTeam = async (name: string) => {
    const newTeam: Omit<Team, 'id'> = {
      name,
      logoUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/128/128`,
      imageHint: 'logo abstract',
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
    };
    await addDoc(collection(db, 'teams'), newTeam);
  };

  const editTeam = async (teamId: string, name: string) => {
    await updateDoc(doc(db, 'teams', teamId), { name });
  };

  const deleteTeam = async (teamId: string) => {
    const batch = writeBatch(db);
    // Delete the team
    batch.delete(doc(db, 'teams', teamId));
    // Delete all players in that team
    const teamPlayers = players.filter(p => p.teamId === teamId);
    teamPlayers.forEach(p => {
        batch.delete(doc(db, 'players', p.id));
    });
    await batch.commit();
  };
  
  const addPlayer = async (teamId: string, playerData: PlayerData) => {
    const batch = writeBatch(db);
    const newPlayerRef = doc(collection(db, 'players'));

    const newPlayer: Omit<Player, 'id'> = {
      teamId: teamId,
      name: playerData.name,
      role: playerData.role,
      isCaptain: playerData.isCaptain || false,
      isWicketKeeper: playerData.isWicketKeeper || false,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    
    if (newPlayer.isCaptain) {
        const currentCaptain = players.find(p => p.teamId === teamId && p.isCaptain);
        if (currentCaptain) {
            batch.update(doc(db, 'players', currentCaptain.id), { isCaptain: false });
        }
    }

    batch.set(newPlayerRef, newPlayer);
    await batch.commit();
  };

  const editPlayer = async (playerId: string, playerData: PlayerData) => {
    const playerToEdit = players.find(p => p.id === playerId);
    if (!playerToEdit) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'players', playerId), { ...playerData });

    if (playerData.isCaptain) {
        const currentCaptain = players.find(p => p.teamId === playerToEdit.teamId && p.isCaptain && p.id !== playerId);
        if (currentCaptain) {
            batch.update(doc(db, 'players', currentCaptain.id), { isCaptain: false });
        }
    }
    await batch.commit();
  };

  const deletePlayer = async (playerId: string) => {
    await deleteDoc(doc(db, 'players', playerId));
  };

  const getPlayerCountForTeam = (teamId: string) => {
    return players.filter(p => p.teamId === teamId).length;
  };
  
  const getTeamById = (teamId: string) => {
    return teams.find(t => t.id === teamId);
  }

  const getPlayerById = (playerId: string) => {
    return players.find(p => p.id === playerId);
  }

  const getPlayersByTeamId = (teamId: string) => {
    return players.filter(p => p.teamId === teamId);
  }

  const addMatch = async (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => {
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
    const docRef = await addDoc(collection(db, 'matches'), newMatch);
    return docRef.id;
  };

  const getMatchById = (matchId: string) => {
    return matches.find(m => m.id === matchId);
  }

  const swapStrikers = async (matchId: string) => {
      const match = getMatchById(matchId);
      if (!match) return;
      const updatedMatch = JSON.parse(JSON.stringify(match));
      const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
      const temp = inning.strikerId;
      inning.strikerId = inning.nonStrikerId;
      inning.nonStrikerId = temp;
      await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  }

  const setPlayerInMatch = async (matchId: string, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => {
      const match = getMatchById(matchId);
      if (!match) return;
      const updatedMatch = JSON.parse(JSON.stringify(match));
      const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
      if (role === 'striker') inning.strikerId = playerId;
      if (role === 'nonStriker') inning.nonStrikerId = playerId;
      if (role === 'bowler') inning.bowlerId = playerId;
      await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  }
  
  const retireStriker = async (matchId: string) => {
    const match = getMatchById(matchId);
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
    
    updatedMatch = await handleInningEnd(updatedMatch);
    await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  };

  const undoDelivery = async (matchId: string) => {
      const matchToUpdate = getMatchById(matchId);
      if (!matchToUpdate) return;

      const updatedMatch = JSON.parse(JSON.stringify(matchToUpdate));
      const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
      
      if (inning.deliveryHistory.length === 0) {
          toast({ variant: 'destructive', title: 'No deliveries to undo.'});
          return;
      }

      const lastDelivery = inning.deliveryHistory.pop();

      // This is a simplified recreation from history.
      // A more robust solution would be better but this is good for now.
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

      await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  }

  const recordDelivery = async (matchId: string, outcome: { runs: number; isWicket: boolean; extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null; outcome: string }) => {
    const match = getMatchById(matchId);
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

    updatedMatch = await handleInningEnd(updatedMatch);
    await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  };

  const forceEndInning = async (matchId: string) => {
    const match = getMatchById(matchId);
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
        updatedMatch.status = 'completed';
        const firstInning = updatedMatch.innings[0];
        const secondInning = updatedMatch.innings[1];
        const firstInningTeam = teams.find(t => t.id === firstInning.battingTeamId);
        const secondInningTeam = teams.find(t => t.id === secondInning.battingTeamId);

        if (secondInning.score > firstInning.score) {
            const secondInningBattingTeamPlayers = players.filter(p => p.teamId === secondInning.battingTeamId);
            const numberOfPlayersInSecondTeam = secondInningBattingTeamPlayers.length > 0 ? secondInningBattingTeamPlayers.length : 11;
            const wicketsRemaining = numberOfPlayersInSecondTeam - 1 - secondInning.wickets;
            updatedMatch.result = `${secondInningTeam?.name} won by ${wicketsRemaining} wickets.`;
        } else if (firstInning.score > secondInning.score) {
            updatedMatch.result = `${firstInningTeam?.name} won by ${firstInning.score - secondInning.score} runs.`;
        } else {
            updatedMatch.result = "Match is a Tie.";
        }
         toast({ title: "Match Ended", description: `Match has been manually concluded. ${updatedMatch.result}` });
    }
    await updateDoc(doc(db, 'matches', matchId), updatedMatch);
  };

  const value: AppContextType = useMemo(() => ({
      loading,
      teams,
      players,
      matches,
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
      getMatchById,
      recordDelivery,
      setPlayerInMatch,
      swapStrikers,
      undoDelivery,
      retireStriker,
      forceEndInning,
  }), [loading, teams, players, matches, db, toast]);

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
