import { formatCurrency, formatDateTime } from './formatters';
import type { ConsoleInstanceStat, GameStat, TopPlayerStat } from './types';

interface AnalyticsRankingsProps {
  consoleInstances: ConsoleInstanceStat[];
  games: GameStat[];
  topPlayers: TopPlayerStat[];
}

export default function AnalyticsRankings({
  consoleInstances,
  games,
  topPlayers,
}: AnalyticsRankingsProps) {
  const maxGameSessions = Math.max(...games.map((game) => game.sessionsPlayed), 1);

  return (
    <div className="analytics-detail-grid">
      <article className="analytics-panel analytics-table-panel">
        <header>
          <div><span className="analytics-eyebrow">Hardware</span><h3>Console performance</h3></div>
          <span>{consoleInstances.length} stations</span>
        </header>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead><tr><th>Station</th><th>Sessions</th><th>Players</th><th>Hours</th><th>Revenue</th><th>Utilization</th></tr></thead>
            <tbody>
              {consoleInstances.map((instance) => (
                <tr key={instance.setupInstanceId}>
                  <td><strong>{instance.instanceName}</strong><span>{instance.consoleType} · {instance.configurationName}</span></td>
                  <td>{instance.sessions}</td>
                  <td>{instance.playerVisits}</td>
                  <td>{instance.totalOperatingHours.toFixed(2)}</td>
                  <td>{formatCurrency(instance.revenue)}</td>
                  <td>
                    <div className="analytics-utilization">
                      <span><i style={{ width: `${Math.min(instance.utilizationPercent, 100)}%` }} /></span>
                      {instance.utilizationPercent.toFixed(1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="analytics-panel">
        <header><div><span className="analytics-eyebrow">Loyalty</span><h3>Top players</h3></div></header>
        <div className="analytics-player-list">
          {topPlayers.slice(0, 6).map((player, index) => (
            <div className="analytics-player" key={`${player.phoneNumber}-${index}`}>
              <span className="analytics-rank">{index + 1}</span>
              <div><strong>{player.name}</strong><span>{player.phoneNumber} · {player.favoriteGame?.name || 'No favorite yet'}</span></div>
              <div><strong>{formatCurrency(player.totalSpent)}</strong><span>{player.sessionsPlayed} sessions · {player.totalHours.toFixed(1)}h</span></div>
            </div>
          ))}
          {topPlayers.length === 0 && <div className="analytics-empty">No player activity for this range</div>}
        </div>
      </article>

      <article className="analytics-panel">
        <header><div><span className="analytics-eyebrow">Engagement</span><h3>Most played games</h3></div></header>
        <div className="analytics-game-list">
          {games.slice(0, 8).map((game) => (
            <div className="analytics-game" key={game.gameId}>
              <div><strong>{game.name}</strong><span>{game.playerExposures} player exposures · {game.sessionHours.toFixed(1)}h</span></div>
              <strong>{game.sessionsPlayed}</strong>
              <span className="analytics-game-bar"><i style={{ width: `${(game.sessionsPlayed / maxGameSessions) * 100}%` }} /></span>
              <small>Last played {formatDateTime(game.lastPlayedAt)}</small>
            </div>
          ))}
          {games.length === 0 && <div className="analytics-empty">No games played for this range</div>}
        </div>
      </article>
    </div>
  );
}
