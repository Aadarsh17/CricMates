/**
 * @fileOverview Utility functions for calculating match statistics and generating professional HTML reports.
 * Refined for high-density information display and minimal whitespace.
 */

export const getExtendedInningStats = (deliveries: any[]) => {
  if (!deliveries) return { batting: [], bowling: [], fow: [], partnerships: [] };
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const partnerships: any[] = [];

  let currentScore = 0;
  let currentBalls = 0;
  let currentWickets = 0;

  let currentPartnership = {
    batter1Id: '',
    batter2Id: '',
    runs: 0,
    balls: 0,
    batter1Runs: 0,
    batter2Runs: 0
  };

  deliveries.forEach((d, idx) => {
    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;
    
    if (!bat[sId]) bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
    if (nsId && !bat[nsId]) bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
    
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += d.runsScored;
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    currentScore += d.totalRunsOnDelivery;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') currentBalls += 1;

    if (!currentPartnership.batter1Id) {
      currentPartnership.batter1Id = sId;
      currentPartnership.batter2Id = nsId;
    }

    currentPartnership.runs += d.totalRunsOnDelivery;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') currentPartnership.balls += 1;
    if (sId === currentPartnership.batter1Id) {
      currentPartnership.batter1Runs += d.runsScored;
    } else {
      currentPartnership.batter2Runs += d.runsScored;
    }

    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].dismissal = d.dismissalType || 'out';
        // Capture individual score at dismissal
        bat[outPid].scoreAtDismissal = bat[outPid].runs;
      }
      
      fow.push({
        wicketNum: currentWickets,
        scoreAtWicket: currentScore,
        overs: `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`,
        playerOutId: outPid,
        playerRuns: bat[outPid]?.runs || 0
      });

      partnerships.push({...currentPartnership});
      currentPartnership = {
        batter1Id: d.batsmanOutPlayerId === currentPartnership.batter1Id ? '' : currentPartnership.batter1Id,
        batter2Id: d.batsmanOutPlayerId === currentPartnership.batter2Id ? '' : currentPartnership.batter2Id,
        runs: 0,
        balls: 0,
        batter1Runs: 0,
        batter2Runs: 0
      };
    }

    if (!bowl[d.bowlerPlayerId]) bowl[d.bowlerPlayerId] = { id: d.bowlerPlayerId, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
    bowl[d.bowlerPlayerId].runs += d.totalRunsOnDelivery;
    if (d.isWicket && d.dismissalType !== 'runout') bowl[d.bowlerPlayerId].wickets += 1;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') bowl[d.bowlerPlayerId].balls += 1;

    if (idx === deliveries.length - 1 && currentPartnership.balls > 0) {
      partnerships.push({...currentPartnership});
    }
  });

  return {
    batting: Object.values(bat),
    bowling: Object.values(bowl).map(b => ({ ...b, oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}` })),
    fow,
    partnerships
  };
};

export const generateHTMLReport = (match: any, inn1: any, inn2: any, stats1: any, stats2: any, teams: any[], players: any[]) => {
  const getTeam = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown Team';
  const getPlayer = (id: string) => players.find(p => p.id === id)?.name || 'Unknown Player';

  const renderBattingTable = (batting: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 12px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569;">Batter</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">B</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">4s</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">6s</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 8px; font-size: 12px; font-weight: 500;">
              ${getPlayer(b.id)} 
              <span style="font-size: 9px; color: #94a3b8; font-weight: normal; margin-left: 4px;">(${b.out ? b.dismissal : 'not out'})</span>
            </td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-size: 12px;">${b.runs}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px; color: #64748b;">${b.balls}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px; color: #64748b;">${b.fours}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px; color: #64748b;">${b.sixes}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #94a3b8; font-weight: 600;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 12px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569;">Bowler</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">O</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">M</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">W</th>
          <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #475569;">Econ</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 8px; font-size: 12px; font-weight: 500;">${getPlayer(b.id)}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px;">${b.oversDisplay}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px;">${b.maidens || 0}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 12px; font-weight: 600;">${b.runs}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #ef4444; font-size: 12px;">${b.wickets}</td>
            <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #94a3b8;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderFowTable = (fow: any[]) => `
    <div style="margin-bottom: 12px; padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #f1f5f9;">
      <h4 style="font-size: 9px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; letter-spacing: 0.5px;">Fall of Wickets (Score-Wicket)</h4>
      <div style="font-size: 11px; color: #1e293b; line-height: 1.5;">
        ${fow.map(f => `<strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${getPlayer(f.playerOutId)} ${f.playerRuns}, ${f.overs} ov)${f.wicketNum < fow.length ? ' <span style="color:#cbd5e1; margin: 0 4px;">|</span> ' : ''}`).join('')}
        ${fow.length === 0 ? '<span style="color: #94a3b8; font-style: italic;">No wickets fallen</span>' : ''}
      </div>
    </div>
  `;

  const renderPartnershipsTable = (partnerships: any[]) => `
    <div style="margin-bottom: 15px;">
      <h4 style="font-size: 9px; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Significant Partnerships</h4>
      <table style="width:100%; border-collapse: collapse;">
        ${partnerships.map(p => `
          <tr style="border-bottom: 1px dashed #f1f5f9;">
            <td style="padding: 5px 0; font-size: 11px; width: 35%; color: #334155;">${getPlayer(p.batter1Id)} <span style="font-weight: 700; color: #1e293b;">${p.batter1Runs}</span></td>
            <td style="padding: 5px 0; text-align: center; font-weight: 800; color: #2563eb; font-size: 12px;">${p.runs} <span style="font-weight: 400; font-size: 9px; color: #94a3b8;">(${p.balls}b)</span></td>
            <td style="padding: 5px 0; text-align: right; font-size: 11px; width: 35%; color: #334155;"><span style="font-weight: 700; color: #1e293b;">${p.batter2Runs}</span> ${getPlayer(p.batter2Id)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Match Report - ${getTeam(match.team1Id)} vs ${getTeam(match.team2Id)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.4; color: #1e293b; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #fff; }
        .header { text-align: center; border-bottom: 4px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { margin: 0; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; font-size: 20px; font-weight: 900; }
        .match-card { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .inning-header { background: #1e40af; color: white; padding: 8px 12px; border-radius: 4px; margin: 24px 0 12px 0; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; display: flex; justify-content: space-between; align-items: center; }
        .result-bar { font-size: 16px; font-weight: 900; color: #dc2626; margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
        .team-score-title { font-size: 14px; font-weight: 800; color: #334155; margin-bottom: 2px; }
        .team-score-value { font-size: 24px; font-weight: 900; color: #1e40af; }
        .toss-info { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 8px; text-align: center; }
        footer { margin-top: 40px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #94a3b8; font-size: 10px; }
        @media print { body { padding: 0; } .match-card { border: 1px solid #cbd5e1; box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CRICMATES OFFICIAL SCORECARD</h1>
        <div style="margin-top: 4px; font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase;">
          ${new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          <span style="margin: 0 8px; color: #cbd5e1;">|</span>
          ${match.totalOvers} OVERS MATCH
        </div>
      </div>
      
      <div class="match-card">
        <div style="display: flex; justify-content: space-around; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <div class="team-score-title">${getTeam(match.team1Id)}</div>
            <div class="team-score-value">${inn1?.score || 0}/${inn1?.wickets || 0}</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 700;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver || 0} OV</div>
          </div>
          <div style="font-weight: 900; font-size: 16px; color: #e2e8f0;">VS</div>
          <div style="text-align: center; flex: 1;">
            <div class="team-score-title">${getTeam(match.team2Id)}</div>
            <div class="team-score-value">${inn2?.score || 0}/${inn2?.wickets || 0}</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 700;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver || 0} OV</div>
          </div>
        </div>
        <div class="result-bar">${match.resultDescription}</div>
        <div class="toss-info">
          Toss: ${getTeam(match.tossWinnerTeamId)} won & elected to ${match.tossDecision}
        </div>
      </div>

      <div class="inning-section">
        <div class="inning-header">
          <span>1ST INNINGS: ${getTeam(inn1?.battingTeamId)}</span>
          <span style="opacity: 0.9;">${inn1?.score}/${inn1?.wickets} (${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats1.batting)}
        ${renderFowTable(stats1.fow)}
        ${renderPartnershipsTable(stats1.partnerships)}
        
        <div class="inning-header" style="background: #334155;">1ST INNINGS BOWLING: ${getTeam(inn1?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats1.bowling)}
      </div>

      <div class="inning-section">
        <div class="inning-header">
          <span>2ND INNINGS: ${getTeam(inn2?.battingTeamId)}</span>
          <span style="opacity: 0.9;">${inn2?.score}/${inn2?.wickets} (${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats2.batting)}
        ${renderFowTable(stats2.fow)}
        ${renderPartnershipsTable(stats2.partnerships)}
        
        <div class="inning-header" style="background: #334155;">2ND INNINGS BOWLING: ${getTeam(inn2?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats2.bowling)}
      </div>

      <footer>
        <p style="margin-bottom: 2px; font-weight: 700;">Generated by CricMates Professional Scoring Suite</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} CricMates Digital. Ball-by-Ball Precision Records.</p>
      </footer>
    </body>
    </html>
  `;
};
