'use client';

import type { Match, Player, Team } from "@/lib/types";
import { InningScorecard } from "./inning-scorecard";

export function FullScorecard({ match, teams, players }: { match: Match; teams: Team[]; players: Player[] }) {
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;
    
    return (
        <div className="space-y-6 print:space-y-4">
            <InningScorecard inning={firstInning} match={match} teams={teams} players={players} />
            {secondInning && <InningScorecard inning={secondInning} match={match} teams={teams} players={players} />}
        </div>
    )
}
