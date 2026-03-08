/**
 * @fileOverview Utility functions for match statistics, professional scorecard generation, and match flow timeline logic.
 */

export const getExtendedInningStats = (deliveries: any[], squadIds: string[] = []) => {
  if (!deliveries || deliveries.length === 0) {
    return { 
      batting: [], 
      bowling: [], 
      fow: [], 
      partnerships: [], 
      extras: { total: 0, w: 0, nb: 0, b: 0, lb: 0 }, 
      total: 0, 
      overs: '0.0', 
      rr: '0.00', 
      didNotBat: squadIds 
    };
  }
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const battingOrder: string[] = [];
  const extras = { total: 0, w: 0, nb: 0, b: 0, lb: 0 };

  let currentScore = 0;
  let legalBalls = 0;
  let currentWickets = 0;
  
  // Partnership tracking variables
  const partnerships: any[] = [];
  let currentPartnership = {
    batters: [] as string[],
    runs: 0,
    balls: 0,
    contributions: {} as Record<string, number>,
    extras: 0
  };

  deliveries.forEach((d) => {
    const sId = d.strikerPlayerId;
    const bId = d.bowlerId || d.bowlerPlayerId;
    
    if (!sId) return;

    // Track batting order
    if (!battingOrder.includes(sId)) battingOrder.push(sId);

    // Initialize batter stats
    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' };
    }
    
    // Batting stats (ignore wides)
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    // Totals & Extras
    currentScore += (d.totalRunsOnDelivery || 0);
    
    if (d.extraType === 'wide') extras.w += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'noball') extras.nb += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'bye') extras.b += (d.totalRunsOnDelivery || 0);
    else if (d.extraType === 'legbye') extras.lb += (d.totalRunsOnDelivery || 0);

    const isLegal = ['none', 'bye', 'legbye'].includes(d.extraType);
    if (isLegal) legalBalls += 1;

    // Partnership Logic
    // If it's a new pair or first pair
    const nsId = d.nonStrikerPlayerId;
    const currentPair = [sId, nsId].filter(Boolean).sort();
    
    if (currentPartnership.batters.length === 0) {
      currentPartnership.batters = currentPair;
    } else if (JSON.stringify(currentPartnership.batters) !== JSON.stringify(currentPair)) {
      // Wicket happened or retirement happened in previous ball
      // (This usually triggers on the next ball after a wicket)
    }

    currentPartnership.runs += (d.totalRunsOnDelivery || 0);
    if (d.extraType !== 'wide') currentPartnership.balls += 1;
    
    // Track individual contribution in current partnership
    if (!currentPartnership.contributions[sId]) currentPartnership.contributions[sId] = 0;
    if (d.extraType !== 'wide') {
      currentPartnership.contributions[sId] += (d.runsScored || 0);
    } else {
      currentPartnership.extras += (d.totalRunsOnDelivery || 1);
    }

    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].dismissal = d.dismissalType || 'out';
      }
      
      const overLabel = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
      fow.push({ wicketNum: currentWickets, scoreAtWicket: currentScore, playerOutId: outPid, over: overLabel, runsOut: bat[outPid].runs });
      
      // Close partnership
      partnerships.push({ ...currentPartnership });
      // Reset for next
      currentPartnership = {
        batters: [], // Will be set on next ball
        runs: 0,
        balls: 0,
        contributions: {},
        extras: 0
      };
    }

    // Bowling stats
    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, balls: 0, runs: 0, wickets: 0, maidens: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && !['runout', 'retired', '3-Dots Streak'].includes(d.dismissalType || '')) {
        bowl[bId].wickets += 1;
      }
      if (isLegal) bowl[bId].balls += 1;
    }
  });

  // Final partnership for not-out batters
  if (currentPartnership.runs > 0 || currentPartnership.balls > 0) {
    partnerships.push({ ...currentPartnership, isUnbroken: true });
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
  const formatStr = `${match.totalOvers} OV MATCH`;

  // Find Player of the Match if available
  const potmName = playerNames[match.potmPlayerId] || 'TBD';
  const potmPoints = match.potmCvpScore ? `${match.potmCvpScore.toFixed(1)} CVP` : '';

  const renderInning = (innNum: number, teamId: string, stats: any) => {
    const title = `${innNum}${innNum === 1 ? 'ST' : '2ND'} INN: ${teamNames[teamId] || 'TEAM'}`;
    const scoreText = `${stats.total}/${stats.wickets} (${stats.overs})`;

    return `
      <div class="inning-section">
        <div class="inning-header">
          <span class="inning-title">${title}</span>
          <span class="inning-score-top">${scoreText}</span>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40%">BATTER</th>
              <th class="text-right">R</th>
              <th class="text-right">B</th>
              <th class="text-right">4S</th>
              <th class="text-right">6S</th>
              <th class="text-right">SR</th>
            </tr>
          </thead>
          <tbody>
            ${stats.batting.map((b: any) => `
              <tr>
                <td>
                  <div class="player-name-cell">${playerNames[b.id] || 'Unknown'}</div>
                  <div class="dismissal-sub">(${b.out ? b.dismissal : 'NOT OUT'})</div>
                </td>
                <td class="text-right bold">${b.runs}</td>
                <td class="text-right dim">${b.balls}</td>
                <td class="text-right dim">${b.fours}</td>
                <td class="text-right dim">${b.sixes}</td>
                <td class="text-right dim">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="stats-row">
          <div class="fow-column">
            <div class="sub-section-title">FALL OF WICKETS</div>
            <div class="fow-content">
              ${stats.fow.map((f: any) => `
                <span class="fow-item"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${playerNames[f.playerOutId]} ${f.runsOut}, ${f.over})</span>
              `).join(' ')}
              ${stats.fow.length === 0 ? '<span class="dim">NO WICKETS FELL</span>' : ''}
            </div>
          </div>
          <div class="partnership-column">
            <div class="sub-section-title">PARTNERSHIPS</div>
            <table class="nested-table">
              <thead>
                <tr>
                  <th>PARTNERS</th>
                  <th class="text-right">RUNS(B)</th>
                  <th class="text-right">CONTRIBUTION</th>
                </tr>
              </thead>
              <tbody>
                ${stats.partnerships.map((p: any) => {
                  const pNames = p.batters.map((id: string) => playerNames[id].split(' ')[0]).join('-');
                  const contribs = Object.entries(p.contributions)
                    .map(([id, runs]) => `${playerNames[id].split(' ')[0]} ${runs}`)
                    .join(', ');
                  return `
                    <tr>
                      <td class="dim">${pNames}</td>
                      <td class="text-right bold">${p.runs}(${p.balls})</td>
                      <td class="text-right dim" style="font-size: 9px;">${contribs}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="sub-section-title" style="margin-top: 15px;">BOWLING: ${teamNames[match.team1Id === teamId ? match.team2Id : match.team1Id]}</div>
        <table class="bowling-table">
          <thead>
            <tr>
              <th style="width: 40%">BOWLER</th>
              <th class="text-right">O</th>
              <th class="text-right">M</th>
              <th class="text-right">R</th>
              <th class="text-right">W</th>
              <th class="text-right">ECO</th>
            </tr>
          </thead>
          <tbody>
            ${stats.bowling.map((b: any) => `
              <tr>
                <td class="bold">${playerNames[b.id] || 'Unknown'}</td>
                <td class="text-right dim">${b.oversDisplay}</td>
                <td class="text-right dim">${b.maidens || 0}</td>
                <td class="text-right bold">${b.runs}</td>
                <td class="text-right bold highlight-blue">${b.wickets}</td>
                <td class="text-right dim">${b.economy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
    <html>
    <head>
      <title>Official Scorecard - ${teamNames[match.team1Id]} vs ${teamNames[match.team2Id]}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; background: #fff; line-height: 1.3; }
        .container { max-width: 800px; margin: auto; }
        
        .main-header { text-align: center; border-bottom: 4px solid #3f51b5; padding-bottom: 10px; margin-bottom: 5px; }
        .main-header h1 { margin: 0; color: #3f51b5; font-size: 22px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
        .main-header p { margin: 2px 0; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }

        .potm-banner { background: #f59e0b; color: #fff; padding: 8px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 14px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .potm-icon { margin-right: 8px; }

        .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
        .summary-team { flex: 1; text-align: center; }
        .summary-team-name { font-weight: 900; font-size: 14px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .summary-score { font-weight: 900; font-size: 24px; color: #3f51b5; }
        .summary-overs { font-size: 10px; color: #94a3b8; font-weight: 700; }
        .summary-vs { font-weight: 900; color: #cbd5e1; padding: 0 20px; }

        .result-statement { text-align: center; font-weight: 900; font-size: 18px; color: #3f51b5; text-transform: uppercase; padding: 10px 0; }

        .inning-section { margin-bottom: 30px; }
        .inning-header { background: #3f51b5; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 13px; text-transform: uppercase; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { text-align: left; padding: 8px; font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; font-weight: 800; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; }
        
        .player-name-cell { font-weight: 800; text-transform: uppercase; color: #1e293b; }
        .dismissal-sub { font-size: 9px; font-weight: 700; font-style: italic; color: #94a3b8; text-transform: uppercase; margin-top: 2px; }
        
        .text-right { text-align: right; }
        .bold { font-weight: 900; }
        .dim { color: #94a3b8; font-weight: 600; }
        .highlight-blue { color: #3f51b5; }

        .stats-row { display: flex; gap: 15px; margin-top: 10px; }
        .fow-column { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; }
        .partnership-column { flex: 1.2; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; }
        
        .sub-section-title { font-weight: 900; font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
        .fow-content { font-size: 11px; line-height: 1.6; }
        .fow-item { margin-right: 10px; }

        .nested-table th { background: #f8fafc; padding: 4px 8px; border: none; }
        .nested-table td { padding: 4px 8px; border: none; font-size: 11px; }

        .bowling-table { margin-top: 5px; }
        .bowling-table th { background: #f8fafc; border-top: 1px solid #e2e8f0; }

        .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #cbd5e1; font-weight: 800; text-transform: uppercase; border-top: 1px solid #f1f5f9; padding-top: 10px; letter-spacing: 1px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="main-header">
          <h1>OFFICIAL MATCH SCORECARD</h1>
          <p>${dateStr} | ${formatStr}</p>
        </div>

        <div class="potm-banner">
          <span class="potm-icon">🏆</span> PLAYER OF THE MATCH: ${potmName} ${potmPoints ? '(' + potmPoints + ')' : ''}
        </div>

        <div class="summary-row">
          <div class="summary-team">
            <div class="summary-team-name">${teamNames[match.team1Id]}</div>
            <div class="summary-score">${stats1.total}/${stats1.wickets}</div>
            <div class="summary-overs">${stats1.overs} OV</div>
          </div>
          <div class="summary-vs">VS</div>
          <div class="summary-team">
            <div class="summary-team-name">${teamNames[match.team2Id]}</div>
            <div class="summary-score">${stats2.total}/${stats2.wickets}</div>
            <div class="summary-overs">${stats2.overs} OV</div>
          </div>
        </div>

        <div class="result-statement">${match.resultDescription}</div>

        ${renderInning(1, stats1.total > 0 || stats1.overs !== '0.0' ? (inn1?.battingTeamId || match.team1Id) : match.team1Id, stats1)}
        ${inn2 ? renderInning(2, inn2?.battingTeamId || match.team2Id, stats2) : ''}

        <div class="footer">
          GENERATED BY CRICMATES | ONE-PAGE PRO SCORECARD
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
