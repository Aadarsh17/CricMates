'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Team, Player, Match, Inning, DeliveryRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type PlayerData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
}

interface AppContextType {
  isDataLoaded: boolean;
  teams: Team[];
  players: Player[];
  matches: Match[];
  addTeam: (name: string) => void;
  editTeam: (teamId: string, name: string) => void;
  deleteTeam: (teamId: string) => void;
  addPlayer: (teamId: string, playerData: PlayerData) => void;
  editPlayer: (playerId: string, playerData: PlayerData) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCountForTeam: (teamId: string) => number;
  getTeamById: (teamId: string) => Team | undefined;
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayersByTeamId: (teamId: string) => Player[];
  addMatch: (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => string;
  getMatchById: (matchId: string) => Match | undefined;
  recordDelivery: (matchId: string, outcome: { runs: number, isWicket: boolean, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null, outcome: string }) => void;
  setPlayerInMatch: (matchId: string, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => void;
  swapStrikers: (matchId: string) => void;
  undoDelivery: (matchId: string) => void;
  retireStriker: (matchId: string) => void;
  forceEndInning: (matchId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set data as loaded without retrieving from localStorage.
    // This effectively resets the data on each page load.
    setIsDataLoaded(true);
  }, []);

  const handleInningEnd = (match: Match, teamsData: Team[]): Match => {
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
            const firstInningTeam = teamsData.find(t => t.id === firstInning.battingTeamId);
            const secondInningTeam = teamsData.find(t => t.id === secondInning.battingTeamId);

            if (secondInning.score > firstInning.score) {
                const secondInningBattingTeamPlayers = players.filter(p => p.teamId === secondInning.battingTeamId);
                const numberOfPlayersInSecondTeam = secondInningBattingTeamPlayers.length > 0 ? secondInningBattingTeamPlayers.length : 11;
                const allOutWicketsForSecondTeam = numberOfPlayersInSecondTeam - 1;
                const wicketsRemaining = allOutWicketsForSecondTeam - secondInning.wickets;
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


  const addTeam = (name: string) => {
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name,
      logoUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/128/128`,
      imageHint: 'logo abstract',
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesDrawn: 0,
    };
    setTeams((prevTeams) => [...prevTeams, newTeam]);
  };

  const editTeam = (teamId: string, name: string) => {
    setTeams(prevTeams => prevTeams.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const deleteTeam = (teamId: string) => {
    setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
    setPlayers(prevPlayers => prevPlayers.filter(p => p.teamId !== teamId));
  };
  
  const addPlayer = (teamId: string, playerData: PlayerData) => {
    const newPlayer: Player = {
      id: `p${Date.now()}`,
      teamId: teamId,
      name: playerData.name,
      role: playerData.role,
      isCaptain: playerData.isCaptain || false,
      isWicketKeeper: playerData.isWicketKeeper || false,
      stats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, bestBowling: 'N/A' },
      isRetired: false,
    };
    
    setPlayers(prevPlayers => {
      let updatedPlayers = [...prevPlayers];
      if (newPlayer.isCaptain) {
        updatedPlayers = updatedPlayers.map(p => 
          p.teamId === teamId ? { ...p, isCaptain: false } : p
        );
      }
      return [...updatedPlayers, newPlayer];
    });
  };

  const editPlayer = (playerId: string, playerData: PlayerData) => {
     setPlayers(prevPlayers => {
      const playerToEdit = prevPlayers.find(p => p.id === playerId);
      if (!playerToEdit) return prevPlayers;

      let updatedPlayers = [...prevPlayers];

      if (playerData.isCaptain) {
          updatedPlayers = updatedPlayers.map(p => 
              p.teamId === playerToEdit.teamId && p.id !== playerId 
                  ? { ...p, isCaptain: false } 
                  : p
          );
      }
      
      return updatedPlayers.map(p => 
          p.id === playerId 
              ? { ...p, ...playerData } 
              : p
      );
    });
  };

  const deletePlayer = (playerId: string) => {
    setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerId));
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

  const addMatch = (matchConfig: { team1Id: string; team2Id: string; overs: number; tossWinnerId: string; tossDecision: 'bat' | 'bowl'; }) => {
    const { team1Id, team2Id, overs, tossWinnerId, tossDecision } = matchConfig;
    
    const battingTeamId = tossDecision === 'bat' ? tossWinnerId : (tossWinnerId === team1Id ? team2Id : team1Id);
    const bowlingTeamId = tossWinnerId === battingTeamId ? (battingTeamId === team1Id ? team2Id : team1Id) : tossWinnerId;

    const newMatch: Match = {
      id: `m${Date.now()}`,
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
    setMatches(prevMatches => [...prevMatches, newMatch]);
    return newMatch.id;
  };

  const getMatchById = (matchId: string) => {
    return matches.find(m => m.id === matchId);
  }

  const swapStrikers = (matchId: string) => {
      setMatches(prevMatches => prevMatches.map(m => {
          if (m.id !== matchId) return m;
          const updatedMatch = JSON.parse(JSON.stringify(m));
          const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
          const temp = inning.strikerId;
          inning.strikerId = inning.nonStrikerId;
          inning.nonStrikerId = temp;
          return updatedMatch;
      }));
  }

  const setPlayerInMatch = (matchId: string, role: 'striker' | 'nonStriker' | 'bowler', playerId: string) => {
     setMatches(prevMatches => prevMatches.map(m => {
          if (m.id !== matchId) return m;
          const updatedMatch = JSON.parse(JSON.stringify(m));
          const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
          if (role === 'striker') inning.strikerId = playerId;
          if (role === 'nonStriker') inning.nonStrikerId = playerId;
          if (role === 'bowler') inning.bowlerId = playerId;
          return updatedMatch;
      }));
  }
  
  const retireStriker = (matchId: string) => {
    setMatches(prevMatches => prevMatches.map(m => {
        if (m.id !== matchId || m.status !== 'live') return m;
        let updatedMatch = JSON.parse(JSON.stringify(m));
        const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
        
        if (!inning.strikerId) {
            toast({ variant: "destructive", title: "Striker not selected!"});
            return m;
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
        
        updatedMatch = handleInningEnd(updatedMatch, teams);
        return updatedMatch;
    }));
  };

  const undoDelivery = (matchId: string) => {
      setMatches(prevMatches => {
          const matchToUpdate = prevMatches.find(m => m.id === matchId);
          if (!matchToUpdate) return prevMatches;

          const updatedMatch = JSON.parse(JSON.stringify(matchToUpdate));
          const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
          
          if (inning.deliveryHistory.length === 0) {
              toast({ variant: 'destructive', title: 'No deliveries to undo.'});
              return prevMatches;
          }

          // This is a simplified recreation from history.
          // A more robust solution would store snapshots, but this is good for now.
          const newHistory = inning.deliveryHistory.slice(0, -1);

          let newScore = 0;
          let newWickets = 0;
          let newOvers = 0;
          
          const lastDelivery = inning.deliveryHistory[inning.deliveryHistory.length-1];
          inning.strikerId = lastDelivery.strikerId;
          inning.nonStrikerId = lastDelivery.nonStrikerId;
          inning.bowlerId = lastDelivery.bowlerId;


          newHistory.forEach((delivery: DeliveryRecord) => {
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
          inning.deliveryHistory = newHistory;
          
          return prevMatches.map(m => m.id === matchId ? updatedMatch : m);
      })
  }

  const recordDelivery = (matchId: string, outcome: { runs: number; isWicket: boolean; extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null; outcome: string }) => {
    setMatches(prevMatches => prevMatches.map(m => {
        if (m.id !== matchId || m.status !== 'live') return m;

        let updatedMatch = JSON.parse(JSON.stringify(m)); 
        const inning = updatedMatch.innings[updatedMatch.currentInning - 1];
        
        if (!inning.strikerId || !inning.nonStrikerId || !inning.bowlerId) {
            toast({ variant: "destructive", title: "Players not set!", description: "Please select a striker, non-striker, and bowler."});
            return m;
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

        updatedMatch = handleInningEnd(updatedMatch, teams);
        return updatedMatch;
      }));
  };

  const forceEndInning = (matchId: string) => {
    setMatches(prevMatches => prevMatches.map(m => {
        if (m.id !== matchId || m.status !== 'live') return m;

        let updatedMatch = JSON.parse(JSON.stringify(m));

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
                const allOutWicketsForSecondTeam = numberOfPlayersInSecondTeam - 1;
                const wicketsRemaining = allOutWicketsForSecondTeam - secondInning.wickets;
                updatedMatch.result = `${secondInningTeam?.name} won by ${wicketsRemaining} wickets.`;
            } else if (firstInning.score > secondInning.score) {
                updatedMatch.result = `${firstInningTeam?.name} won by ${firstInning.score - secondInning.score} runs.`;
            } else {
                updatedMatch.result = "Match is a Tie.";
            }
             toast({ title: "Match Ended", description: `Match has been manually concluded. ${updatedMatch.result}` });
        }
        return updatedMatch;
    }));
  };

  const value = {
      isDataLoaded,
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
  };

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
