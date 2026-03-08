/**
 * @fileOverview Utility functions for match statistics, professional scorecard generation, and match flow timeline logic.
 */

export const getExtendedInningStats = (deliveries: any[], squadIds: string[] = []) => {
  if (!deliveries || deliveries.length === 0) return { batting: [], bowling: [], fow: [], partnerships: [], extras: { total: 0, w: 0, nb: 0, b: 0, lb: 0 }, total: 0, overs: '0.0', rr: '0.00', didNotBat: squadIds };
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const battingOrder: string[] = [];
  const extras = { total: 0, w: 0, nb: 0, b: 0, lb: 0 };

  let currentScore = 0;
  let legalBalls = 0;
  let currentWickets = 0;
  let lastWicketScore = 0;
  const partnerships: any[] = [];

  deliveries.forEach((d) => {
    const sId = d.strikerPlayerId;
    const bId = d.bowlerId || d.bowlerPlayerId;
    
    if (!sId) return;

    if (!battingOrder.includes(sId)) battingOrder.push(sId);

    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' };
    }
    
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    currentScore += (d.totalRunsOnDelivery || 0);
    
    if (d.extraType === 'wide') extras.w += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'noball') extras.nb += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'bye') extras.b += (d.totalRunsOnDelivery || 0);
    else if (d.extraType === 'legbye') extras.lb += (d.totalRunsOnDelivery || 0);

    const isLegal = ['none', 'bye', 'legbye'].includes(d.extraType);
    if (isLegal) legalBalls += 1;

    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].dismissal = d.dismissalType || 'out';
      }
      fow.push({ wicketNum: currentWickets, scoreAtWicket: currentScore, playerOutId: outPid });
      partnerships.push({ wicketNum: currentWickets, runs: currentScore - lastWicketScore });
      lastWicketScore = currentScore;
    }

    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, balls: 0, runs: 0, wickets: 0, maidens: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) bowl[bId].wickets += 1;
      if (isLegal) bowl[bId].balls += 1;
    }
  });

  // Final partnership for not-out batters
  if (currentWickets < 10) {
    partnerships.push({ wicketNum: currentWickets + 1, runs: currentScore - lastWicketScore, isUnbroken: true });
  }

  extras.total = extras.w + extras.nb + extras.b + extras.lb;
  const oversCompleted = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;
  const oversDisplay = `${oversCompleted}.${ballsInOver}`;
  const totalOversDec = oversCompleted + (ballsInOver / 6);
  const rr = totalOversDec > 0 ? (currentScore / totalOversDec).toFixed(2) : '0.00';

  const didNotBat = squadIds.filter(id => !battingOrder.includes(id));

  return {
    batting: battingOrder.map(id => bat[id]),
    bowling: Object.values(bowl).map((b: any) => ({ 
      ...b, 
      oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}`,
      economy: b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'
    })),
    fow,
    partnerships,
    extras,
    total: currentScore,
    wickets: currentWickets,
    overs: oversDisplay,
    rr,
    didNotBat
  };
};

export const generateMatchReport = (match: any, teamNames: Record<string, string>, playerNames: Record<string, string>, inn1: any, inn2: any, stats1: any, stats2: any) => {
  const dateStr = new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  
  const renderInning = (title: string, team: string, stats: any) => `
    <div class="inning-section">
      <div class="inning-header">
        <span class="inning-title">${title} - ${team}</span>
        <span class="inning-score">${stats.total}/${stats.wickets} (${stats.overs})</span>
      </div>
      
      <h3>Batting</h3>
      <table>
        <thead>
          <tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
        </thead>
        <tbody>
          ${stats.batting.map((b: any) => `
            <tr>
              <td class="player-name">${playerNames[b.id] || 'Unknown'} <br/><small style="color: #64748b;">${b.out ? b.dismissal : 'not out'}</small></td>
              <td class="bold">${b.runs}</td>
              <td>${b.balls}</td>
              <td>${b.fours}</td>
              <td>${b.sixes}</td>
              <td>${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : '0.00'}</td>
            </tr>
          `).join('')}
          <tr style="background: #f8fafc; font-weight: bold;">
            <td>Extras</td>
            <td colspan="5">${stats.extras.total} (b ${stats.extras.b}, lb ${stats.extras.lb}, w ${stats.extras.w}, nb ${stats.extras.nb})</td>
          </tr>
          <tr style="background: #f1f5f9; font-weight: 900;">
            <td>Total</td>
            <td colspan="5">${stats.total}/${stats.wickets} (${stats.overs} Overs, RR: ${stats.rr})</td>
          </tr>
        </tbody>
      </table>

      ${stats.didNotBat.length > 0 ? `
        <div class="did-not-bat">
          <strong>Did not Bat:</strong> ${stats.didNotBat.map((id: string) => playerNames[id] || 'Unknown').join(', ')}
        </div>
      ` : ''}

      <h3>Bowling</h3>
      <table>
        <thead>
          <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ER</th></tr>
        </thead>
        <tbody>
          ${stats.bowling.map((b: any) => `
            <tr>
              <td class="player-name">${playerNames[b.id] || 'Unknown'}</td>
              <td>${b.oversDisplay}</td>
              <td>${b.maidens || 0}</td>
              <td>${b.runs}</td>
              <td class="bold">${b.wickets}</td>
              <td>${b.economy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="grid-2">
        <div class="fow-section">
          <h3>Fall of Wickets</h3>
          <ul class="fow-list">
            ${stats.fow.map((f: any) => `
              <li>${f.scoreAtWicket}/${f.wicketNum} (${playerNames[f.playerOutId] || 'Unknown'})</li>
            `).join('')}
            ${stats.fow.length === 0 ? '<li>No wickets fell</li>' : ''}
          </ul>
        </div>
        <div class="partnership-section">
          <h3>Partnerships</h3>
          <ul class="partnership-list">
            ${stats.partnerships.map((p: any) => `
              <li>${p.wicketNum}${p.wicketNum === 1 ? 'st' : p.wicketNum === 2 ? 'nd' : p.wicketNum === 3 ? 'rd' : 'th'} Wicket: ${p.runs} runs ${p.isUnbroken ? '(Unbroken)' : ''}</li>
            `).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;

  return `
    <html>
    <head>
      <title>CricMates Official Report</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: #fff; line-height: 1.5; }
        .container { max-width: 900px; margin: auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .header { text-align: center; border-bottom: 3px solid #3f51b5; padding-bottom: 20px; margin-bottom: 30px; }
        .inning-header { background: #009688; color: white; padding: 12px 20px; display: flex; justify-content: space-between; font-weight: 900; margin-bottom: 15px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; }
        .inning-section { margin-bottom: 40px; }
        h3 { color: #3f51b5; border-left: 4px solid #3f51b5; padding-left: 10px; margin: 20px 0 10px 0; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { text-align: left; background: #f8fafc; padding: 10px; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .bold { font-weight: bold; }
        .player-name { font-weight: 700; color: #1e293b; }
        .did-not-bat { background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 15px; border: 1px dashed #e2e8f0; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { font-size: 11px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; color: #475569; }
        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; color: #3f51b5; font-size: 28px; text-transform: uppercase; letter-spacing: -1px;">CricMates Pro League</h1>
          <p style="margin:5px 0; font-weight: 600; color: #64748b;">${teamNames[match.team1Id] || 'Team 1'} vs ${teamNames[match.team2Id] || 'Team 2'} | ${dateStr}</p>
          <div style="background: #eff6ff; color: #1d4ed8; padding: 10px; border-radius: 8px; display: inline-block; margin-top: 10px; font-weight: 800; text-transform: uppercase; font-size: 14px;">
            ${match.resultDescription}
          </div>
        </div>
        ${renderInning("1st Innings", teamNames[inn1?.battingTeamId] || 'Team A', stats1)}
        ${inn2 ? renderInning("2nd Innings", teamNames[inn2?.battingTeamId] || 'Team B', stats2) : ''}
        <div class="footer">
          Generated officially by CricMates Pro League Engine • ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `;
};

export const generateStreetReport = (players: any[], date: string) => {
  const sorted = [...players].sort((a, b) => b.batting.runs - a.batting.runs);
  let html = `<html><head><style>body{font-family:sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#f4f4f4;}</style></head><body><h1>Street Pro - ${date}</h1><table><thead><tr><th>Name</th><th>Runs</th><th>Balls</th><th>Wickets</th></tr></thead><tbody>`;
  sorted.forEach(p => { html += `<tr><td>${p.name}</td><td>${p.batting.runs}</td><td>${p.batting.balls}</td><td>${p.bowling.wickets}</td></tr>`; });
  html += `</tbody></table></body></html>`;
  return html;
};
