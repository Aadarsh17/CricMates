/**
 * @fileOverview Utility functions for calculating match statistics and generating HTML reports.
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
      }
      fow.push({
        wicketNum: currentWickets,
        score: currentScore,
        overs: `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`,
        playerOutId: outPid
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
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
          <th style="padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase;">Batter</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">R</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">B</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">4s</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">6s</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;">${getPlayer(b.id)}<br><small style="color: #888;">${b.out ? b.dismissal : 'not out'}</small></td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 13px;">${b.runs}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.balls}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.fours}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.sixes}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
          <th style="padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase;">Bowler</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">O</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">M</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">R</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">W</th>
          <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase;">Econ</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;">${getPlayer(b.id)}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.oversDisplay}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.maidens || 0}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.runs}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #d9534f; font-size: 13px;">${b.wickets}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderFowTable = (fow: any[]) => `
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Fall of Wickets</h4>
      <div style="font-size: 12px; color: #333;">
        ${fow.map(f => `<strong>${f.wicketNum}-${f.score}</strong> (${getPlayer(f.playerOutId)}, ${f.overs} ov)${f.wicketNum < fow.length ? ', ' : ''}`).join('')}
        ${fow.length === 0 ? 'No wickets fallen' : ''}
      </div>
    </div>
  `;

  const renderPartnershipsTable = (partnerships: any[]) => `
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Partnerships</h4>
      <table style="width:100%; border-collapse: collapse;">
        ${partnerships.map(p => `
          <tr style="border-bottom: 1px dashed #eee; font-size: 12px;">
            <td style="padding: 8px 0; color: #666;">${getPlayer(p.batter1Id)} <span style="font-weight: bold; color: #333;">${p.batter1Runs}</span></td>
            <td style="padding: 8px 0; text-align: center; font-weight: black; color: #0056b3;">${p.runs} (${p.balls})</td>
            <td style="padding: 8px 0; text-align: right; color: #666;"><span style="font-weight: bold; color: #333;">${p.batter2Runs}</span> ${getPlayer(p.batter2Id)}</td>
          </tr>
        `).join('')}
        ${partnerships.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding: 10px; color: #888;">No partnerships recorded</td></tr>' : ''}
      </table>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Match Report - ${getTeam(match.team1Id)} vs ${getTeam(match.team2Id)}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 30px; border: 1px solid #eee; background-color: #fff; }
        .header { text-align: center; border-bottom: 3px solid #0056b3; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { margin: 0; color: #0056b3; text-transform: uppercase; letter-spacing: 2px; font-size: 24px; }
        .match-info { background: #f4f7f6; padding: 25px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e1e8e6; }
        .inning-section { margin-top: 40px; }
        .inning-header { background: #0056b3; color: white; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        .result { font-size: 1.6em; font-weight: 800; color: #d9534f; margin-top: 20px; border-top: 2px dashed #ccc; padding-top: 15px; text-transform: uppercase; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media print { body { padding: 0; border: none; } .match-info { border: 1px solid #ccc; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CricMates Match Report</h1>
        <p style="margin: 8px 0; font-weight: bold; color: #555;">${new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p style="margin: 0; color: #888; font-size: 12px; text-transform: uppercase; font-weight: bold;">${match.totalOvers} Overs Match</p>
      </div>
      
      <div class="match-info">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <h2 style="margin:0; color: #333; font-size: 18px;">${getTeam(match.team1Id)}</h2>
            <h3 style="margin:8px 0; font-size: 28px; font-weight: 900; color: #0056b3;">${inn1?.score || 0}/${inn1?.wickets || 0}</h3>
            <p style="margin:0; font-size: 12px; color: #888; font-weight: bold;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver || 0} Overs</p>
          </div>
          <div style="font-weight: 900; font-size: 24px; color: #ddd; padding: 0 20px;">VS</div>
          <div style="text-align: center; flex: 1;">
            <h2 style="margin:0; color: #333; font-size: 18px;">${getTeam(match.team2Id)}</h2>
            <h3 style="margin:8px 0; font-size: 28px; font-weight: 900; color: #0056b3;">${inn2?.score || 0}/${inn2?.wickets || 0}</h3>
            <p style="margin:0; font-size: 12px; color: #888; font-weight: bold;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver || 0} Overs</p>
          </div>
        </div>
        <div class="result" style="text-align: center;">${match.resultDescription}</div>
        <p style="text-align: center; font-size: 12px; color: #666; margin-top: 15px; border-top: 1px solid #e1e8e6; pt: 10px;">
          <strong>Toss:</strong> ${getTeam(match.tossWinnerTeamId)} won and elected to ${match.tossDecision}
        </p>
      </div>

      <div class="inning-section">
        <div class="inning-header">1st Innings: ${getTeam(inn1?.battingTeamId)} Batting</div>
        ${renderBattingTable(stats1.batting)}
        ${renderFowTable(stats1.fow)}
        ${renderPartnershipsTable(stats1.partnerships)}
        
        <div class="inning-header">1st Innings: ${getTeam(inn1?.bowlingTeamId)} Bowling</div>
        ${renderBowlingTable(stats1.bowling)}
      </div>

      <div class="inning-section">
        <div class="inning-header">2nd Innings: ${getTeam(inn2?.battingTeamId)} Batting</div>
        ${renderBattingTable(stats2.batting)}
        ${renderFowTable(stats2.fow)}
        ${renderPartnershipsTable(stats2.partnerships)}
        
        <div class="inning-header">2nd Innings: ${getTeam(inn2?.bowlingTeamId)} Bowling</div>
        ${renderBowlingTable(stats2.bowling)}
      </div>

      <footer style="margin-top: 60px; text-align: center; border-top: 1px solid #eee; padding-top: 25px; color: #bbb; font-size: 11px;">
        <p style="margin-bottom: 5px;">This report was generated automatically by <strong>CricMates Professional Scoring Suite</strong>.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} CricMates. All Rights Reserved.</p>
      </footer>
    </body>
    </html>
  `;
};
