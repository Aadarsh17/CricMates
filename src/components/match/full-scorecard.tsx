'use client';

import type { Match, Player, Team, Inning } from "@/lib/types";
import { InningScorecard } from "./inning-scorecard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

const InningCollapsible = ({ inning, match, teams, players, defaultOpen = true }: { inning: Inning, match: Match, teams: Team[], players: Player[], defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const team = getTeamById(inning.battingTeamId);

    return (
        <Card className="overflow-hidden break-inside-avoid print:shadow-none print:border print:rounded-none">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="p-0">
                    <CollapsibleTrigger className="flex justify-between items-center w-full p-3 bg-foreground text-background print:bg-gray-200 print:text-black text-left rounded-t-lg data-[state=closed]:rounded-b-lg transition-[border-radius]">
                         <h3 className="text-lg font-semibold">{team?.name} Innings</h3>
                         <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <InningScorecard inning={inning} match={match} teams={teams} players={players} />
                </CollapsibleContent>
            </Collapsible>
        </Card>
    )
}

export function FullScorecard({ match, teams, players }: { match: Match; teams: Team[]; players: Player[] }) {
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;
    
    return (
        <div className="space-y-4 print:space-y-0">
            <InningCollapsible inning={firstInning} match={match} teams={teams} players={players} defaultOpen={true}/>
            {secondInning && <InningCollapsible inning={secondInning} match={match} teams={teams} players={players} defaultOpen={true} />}
        </div>
    )
}
