import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, ResponsiveContainer, Cell
} from "recharts";
import { getOverview, getHeroStats, getDuration, getRecent } from "../api/client";
import TipBox from "./TipBox";

interface Props { accountId: number; provider: string; }

const AXIS = { fill: "#6b7284", fontSize: 11 };
const tooltipStyle = {
  background: "#1b1f2a",
  border: "1px solid #2a3040",
  borderRadius: 8,
  color: "#e9ecf1",
  fontSize: 13
};

export default function Dashboard({ accountId, provider }: Props) {
  const [overview, setOverview] = useState<any>(null);
  const [heroes,   setHeroes]   = useState<any[]>([]);
  const [duration, setDuration] = useState<any[]>([]);
  const [recent,   setRecent]   = useState<any[]>([]);

  useEffect(() => {
    getOverview(accountId).then(setOverview).catch(() => {});
    getHeroStats(accountId).then(setHeroes).catch(() => {});
    getDuration(accountId).then(setDuration).catch(() => {});
    getRecent(accountId).then(r => setRecent([...r].reverse())).catch(() => {});
  }, [accountId]);

  const wr = overview ? Number(overview.win_rate) : null;
  const heroData = heroes.filter(h => h.games >= 3).slice(0, 12);

  return (
    <div className="fade-in">
      <TipBox accountId={accountId} provider={provider} />

      {overview && (
        <div className="stat-grid">
          <div className="stat">
            <div className="val">{overview.total_games ?? "—"}</div>
            <div className="lbl">Games</div>
          </div>
          <div className="stat">
            <div className={`val ${wr != null && wr >= 50 ? "good" : "bad"}`}>
              {overview.win_rate ?? "—"}%
            </div>
            <div className="lbl">Win rate</div>
          </div>
          <div className="stat">
            <div className="val gold">{overview.avg_gpm ?? "—"}</div>
            <div className="lbl">Avg GPM</div>
          </div>
          <div className="stat">
            <div className="val">
              {overview.avg_kills ?? "—"} / {overview.avg_deaths ?? "—"}
            </div>
            <div className="lbl">Avg K / D</div>
          </div>
          <div className="stat">
            <div className="val good">{overview.total_wins ?? "—"}</div>
            <div className="lbl">Wins</div>
          </div>
        </div>
      )}

      <div className="section-title">Win rate by hero</div>
      <div className="card chart-card">
        <h3>Best heroes <span style={{ color: "#6b7284", fontWeight: 400, fontSize: 13 }}>(min 3 games)</span></h3>
        {heroData.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={heroData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#20263300" vertical={false} />
              <XAxis dataKey="hero" tick={AXIS} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis domain={[0, 100]} tick={AXIS} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} formatter={(v: any) => [`${v}%`, "win rate"]} />
              <Bar dataKey="win_rate" radius={[5, 5, 0, 0]}>
                {heroData.map((h, i) => (
                  <Cell key={i} fill={h.win_rate >= 50 ? "#46d17f" : "#f2635f"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-title">Game phase</div>
      <div className="card chart-card">
        <h3>Win rate by game duration</h3>
        {duration.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={duration} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="bucket" tick={AXIS} />
              <YAxis domain={[0, 100]} tick={AXIS} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} formatter={(v: any) => [`${v}%`, "win rate"]} />
              <Bar dataKey="win_rate" radius={[5, 5, 0, 0]} fill="#5b9df0" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-title">Trend</div>
      <div className="card chart-card">
        <h3>GPM over recent matches</h3>
        {recent.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recent} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis hide />
              <YAxis tick={AXIS} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#ffffff20" }} formatter={(v: any) => [v, "GPM"]} />
              <Line type="monotone" dataKey="gpm" stroke="#f0a830" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ padding: "34px 0", textAlign: "center", color: "#6b7284", fontSize: 13.5 }}>
      No match data yet — this player may be private, or the sync is still running.
    </div>
  );
}
