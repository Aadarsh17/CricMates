import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Match, Team, Player, Inning, DeliveryRecord } from "./types"
import { getPlayerOfTheMatch } from "./stats"

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
    
    // Batting stats calculation
    const battingTeamPlayerIds = inning.battingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
    const battingTeamPlayers = players.filter(p => battingTeamPlayerIds?.includes(p.id));

    // Determine appearance order
    const orderOfAppearance: string[] = [];
    inning.deliveryHistory.forEach(d => {
        if (d.strikerId && !orderOfAppearance.includes(d.strikerId)) orderOfAppearance.push(d.strikerId);
        if (d.nonStrikerId && !orderOfAppearance.includes(d.nonStrikerId)) orderOfAppearance.push(d.nonStrikerId);
    });
    if (inning.strikerId && !orderOfAppearance.includes(inning.strikerId)) orderOfAppearance.push(inning.strikerId);
    if (inning.nonStrikerId && !orderOfAppearance.includes(inning.nonStrikerId)) orderOfAppearance.push(inning.nonStrikerId);

    // Sort players by appearance order, putting 'Yet to Bat' at end
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

      // Hide players who didn't bat ONLY in completed matches to keep scorecard clean
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

    // Bowling stats calculation
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

    return `
      <div class="inning">
        <h2>${battingTeamName} Innings</h2>
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

  const potm = getPlayerOfTheMatch(match, players, teams);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Scorecard - ${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        h1 { color: #2563eb; margin-bottom: 5px; font-size: 24px; }
        .match-info { margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
        .match-info p { margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .inning { margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .inning h2 { background: #f1f5f9; margin: 0; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 16px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 10px 15px; border-bottom: 1px solid #f1f5f9; }
        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .text-right { text-align: right; }
        .total-bar { padding: 12px 15px; background: #eff6ff; font-size: 14px; display: flex; justify-content: space-between; border-top: 1px solid #dbeafe; }
        .result { font-size: 20px; font-weight: bold; color: #059669; text-align: center; margin: 30px 0; padding: 15px; background: #ecfdf5; border-radius: 8px; }
        .potm { text-align: center; border: 2px solid #fbbf24; border-radius: 8px; padding: 15px; background: #fffbeb; margin-top: 20px; }
        .potm-title { font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: bold; margin-bottom: 5px; }
        .potm-name { font-size: 18px; font-weight: bold; color: #b45309; }
        footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="match-info">
          <h1>${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}</h1>
          <p>${new Date(match.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} • ${match.overs} Over Match</p>
        </div>
        ${match.innings.map(renderInning).join('')}
        <div class="result">${match.result || 'Match in Progress'}</div>
        ${potm.player ? `
          <div class="potm">
            <div class="potm-title">Player of the Match</div>
            <div class="potm-name">${potm.player.name}</div>
            <div style="font-size: 12px; color: #b45309;">Performance Points: ${potm.cvp} CVP</div>
          </div>
        ` : ''}
        <footer>
          Generated by <strong>CricMates</strong> - Effortless Cricket Scoring
        </footer>
      </div>
    </body>
    </html>
  `;
}

export function downloadScorecard(match: Match, teams: Team[], players: Player[]) {
  const html = generateScorecardHTML(match, teams, players);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Scorecard_${getTeamName(match.team1Id, teams)}_vs_${getTeamName(match.team2Id, teams)}_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTeamName(id: string, teams: Team[]) {
  return teams.find(t => t.id === id)?.name || 'Unknown';
}
