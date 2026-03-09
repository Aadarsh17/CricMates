
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
      extras: { total: 0, w: 0, nb: 0 }, 
      total: 0, 
      wickets: 0,
      overs: '0.0', 
      rr: '0.00', 
      didNotBat: squadIds 
    };
  }
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const battingOrder: string[] = [];
  const extras = { total: 0, w: 0, nb: 0 };

  let currentScore = 0;
  let legalBalls = 0;
  let currentWickets = 0;
  
  const partnerships: any[] = [];
  let currentPartnership: any = {
    runs: 0,
    balls: 0,
    contributions: {} as Record<string, { runs: number, balls: number }>,
    isUnbroken: true
  };

  deliveries.forEach((d) => {
    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;
    const bId = d.bowlerId || d.bowlerPlayerId;
    
    if (!sId) return;

    if (!battingOrder.includes(sId)) battingOrder.push(sId);
    if (nsId && !battingOrder.includes(nsId)) battingOrder.push(nsId);

    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: false, dismissal: 'not out', fielderId: 'none' };
    }
    if (nsId && !bat[nsId]) {
      bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: false, dismissal: 'not out', fielderId: 'none' };
    }
    
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
      if (d.runsScored === 0) bat[sId].dots += 1;
    }

    currentScore += (d.totalRunsOnDelivery || 0);
    
    if (d.extraType === 'wide') extras.w += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'noball') extras.nb += (d.totalRunsOnDelivery || 1);

    const isLegal = d.extraType === 'none';
    if (isLegal) legalBalls += 1;

    // Detailed Partnership Logic
    currentPartnership.runs += (d.totalRunsOnDelivery || 0);
    if (d.extraType !== 'wide') currentPartnership.balls += 1;
    
    if (!currentPartnership.contributions[sId]) currentPartnership.contributions[sId] = { runs: 0, balls: 0 };
    if (d.extraType !== 'wide') {
      currentPartnership.contributions[sId].runs += (d.runsScored || 0);
      currentPartnership.contributions[sId].balls += 1;
    }
    
    if (nsId && !currentPartnership.contributions[nsId]) {
      currentPartnership.contributions[nsId] = { runs: 0, balls: 0 };
    }

    if (d.isWicket) {
      if (d.dismissalType !== 'retired') currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].fielderId = d.fielderPlayerId || 'none';
        let discStr = d.dismissalType || 'out';
        if (d.fielderPlayerId && d.fielderPlayerId !== 'none') {
          if (discStr === 'caught') discStr = `c Fielder b Bowler`; 
          else if (discStr === 'runout') discStr = `run out (Fielder)`;
          else if (discStr === 'stumped') discStr = `st Fielder b Bowler`;
        }
        bat[outPid].dismissal = discStr;
      }
      
      const overLabel = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
      fow.push({ wicketNum: currentWickets, scoreAtWicket: currentScore, playerOutId: outPid, over: overLabel, runsOut: bat[outPid]?.runs || 0 });
      
      partnerships.push({ ...currentPartnership, batters: Object.keys(currentPartnership.contributions), isUnbroken: false });
      currentPartnership = { runs: 0, balls: 0, contributions: {}, isUnbroken: true };
    }

    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
        bowl[bId].wickets += 1;
      }
      if (isLegal) {
        bowl[bId].balls += 1;
        if (d.totalRunsOnDelivery === 0) bowl[bId].dots += 1;
      }
    }
  });

  if (currentPartnership.runs > 0 || currentPartnership.balls > 0 || Object.keys(currentPartnership.contributions).length > 0) {
    partnerships.push({ ...currentPartnership, batters: Object.keys(currentPartnership.contributions) });
  }

  extras.total = extras.w + extras.nb;
  const oversCompleted = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;
  const totalOversDec = oversCompleted + (ballsInOver / 6);
  const rr = totalOversDec > 0 ? (currentScore / totalOversDec).toFixed(2) : '0.00';

  const didNotBat = squadIds.filter(id => !battingOrder.includes(id));

  return {
    batting: battingOrder.map(id => bat[id]).filter(Boolean),
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
    overs: `${oversCompleted}.${ballsInOver}`,
    rr,
    didNotBat
  };
};

export const generateMatchReport = (match: any, teamNames: Record<string, string>, playerNames: Record<string, string>, inn1: any, inn2: any, stats1: any, stats2: any) => {
  const dateStr = match.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---';
  const formatStr = `${match.totalOvers} OV MATCH`;
  const venueStr = match.venue || 'NOT SPECIFIED';
  const potmName = match.potmPlayerId ? (playerNames[match.potmPlayerId] || 'Unknown Player') : 'NOT DECLARED';

  const renderInning = (innNum: number, teamId: string, stats: any) => {
    const title = `${innNum}${innNum === 1 ? 'ST' : '2ND'} INN: ${teamNames[teamId] || 'TEAM'}`;
    const scoreText = `${stats.total}/${stats.wickets} (${stats.overs})`;

    return `
      <div class="inning-section">
        <div class="inning-header">
          <span class="inning-title">${title}</span>
          <span class="inning-score-top">${scoreText}</span>
        </div>
        
        <table class="batting-table">
          <thead>
            <tr>
              <th style="width: 40%">BATTER</th>
              <th class="text-right">R</th>
              <th class="text-right">B</th>
              <th class="text-right">DOT</th>
              <th class="text-right">4S</th>
              <th class="text-right">6S</th>
              <th class="text-right">SR</th>
            </tr>
          </thead>
          <tbody>
            ${stats.batting.map((b: any) => {
              let dismissalStr = b.out ? b.dismissal : 'NOT OUT';
              if (b.fielderId && b.fielderId !== 'none') {
                dismissalStr = dismissalStr.replace('Fielder', playerNames[b.fielderId] || 'Fielder');
              }
              
              return `
                <tr>
                  <td>
                    <div class="player-name-cell">${playerNames[b.id] || 'Unknown'}</div>
                    <div class="dismissal-sub">${dismissalStr}</div>
                  </td>
                  <td class="text-right bold">${b.runs}</td>
                  <td class="text-right dim">${b.balls}</td>
                  <td class="text-right dim">${b.dots || 0}</td>
                  <td class="text-right dim">${b.fours}</td>
                  <td class="text-right dim">${b.sixes}</td>
                  <td class="text-right dim">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
                </tr>
              `;
            }).join('')}
            <tr class="summary-row-item">
              <td class="bold" style="font-size: 10px;">EXTRAS: ${stats.extras.total} (w ${stats.extras.w}, nb ${stats.extras.nb})</td>
              <td colspan="6" class="text-right bold highlight-text" style="font-size: 11px;">
                TOTAL: ${stats.total}/${stats.wickets} (${stats.overs} Overs, RR: ${stats.rr})
              </td>
            </tr>
          </tbody>
        </table>

        ${stats.didNotBat.length > 0 ? `
          <div class="dnb-section">
            <span class="dnb-label">DID NOT BAT:</span>
            <span class="dnb-players">${stats.didNotBat.map((id: string) => playerNames[id]).join(', ')}</span>
          </div>
        ` : ''}

        <div class="stats-compact-grid">
          <div class="stats-compact-col">
            <div class="sub-section-title">FALL OF WICKETS</div>
            <div class="fow-container">
              ${stats.fow.length > 0 ? stats.fow.map((f: any) => `
                <div class="fow-entry"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${playerNames[f.playerOutId]?.split(' ')[0]} ${f.runsOut}, ${f.over} ov)</div>
              `).join('') : '<div class="dim">NO WICKETS FELL</div>'}
            </div>
          </div>
          <div class="stats-compact-col">
            <div class="sub-section-title">PARTNERSHIPS</div>
            <div class="partnership-container">
              ${stats.partnerships.map((p: any) => {
                const involved = p.batters.map((id: string) => playerNames[id] || 'Unknown');
                const pNames = involved.length > 1 ? involved.join(' - ') : involved[0];
                const contribs = Object.entries(p.contributions)
                  .map(([id, s]: [any, any]) => `${playerNames[id]?.split(' ')[0] || 'Unknown'} ${s.runs}`)
                  .join(', ');
                return `
                  <div class="partnership-entry">
                    <div class="p-names">${pNames}</div>
                    <div class="p-details"><strong>${p.runs} (${p.balls}b)</strong> | <span class="dim">${contribs}</span></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="sub-section-title" style="margin-top: 10px;">BOWLING ANALYSIS</div>
        <table class="bowling-table">
          <thead>
            <tr>
              <th style="width: 40%">BOWLER</th>
              <th class="text-right">O</th>
              <th class="text-right">M</th>
              <th class="text-right">DOT</th>
              <th class="text-right">R</th>
              <th class="text-right">W</th>
              <th class="text-right">ECO</th>
            </tr>
          </thead>
          <tbody>
            ${stats.bowling.map((b: any) => `
              <tr>
                <td class="bold uppercase">${playerNames[b.id] || 'Unknown'}</td>
                <td class="text-right dim">${b.oversDisplay}</td>
                <td class="text-right dim">${b.maidens || 0}</td>
                <td class="text-right dim">${b.dots || 0}</td>
                <td class="text-right bold">${b.runs}</td>
                <td class="text-right bold highlight-text">${b.wickets}</td>
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; line-height: 1.1; margin: 0; }
        .container { max-width: 800px; margin: auto; background: #fff; border: 1px solid #e2e8f0; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 4px; }
        
        .main-header { text-align: center; margin-bottom: 15px; }
        .main-header h1 { margin: 0; color: #3f51b5; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
        .main-header p { margin: 4px 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

        .potm-banner { background: #f59e0b; color: #fff; padding: 8px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 15px; border-radius: 4px; }

        .summary-grid { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9; }
        .team-box { flex: 1; text-align: center; }
        .team-name { font-weight: 900; font-size: 14px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .team-score { font-weight: 900; font-size: 28px; color: #3f51b5; }
        .team-ov { font-size: 11px; color: #94a3b8; font-weight: 700; }
        .vs-divider { font-weight: 900; color: #cbd5e1; padding: 0 20px; font-size: 14px; }

        .result-text { text-align: center; font-weight: 900; font-size: 16px; color: #3f51b5; text-transform: uppercase; padding: 10px 0; margin-bottom: 20px; border-bottom: 2px solid #3f51b5; }

        .inning-section { margin-bottom: 25px; border: 1px solid #f1f5f9; border-radius: 4px; overflow: hidden; }
        .inning-header { background: #3f51b5; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 12px; text-transform: uppercase; }
        
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 8px; font-size: 9px; color: #64748b; border-bottom: 1px solid #e2e8f0; font-weight: 800; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: middle; }
        
        .player-name-cell { font-weight: 800; text-transform: uppercase; color: #1e293b; font-size: 11px; }
        .dismissal-sub { font-size: 8px; font-weight: 700; font-style: italic; color: #94a3b8; text-transform: uppercase; margin-top: 1px; }
        
        .text-right { text-align: right; }
        .bold { font-weight: 900; }
        .dim { color: #94a3b8; font-weight: 700; }
        .highlight-text { color: #3f51b5; }
        .summary-row-item td { background: #f8fafc; padding: 6px 10px; }

        .dnb-section { padding: 8px 12px; background: #fff; border-bottom: 1px solid #f1f5f9; font-size: 9px; }
        .dnb-label { font-weight: 900; color: #94a3b8; margin-right: 6px; }
        .dnb-players { font-weight: 700; color: #64748b; text-transform: uppercase; }

        .stats-compact-grid { display: flex; gap: 0; border-bottom: 1px solid #f1f5f9; }
        .stats-compact-col { flex: 1; padding: 10px; border-right: 1px solid #f1f5f9; }
        .stats-compact-col:last-child { border-right: none; }
        
        .sub-section-title { font-weight: 900; font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; padding: 4px 10px; background: #f8fafc; }
        .fow-entry { font-size: 9px; margin-bottom: 4px; color: #475569; }
        
        .partnership-entry { font-size: 9px; margin-bottom: 6px; }
        .p-names { font-weight: 800; text-transform: uppercase; color: #1e293b; }
        .p-details { margin-top: 1px; }

        .bowling-table th { background: #f8fafc; }
        .bowling-table td { font-size: 10px; }

        .footer { text-align: center; margin-top: 20px; font-size: 8px; color: #cbd5e1; font-weight: 800; text-transform: uppercase; padding-top: 10px; letter-spacing: 1px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="main-header">
          <h1>OFFICIAL MATCH SCORECARD</h1>
          <p>${dateStr} | ${venueStr} | ${formatStr}</p>
        </div>

        <div class="potm-banner">
          🏆 PLAYER OF THE MATCH: ${potmName}
        </div>

        <div class="summary-grid">
          <div class="team-box">
            <div class="team-name">${teamNames[match.team1Id] || 'TEAM 1'}</div>
            <div class="team-score">${stats1.total}/${stats1.wickets}</div>
            <div class="team-ov">${stats1.overs} OV</div>
          </div>
          <div class="vs-divider">VS</div>
          <div class="team-box">
            <div class="team-name">${teamNames[match.team2Id] || 'TEAM 2'}</div>
            <div class="team-score">${stats2.total}/${stats2.wickets}</div>
            <div class="team-ov">${stats2.overs} OV</div>
          </div>
        </div>

        <div class="result-text">${match.resultDescription}</div>

        ${renderInning(1, inn1?.battingTeamId || match.team1Id, stats1)}
        ${stats2.batting.length > 0 || stats2.total > 0 ? renderInning(2, inn2?.battingTeamId || match.team2Id, stats2) : ''}

        <div class="footer">
          GENERATED BY CRICMATES | ONE-PAGE COMPACT PRO SCORECARD
        </div>
      </div>
    </body>
    </html>
  `;
};
