'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Match, Team, DeliveryRecord } from '@/lib/types';

interface MatchAnalysisProps {
  match: Match;
  teams: Team[];
}

export function MatchAnalysis({ match, teams }: MatchAnalysisProps) {
  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown';

  const chartData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = match.overs;

    // Initialize data structure for each ball/over
    for (let i = 0; i <= maxOvers; i++) {
      data.push({ over: i, team1Score: 0, team2Score: 0 });
    }

    match.innings.forEach((inning, index) => {
      let currentScore = 0;
      let legalBalls = 0;
      const scoreKey = index === 0 ? 'team1Score' : 'team2Score';

      inning.deliveryHistory.forEach(d => {
        currentScore += d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') {
          currentScore += 1;
        } else {
          legalBalls++;
        }

        const overIdx = Math.floor(legalBalls / 6);
        if (overIdx <= maxOvers) {
          // Fill all subsequent points to show progression
          for (let i = overIdx; i <= maxOvers; i++) {
            data[i][scoreKey] = currentScore;
          }
        }
      });
    });

    return data;
  }, [match]);

  const manhattanData = useMemo(() => {
    return match.innings.map((inning, idx) => {
      const overs: any[] = [];
      let currentOverRuns = 0;
      let legalBallsInOver = 0;
      let overNum = 1;

      inning.deliveryHistory.forEach(d => {
        let runs = d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') runs += 1;
        currentOverRuns += runs;

        if (d.extra !== 'wide' && d.extra !== 'noball') {
          legalBallsInOver++;
        }

        if (legalBallsInOver === 6) {
          overs.push({ over: overNum, runs: currentOverRuns, team: getTeamName(inning.battingTeamId) });
          currentOverRuns = 0;
          legalBallsInOver = 0;
          overNum++;
        }
      });

      if (legalBallsInOver > 0) {
        overs.push({ over: overNum, runs: currentOverRuns, team: getTeamName(inning.battingTeamId) });
      }

      return overs;
    });
  }, [match, teams]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Score Progression</CardTitle>
          <CardDescription>Cumulative score over time (Worm Graph)</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="over" label={{ value: 'Overs', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Runs', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line 
                type="monotone" 
                dataKey="team1Score" 
                name={getTeamName(match.innings[0]?.battingTeamId)} 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
              {match.innings.length > 1 && (
                <Line 
                  type="monotone" 
                  dataKey="team2Score" 
                  name={getTeamName(match.innings[1]?.battingTeamId)} 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {manhattanData.map((inningOvers, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle>Runs Per Over</CardTitle>
              <CardDescription>{getTeamName(match.innings[idx].battingTeamId)}</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inningOvers}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="over" />
                  <YAxis />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="runs" name="Runs">
                    {inningOvers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={idx === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
