'use client';
import type { Match, Team } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

export function Scoreboard({ match, teams }: { match: Match, teams: Team[] }) {
    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const currentInning = match.innings[match.currentInning - 1];
    const battingTeam = getTeamById(currentInning.battingTeamId);

    const ballsBowled = Math.floor(currentInning.overs) * 6 + (currentInning.overs % 1) * 10;
    const crr = ballsBowled > 0 ? (currentInning.score / (ballsBowled / 6)).toFixed(2) : '0.00';
    
    let rrr = 'N/A';
    let target = 'N/A';
    let neededText = '';
    
    if (match.currentInning === 2) {
        const firstInningScore = match.innings[0].score;
        target = (firstInningScore + 1).toString();
        const runsNeeded = firstInningScore + 1 - currentInning.score;
        const totalBalls = match.overs * 6;
        const ballsRemaining = totalBalls - ballsBowled;

        if (runsNeeded <= 0) {
            rrr = '0.00';
            neededText = `${battingTeam?.name} won!`;
        } else if (ballsRemaining > 0) {
            rrr = (runsNeeded / (ballsRemaining / 6)).toFixed(2);
            neededText = `${runsNeeded} runs to win from ${ballsRemaining} balls.`;
        } else {
            rrr = '∞';
            if (runsNeeded > 0) {
                neededText = `${runsNeeded} runs to win from 0 balls.`;
            }
        }
    }

    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm text-muted-foreground">{battingTeam?.name} Innings</p>
                        <p className="text-3xl font-bold">{currentInning.score}/{currentInning.wickets} <span className="text-xl text-muted-foreground">({currentInning.overs.toFixed(1)})</span></p>
                    </div>
                    <div className="text-right text-sm space-y-1">
                        <p>CRR: <span className="font-bold">{crr}</span></p>
                        {match.currentInning === 2 && (
                            <>
                                <p>Target: <span className="font-bold">{target}</span></p>
                                <p>RRR: <span className="font-bold">{rrr}</span></p>
                            </>
                        )}
                    </div>
                </div>
                {match.currentInning === 2 && neededText && (
                    <div className="text-center pt-2 text-sm font-semibold text-primary">
                        <p>{neededText}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
