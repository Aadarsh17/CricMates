import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Match, Team, Player, Inning, DeliveryRecord } from "./types"
import { getPlayerOfTheMatch, calculatePlayerCVP } from "./stats"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateScorecardHTML(match: Match, teams: Team[], players: Player[]) {
  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown';
  const getPlayerById = (id: string) => players.find(p => p.id === id);

  const formatOvers = (balls: number) => {
    const overs = Math.floor(balls / 6);
    const remainingBalls = balls % 6;
    return `${overs}.${remainingBalls}`;
  };

  const renderInning = (inning: Inning) => {
    const battingTeamName = getTeamName(inning.battingTeamId);
    
    const battingTeamPlayerIds = inning.battingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
    const battingTeamPlayers = players.filter(p => battingTeamPlayerIds?.includes(p.id));

    const orderOfAppearance: string[] = [];
    inning.deliveryHistory.forEach(d => {
        if (d.strikerId && !orderOfAppearance.includes(d.strikerId)) orderOfAppearance.push(d.strikerId);
        if (d.nonStrikerId && !orderOfAppearance.includes(d.nonStrikerId)) orderOfAppearance.push(d.nonStrikerId);
    });
    if (inning.strikerId && !orderOfAppearance.includes(inning.strikerId)) orderOfAppearance.push(inning.strikerId);
    if (inning.nonStrikerId && !orderOfAppearance.includes(inning.nonStrikerId)) orderOfAppearance.push(inning.nonStrikerId);

    const sortedBattingPlayers = [...battingTeamPlayers].sort((a, b) => {
        const idxA = orderOfAppearance.indexOf(a.id);
        const idxB = orderOfAppearance.indexOf(b.id);
        const orderA = idxA === -1 ? 999 : idxA;
        const orderB = idxB === -1 ? 999 : idxB;
        return orderA - orderB;
    });

    const battingRows = sortedBattingPlayers.map(p => {
      const deliveries = inning.deliveryHistory.filter(d => d.strikerId === p.id);
      const runs = deliveries.reduce((acc, d) => acc + (d.extra !== 'byes' && d.extra !== 'legbyes' ? d.runs : 0), 0);
      const balls = deliveries.filter(d => d.extra !== 'wide').length;
      const fours = deliveries.filter(d => d.runs === 4 && !d.extra).length;
      const sixes = deliveries.filter(d => d.runs === 6 && !d.extra).length;
      const sr = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';

      const wicketDelivery = inning.deliveryHistory.find(d => d.isWicket && d.dismissal?.batsmanOutId === p.id);
      let dismissal = 'Yet to Bat';
      if (wicketDelivery && wicketDelivery.dismissal) {
        const bowler = getPlayerById(wicketDelivery.bowlerId);
        const fielder = wicketDelivery.dismissal.fielderId ? getPlayerById(wicketDelivery.dismissal.fielderId) : null;
        switch (wicketDelivery.dismissal.type) {
          case 'Catch out': dismissal = `c ${fielder?.name || 'fielder'} b ${bowler?.name || 'bowler'}`; break;
          case 'Run out': dismissal = `run out (${fielder?.name || 'fielder'})`; break;
          case 'Stumping': dismissal = `st ${fielder?.name || 'keeper'} b ${bowler?.name || 'bowler'}`; break;
          case 'Bowled': dismissal = `b ${bowler?.name || 'bowler'}`; break;
          case 'Hit wicket': dismissal = `hit wicket b ${bowler?.name || 'bowler'}`; break;
          default: dismissal = `b ${bowler?.name || 'bowler'}`; break;
        }
      } else if (orderOfAppearance.includes(p.id)) {
        dismissal = 'not out';
      }

      if (dismissal === 'Yet to Bat' && match.status === 'completed') return '';

      return `
        <tr>
          <td>
            <div style="font-weight: bold;">${p.name}</div>
            <div style="font-size: 0.8em; color: #64748b;">${dismissal}</div>
          </td>
          <td class="text-right">${runs}</td>
          <td class="text-right">${balls}</td>
          <td class="text-right">${fours}</td>
          <td class="text-right">${sixes}</td>
          <td class="text-right">${sr}</td>
        </tr>
      `;
    }).join('');

    const bowlersUsed = [...new Set(inning.deliveryHistory.map(d => d.bowlerId).filter(Boolean))];
    const bowlingRows = bowlersUsed.map(bowlerId => {
      const bowler = getPlayerById(bowlerId);
      const deliveries = inning.deliveryHistory.filter(d => d.bowlerId === bowlerId);
      let runsConceded = 0;
      let legalBalls = 0;
      deliveries.forEach(d => {
        runsConceded += d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') runsConceded += 1;
        if (d.extra !== 'wide' && d.extra !== 'noball') legalBalls += 1;
      });
      const wickets = deliveries.filter(d => d.isWicket && d.dismissal?.type !== 'Run out').length;
      const econ = legalBalls > 0 ? (runsConceded / (legalBalls / 6)).toFixed(2) : '0.00';

      return `
        <tr>
          <td>${bowler?.name || 'Unknown'}</td>
          <td class="text-right">${formatOvers(legalBalls)}</td>
          <td class="text-right">0</td>
          <td class="text-right">${runsConceded}</td>
          <td class="text-right" style="font-weight: bold; color: #2563eb;">${wickets}</td>
          <td class="text-right">${econ}</td>
        </tr>
      `;
    }).join('');

    const extras = inning.deliveryHistory.reduce((acc, d) => {
      if (d.extra === 'byes' || d.extra === 'legbyes') return acc + d.runs;
      if (d.extra === 'wide' || d.extra === 'noball') return acc + 1;
      return acc;
    }, 0);

    // Partnership & FoW Logic
    const fows: string[] = [];
    const pships: string[] = [];
    let score = 0;
    let balls = 0;
    let wickets = 0;
    let pRuns = 0;
    let pBalls = 0;

    inning.deliveryHistory.forEach(d => {
        let dRuns = d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') dRuns += 1;
        score += dRuns;
        pRuns += dRuns;
        
        if (d.extra !== 'wide') {
            balls++;
            pBalls++;
        }

        if (d.isWicket) {
            wickets++;
            fows.push(`<li><strong>${wickets}-${score}</strong> (${getPlayerById(d.dismissal?.batsmanOutId || '')?.name}, ${formatOvers(balls)} ov)</li>`);
            pships.push(`<li><strong>Wkt ${wickets}</strong>: ${pRuns} runs (${pBalls} balls) - ${getPlayerById(d.strikerId)?.name} & ${getPlayerById(d.nonStrikerId || '')?.name}</li>`);
            pRuns = 0;
            pBalls = 0;
        }
    });

    return `
      <div class="inning">
        <h2 class="section-header">${battingTeamName} Innings</h2>
        <table>
          <thead>
            <tr>
              <th>Batsman</th>
              <th class="text-right">R</th>
              <th class="text-right">B</th>
              <th class="text-right">4s</th>
              <th class="text-right">6s</th>
              <th class="text-right">SR</th>
            </tr>
          </thead>
          <tbody>${battingRows}</tbody>
        </table>
        <div class="total-bar">
          <span>Extras: ${extras}</span>
          <span>Total: <strong>${inning.score}/${inning.wickets}</strong> (${inning.overs.toFixed(1)} Overs)</span>
        </div>
        
        <div style="padding: 15px 20px; display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 10px 0; text-transform: uppercase; color: #64748b;">Fall of Wickets</h4>
                <ul style="list-style: none; padding: 0; margin: 0; color: #1e293b;">${fows.join('') || 'None'}</ul>
            </div>
            <div style="flex: 1;">
                <h4 style="margin: 0 0 10px 0; text-transform: uppercase; color: #64748b;">Partnerships</h4>
                <ul style="list-style: none; padding: 0; margin: 0; color: #1e293b;">${pships.join('') || 'None'}</ul>
            </div>
        </div>

        <table style="margin-top: 10px;">
          <thead>
            <tr>
              <th>Bowler</th>
              <th class="text-right">O</th>
              <th class="text-right">M</th>
              <th class="text-right">R</th>
              <th class="text-right">W</th>
              <th class="text-right">ECON</th>
            </tr>
          </thead>
          <tbody>${bowlingRows}</tbody>
        </table>
      </div>
    `;
  };

  const renderOversHistory = (inning: Inning) => {
    const overs: DeliveryRecord[][] = [];
    let currentOver: DeliveryRecord[] = [];
    let legalBalls = 0;

    inning.deliveryHistory.forEach(d => {
      currentOver.push(d);
      if (d.extra !== 'wide' && d.extra !== 'noball') {
        legalBalls++;
      }
      if (legalBalls === 6) {
        overs.push(currentOver);
        currentOver = [];
        legalBalls = 0;
      }
    });
    if (currentOver.length > 0) overs.push(currentOver);

    const overRows = overs.map((overDeliveries, idx) => {
      const outcomeHtml = overDeliveries.map(d => {
        let color = '#64748b';
        if (d.isWicket) color = '#ef4444';
        else if (d.runs === 4 || d.runs === 6) color = '#2563eb';
        return `<span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px; font-weight: bold;">${d.outcome}</span>`;
      }).join('');

      const bowler = getPlayerById(overDeliveries[0].bowlerId);
      return `
        <tr>
          <td style="width: 60px;">Over ${idx + 1}</td>
          <td style="width: 120px; font-weight: 600;">${bowler?.name || 'N/A'}</td>
          <td>${outcomeHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="overs-section">
        <h3 style="font-size: 14px; margin: 15px 0 10px 0; color: #475569;">${getTeamName(inning.battingTeamId)} Over History</h3>
        <table>
          <tbody>${overRows || '<tr><td colspan="3">No deliveries recorded</td></tr>'}</tbody>
        </table>
      </div>
    `;
  };

  const renderSquadList = (teamId: string, playerIds: string[]) => {
    const team = teams.find(t => t.id === teamId);
    const teamPlayers = players.filter(p => playerIds.includes(p.id));
    const playerRows = teamPlayers.map(p => `
      <tr>
        <td style="font-weight: 600;">${p.name}</td>
        <td style="color: #64748b; font-size: 12px;">${p.role}</td>
      </tr>
    `).join('');

    return `
      <div style="flex: 1; min-width: 250px; margin-bottom: 20px;">
        <h3 style="font-size: 14px; margin-bottom: 10px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">${team?.name}</h3>
        <table style="background: transparent;">
          <tbody>${playerRows}</tbody>
        </table>
      </div>
    `;
  };

  // Chart Data Preparation
  const wormData: any[] = [];
  const manhattanData: any[][] = [];
  const labels: number[] = [];
  for (let i = 0; i <= match.overs; i++) labels.push(i);

  match.innings.forEach((inning, idx) => {
    const scores: number[] = [0];
    const runsPerOver: number[] = [];
    let currentScore = 0;
    let currentOverRuns = 0;
    let legalBallsInOver = 0;

    inning.deliveryHistory.forEach(d => {
      let runs = d.runs;
      if (d.extra === 'wide' || d.extra === 'noball') runs += 1;
      currentScore += runs;
      currentOverRuns += runs;

      if (d.extra !== 'wide' && d.extra !== 'noball') {
        legalBallsInOver++;
      }

      if (legalBallsInOver === 6) {
        scores.push(currentScore);
        runsPerOver.push(currentOverRuns);
        currentOverRuns = 0;
        legalBallsInOver = 0;
      }
    });

    if (legalBallsInOver > 0) {
      scores.push(currentScore);
      runsPerOver.push(currentOverRuns);
    }

    while (scores.length <= match.overs + 1) {
      scores.push(currentScore);
    }

    wormData.push(scores);
    manhattanData.push(runsPerOver);
  });

  const potm = getPlayerOfTheMatch(match, players, teams);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Match Report - ${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; background: #f8fafc; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .match-header { text-align: center; margin-bottom: 20px; border-bottom: 4px solid #2563eb; padding-bottom: 20px; }
        h1 { color: #0f172a; margin: 0; font-size: 32px; letter-spacing: -0.025em; }
        .match-info { color: #64748b; text-transform: uppercase; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; margin-top: 10px; }
        
        .section-title { font-size: 20px; font-weight: 800; color: #1e293b; margin: 40px 0 20px 0; display: flex; align-items: center; gap: 10px; border-left: 4px solid #2563eb; padding-left: 15px; }
        .inning { margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; }
        .section-header { background: #f1f5f9; margin: 0; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; font-size: 16px; font-weight: 700; color: #0f172a; }
        
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 12px 20px; border-bottom: 1px solid #f1f5f9; }
        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .text-right { text-align: right; }
        .total-bar { padding: 15px 20px; background: #f0f9ff; font-size: 14px; display: flex; justify-content: space-between; border-top: 1px solid #bae6fd; font-weight: 500; }
        
        .result-box { font-size: 24px; font-weight: 900; color: #059669; text-align: center; margin: 20px 0; padding: 25px; background: #ecfdf5; border-radius: 12px; border: 2px dashed #10b981; }
        
        .chart-container { margin-bottom: 40px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
        .chart-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
        
        .potm-card { display: flex; align-items: center; justify-content: center; flex-direction: column; border: 2px solid #fbbf24; border-radius: 16px; padding: 30px; background: #fffbeb; margin: 20px 0; position: relative; }
        .potm-badge { position: absolute; top: -12px; background: #fbbf24; color: #92400e; font-weight: 800; font-size: 10px; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; }
        .potm-name { font-size: 24px; font-weight: 800; color: #b45309; }
        
        .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        
        @media (max-width: 768px) {
          .chart-grid { grid-template-cols: 1fr; }
        }
        @media print {
          body { background: white; padding: 0; }
          .container { box-shadow: none; border: none; padding: 20px; }
          .inning { break-inside: avoid; }
          .chart-container { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="match-header">
          <h1>${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}</h1>
          <div class="match-info">${new Date(match.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} • ${match.overs} OVER MATCH</div>
        </div>

        <!-- 1. Result -->
        <div class="result-box">${match.result || 'Match in Progress'}</div>

        <!-- 2. Player of the Match -->
        ${potm.player ? `
          <div class="potm-card">
            <span class="potm-badge">Player of the Match</span>
            <div class="potm-name">${potm.player.name}</div>
            <div style="font-size: 14px; color: #92400e; margin-top: 10px; font-weight: 600;">Performance Points: ${potm.cvp} CVP</div>
          </div>
        ` : ''}

        <!-- 3. Full Scorecard -->
        <div class="section-title">Scorecard</div>
        ${match.innings.map(renderInning).join('')}

        <!-- 4. Over by Over -->
        <div class="section-title">Over by Over History</div>
        ${match.innings.map(renderOversHistory).join('')}

        <!-- 5. Match Analysis (Graphs) -->
        <div class="section-title">Match Analysis</div>
        <div class="chart-container">
          <h3 style="font-size: 14px; margin-bottom: 10px; color: #475569;">Score Progression (Worm Graph)</h3>
          <canvas id="wormChart" height="100"></canvas>
        </div>
        <div class="chart-grid">
          <div class="chart-container">
            <h3 style="font-size: 14px; margin-bottom: 10px; color: #475569;">Runs per Over: ${getTeamName(match.innings[0]?.battingTeamId)}</h3>
            <canvas id="manhattan1" height="150"></canvas>
          </div>
          ${match.innings[1] ? `
            <div class="chart-container">
              <h3 style="font-size: 14px; margin-bottom: 10px; color: #475569;">Runs per Over: ${getTeamName(match.innings[1]?.battingTeamId)}</h3>
              <canvas id="manhattan2" height="150"></canvas>
            </div>
          ` : ''}
        </div>

        <!-- 6. Squads -->
        <div class="section-title">Team Squads</div>
        <div style="display: flex; flex-wrap: wrap; gap: 40px;">
          ${renderSquadList(match.team1Id, match.team1PlayerIds || [])}
          ${renderSquadList(match.team2Id, match.team2PlayerIds || [])}
        </div>

        <div class="footer">
          Generated automatically by <strong>CricMates</strong> Digital Scoring System.
        </div>
      </div>

      <script>
        // Worm Chart
        new Chart(document.getElementById('wormChart'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: '${getTeamName(match.innings[0]?.battingTeamId)}',
                data: ${JSON.stringify(wormData[0])},
                borderColor: '#2563eb',
                tension: 0.1,
                fill: false,
                borderWidth: 3
              },
              ${match.innings[1] ? `
              {
                label: '${getTeamName(match.innings[1]?.battingTeamId)}',
                data: ${JSON.stringify(wormData[1])},
                borderColor: '#10b981',
                tension: 0.1,
                fill: false,
                borderWidth: 3
              }` : ''}
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { beginAtZero: true, title: { display: true, text: 'Runs' } },
              x: { title: { display: true, text: 'Overs' } }
            }
          }
        });

        // Manhattan 1
        new Chart(document.getElementById('manhattan1'), {
          type: 'bar',
          data: {
            labels: Array.from({length: ${manhattanData[0].length}}, (_, i) => i + 1),
            datasets: [{
              label: 'Runs',
              data: ${JSON.stringify(manhattanData[0])},
              backgroundColor: '#2563eb'
            }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // Manhattan 2
        ${match.innings[1] ? `
        new Chart(document.getElementById('manhattan2'), {
          type: 'bar',
          data: {
            labels: Array.from({length: ${manhattanData[1].length}}, (_, i) => i + 1),
            datasets: [{
              label: 'Runs',
              data: ${JSON.stringify(manhattanData[1])},
              backgroundColor: '#10b981'
            }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
        ` : ''}
      </script>
    </body>
    </html>
  `;
}

export function downloadScorecard(match: Match, teams: Team[], players: Player[]) {
  const html = generateScorecardHTML(match, teams, players);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const team1 = getTeamNameFromList(match.team1Id, teams);
  const team2 = getTeamNameFromList(match.team2Id, teams);
  a.href = url;
  a.download = `MatchReport_${team1}_vs_${team2}_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTeamNameFromList(id: string, teams: Team[]) {
  return teams.find(t => t.id === id)?.name || 'Unknown';
}