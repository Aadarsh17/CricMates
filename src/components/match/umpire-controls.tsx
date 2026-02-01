'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX, Undo } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import type { Match, Player, Team } from "@/lib/types";
import { Badge } from '../ui/badge';
import { RetirePlayerDialog } from './retire-player-dialog';
import { WicketDialog } from './wicket-dialog';
import { LivePlayerStats } from './live-player-stats';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scoreboard } from './scoreboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ExtraOptions = {
    wicket: boolean;
    wide: boolean;
    noball: boolean;
    byes: boolean;
    legbyes: boolean;
};

const extraButtons: {key: keyof ExtraOptions; label: string}[] = [
    { key: 'wicket', label: 'Wicket' },
    { key: 'wide', label: 'Wd' },
    { key: 'noball', label: 'NB' },
    { key: 'byes', label: 'Byes' },
    { key: 'legbyes', label: 'LB' },
];

const PlayerSelector = ({ label, players, selectedPlayerId, onSelect, disabled = false }: { label: string, players: Player[], selectedPlayerId: string | null, onSelect: (playerId: string) => void, disabled?: boolean }) => (
    <div className="space-y-2">
        <Label>{label}</Label>
        <Select onValueChange={onSelect} value={selectedPlayerId || ''} disabled={disabled}>
            <SelectTrigger>
                <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
                {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
        </Select>
    </div>
)

export function UmpireControls({ match, teams, players, striker, nonStriker, bowler }: { match: Match, teams: Team[], players: Player[], striker?: Player, nonStriker?: Player, bowler?: Player }) {
    const { recordDelivery, swapStrikers, retireStriker, forceEndInning, undoDelivery, setPlayerInMatch } = useAppContext();
    const [extras, setExtras] = useState<ExtraOptions>({
        wicket: false, wide: false, noball: false, byes: false, legbyes: false
    });
    const [isRetireDialogOpen, setIsRetireDialogOpen] = useState(false);
    const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
    const [deliveryForWicket, setDeliveryForWicket] = useState<{ runs: number, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null } | null>(null);
    
    const currentInning = match.innings[match.currentInning - 1];

    const battingTeamPlayers = useMemo(() => {
        const playerIds = currentInning.battingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
        return playerIds ? players.filter(p => playerIds.includes(p.id)) : [];
    }, [currentInning.battingTeamId, match, players]);

    const bowlingTeamPlayers = useMemo(() => {
        const playerIds = currentInning.bowlingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
        return playerIds ? players.filter(p => playerIds.includes(p.id)) : [];
    }, [currentInning.bowlingTeamId, match, players]);

    const allOutWickets = useMemo(() => battingTeamPlayers.length > 1 ? battingTeamPlayers.length - 1 : 10, [battingTeamPlayers]);

    const outPlayerIds = useMemo(() => new Set(match.innings.flatMap(inning => inning.deliveryHistory.filter(d => d.isWicket && d.dismissal).map(d => d.dismissal!.batsmanOutId))), [match.innings]);
    const retiredHurtPlayerIds = useMemo(() => new Set(currentInning.retiredHurtPlayerIds || []), [currentInning.retiredHurtPlayerIds]);

    const selectableBatsmen = useMemo(() => {
        const activeBatsmen = battingTeamPlayers.filter(p => !outPlayerIds.has(p.id) && !retiredHurtPlayerIds.has(p.id));
        const retiredBatsmen = battingTeamPlayers.filter(p => retiredHurtPlayerIds.has(p.id) && !outPlayerIds.has(p.id));
        const activeBatsmenPool = activeBatsmen.filter(p => p.id !== currentInning.strikerId && p.id !== currentInning.nonStrikerId);
        const canRetiredReturn = activeBatsmenPool.length === 0;
        return canRetiredReturn ? [...activeBatsmen, ...retiredBatsmen] : activeBatsmen;
    }, [battingTeamPlayers, outPlayerIds, retiredHurtPlayerIds, currentInning.strikerId, currentInning.nonStrikerId]);

    const noPlayersLeftToBat = useMemo(() => selectableBatsmen.filter(p => p.id !== currentInning.strikerId && p.id !== currentInning.nonStrikerId).length === 0, [selectableBatsmen, currentInning.strikerId, currentInning.nonStrikerId]);

    const availableBatsmenForWicket = useMemo(() => {
        const onFieldPlayerIds = new Set([currentInning.strikerId, currentInning.nonStrikerId].filter(Boolean));
        return battingTeamPlayers.filter(p => !outPlayerIds.has(p.id) && !retiredHurtPlayerIds.has(p.id) && !onFieldPlayerIds.has(p.id));
    }, [battingTeamPlayers, outPlayerIds, retiredHurtPlayerIds, currentInning.strikerId, currentInning.nonStrikerId]);


    const handleExtraChange = (extra: keyof ExtraOptions, checked: boolean) => {
        setExtras(prev => {
            const newExtras = { ...prev };
            // Mutually exclusive extras
            if (checked) {
                if (extra === 'wide') {
                    newExtras.noball = false; newExtras.byes = false; newExtras.legbyes = false;
                }
                if (extra === 'noball') {
                    newExtras.wide = false;
                }
                if (extra === 'byes' || extra === 'legbyes') {
                    newExtras.wide = false;
                }
            }
            newExtras[extra] = checked;
            return newExtras;
        });
    };

    const handleDelivery = (runs: number) => {
        let extraType: 'wide' | 'noball' | 'byes' | 'legbyes' | null = null;
        if (extras.wide) extraType = 'wide';
        else if (extras.noball) extraType = 'noball';
        else if (extras.byes) extraType = 'byes';
        else if (extras.legbyes) extraType = 'legbyes';

        if (extras.wicket) {
            setDeliveryForWicket({ runs, extra: extraType });
            setIsWicketDialogOpen(true);
            return;
        }

        let outcomeString = runs.toString();
        if(extras.wicket) outcomeString = 'W';
        if(extraType === 'wide') outcomeString = `${runs > 0 ? runs : ''}wd`;
        if(extraType === 'noball') outcomeString = `${runs > 0 ? runs : ''}nb`;
        if(extraType === 'byes') outcomeString = `${runs}b`;
        if(extraType === 'legbyes') outcomeString = `${runs}lb`;


        recordDelivery(match, teams, players, {
            runs: runs,
            isWicket: extras.wicket,
            extra: extraType,
            outcome: outcomeString,
        });

        // Reset extras after recording
        setExtras({ wicket: false, wide: false, noball: false, byes: false, legbyes: false });
    };
    
    const handleWicketConfirm = (wicketData: { batsmanOutId: string; dismissalType: string; newBatsmanId?: string; fielderId?: string; }) => {
        if (!deliveryForWicket) return;

        recordDelivery(match, teams, players, {
            runs: deliveryForWicket.runs,
            isWicket: true,
            extra: deliveryForWicket.extra,
            outcome: wicketData.dismissalType,
            wicketDetails: wicketData,
        });

        setIsWicketDialogOpen(false);
        setDeliveryForWicket(null);
        setExtras({ wicket: false, wide: false, noball: false, byes: false, legbyes: false });
    }

    const handleRetireConfirm = () => {
        retireStriker(match);
        setIsRetireDialogOpen(false);
    };

    const CurrentOver = () => {
        const deliveries = currentInning.deliveryHistory;
        const overs = currentInning.overs;
        const overDeliveries = [];
        if (deliveries.length > 0) {
            let legalBallsInCurrentOver = 0;
            const overNumber = Math.floor(overs);
            const ballsInOver = Math.round((overs - overNumber) * 10);
            if (ballsInOver > 0) {
                legalBallsInCurrentOver = ballsInOver;
            } else if (overs > 0 && overs % 1 === 0 && deliveries.at(-1)?.extra !== 'wide' && deliveries.at(-1)?.extra !== 'noball') {
                legalBallsInCurrentOver = 6;
            }

            let ballsFound = 0;
            for (let i = deliveries.length - 1; i >= 0; i--) {
                const delivery = deliveries[i];
                overDeliveries.unshift(delivery);
                if (delivery.extra !== 'wide' && delivery.extra !== 'noball') {
                    ballsFound++;
                }
                if (ballsFound >= legalBallsInCurrentOver) {
                    break;
                }
            }
        }

        return (
            <div className="space-y-2">
                <Label>This Over</Label>
                <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md min-h-[40px] items-center">
                    {overDeliveries.length > 0 ? overDeliveries.map((d, i) => (
                        <Badge key={i} variant={d.isWicket ? 'destructive' : 'secondary'} className="text-md">
                            {d.outcome}
                        </Badge>
                    )) : <p className="text-sm text-muted-foreground px-2">No deliveries bowled in this over yet.</p>}
                </div>
            </div>
        );
    };
    
    const endInningButtonText = match.currentInning === 1 ? 'End 1st Inning' : 'End Match';
    const showOpeningSetup = !striker || !nonStriker || !bowler;

    return (
        <>
            <WicketDialog
                open={isWicketDialogOpen}
                onClose={() => setIsWicketDialogOpen(false)}
                striker={striker}
                nonStriker={nonStriker}
                availableBatsmen={availableBatsmenForWicket}
                bowlingTeamPlayers={bowlingTeamPlayers}
                onConfirm={handleWicketConfirm}
            />
            <RetirePlayerDialog 
                open={isRetireDialogOpen}
                onClose={() => setIsRetireDialogOpen(false)}
                striker={striker}
                onConfirm={handleRetireConfirm}
            />
            <Card>
                <CardHeader className="p-0 border-b">
                    <Scoreboard match={match} teams={teams} />
                </CardHeader>
                <Tabs defaultValue="controls" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-none">
                        <TabsTrigger value="controls">Umpire Controls</TabsTrigger>
                        <TabsTrigger value="stats">Live Stats</TabsTrigger>
                    </TabsList>
                    <TabsContent value="controls" className="mt-0">
                         <CardContent className="p-4 space-y-4">
                            {showOpeningSetup ? (
                                 <div className="space-y-4">
                                     <h3 className="text-sm font-medium text-muted-foreground">Opening Setup</h3>
                                     <PlayerSelector label="Striker" players={selectableBatsmen.filter(p => p.id !== nonStriker?.id)} selectedPlayerId={striker?.id || null} onSelect={(id) => setPlayerInMatch(match, 'striker', id)} disabled={!!striker || noPlayersLeftToBat} />
                                     <PlayerSelector label="Non-Striker" players={selectableBatsmen.filter(p => p.id !== striker?.id)} selectedPlayerId={nonStriker?.id || null} onSelect={(id) => setPlayerInMatch(match, 'nonStriker', id)} disabled={!!nonStriker || noPlayersLeftToBat} />
                                     <PlayerSelector label="Opening Bowler" players={bowlingTeamPlayers} selectedPlayerId={bowler?.id || null} onSelect={(id) => setPlayerInMatch(match, 'bowler', id)} disabled={!!bowler} />
                                 </div>
                            ) : (
                                <>
                                    <CurrentOver />
                                    
                                    <div className="space-y-2">
                                        <Label>Extras</Label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {extraButtons.map(({key, label}) => (
                                                <Button
                                                    key={key}
                                                    variant={extras[key] ? 'secondary' : 'outline'}
                                                    onClick={() => handleExtraChange(key, !extras[key])}
                                                    className="h-12 font-bold"
                                                >
                                                    {label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Runs</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[1, 2, 3, 4, 6, 0].map(runs => (
                                                <Button key={runs} className="h-16 text-2xl font-bold" variant={runs === 0 ? "outline" : "default"} onClick={() => handleDelivery(runs)}>
                                                    {runs}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <Button variant="outline" onClick={() => swapStrikers(match)}>Swap Strikers</Button>
                                        <Button variant="outline" onClick={() => undoDelivery(match)}><Undo className="mr-2 h-4 w-4" /> Undo</Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 border-t pt-4">
                                        <Button variant="destructive" size="sm" onClick={() => setIsRetireDialogOpen(true)}><UserX className="mr-2 h-4 w-4" /> Retire Batsman</Button>
                                        <Button variant="destructive" size="sm" className="bg-red-700 hover:bg-red-800" onClick={() => forceEndInning(match, teams, players)}>{endInningButtonText}</Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="stats" className="mt-0">
                        <LivePlayerStats striker={striker} nonStriker={nonStriker} bowler={bowler} inning={currentInning} />
                    </TabsContent>
                </Tabs>
            </Card>
        </>
    );
}
