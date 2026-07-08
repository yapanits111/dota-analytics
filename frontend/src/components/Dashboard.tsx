import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, ResponsiveContainer, Cell
} from "recharts";
import {
  getOverview, getHeroStats, getDuration, getAttributes, getRoles, getRecent
} from "../api/client";
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

// Dota-style attribute colours
const ATTR_COLOR: Record<string, string> = {
  Strength:     "#e2585a",
  Agility:      "#5fbf6b",
  Intelligence: "#4aa3e0",
  Universal:    "#c98bdb",
  Unknown:      "#6b7284"
};

type Status = "loading" | "ready" | "empty";

export default function Dashboard({ accountId, provider }: Props) {
  const [status,   setStatus]   = useState<Status>("loading");
  const [overview, setOverview] = useState<any>(null);
  const [heroes,   setHeroes]   = useState<any[]>([]);
  const [duration, setDuration] = useState<any[]>([]);
  const [attrs,    setAttrs]    = useState<any[]>([]);
  const [roles,    setRoles]    = useState<any[]>([]);
  const [recent,   setRecent]   = useState<any[]>([]);

  // The player's match history syncs in the background after selection, so the
  // data may not exist yet on first load. Poll the overview until matches appear
  // (or give up after ~2 min and show the "no public data" state).
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 24;   // ~2 min at 5s
    setStatus("loading");
    setOverview(null); setHeroes([]); setDuration([]);
    setAttrs([]); setRoles([]); setRecent([]);

    const loadCharts = () => {
      getHeroStats(accountId).then(d => alive && setHeroes(d)).catch(() => {});
      getDuration(accountId).then(d => alive && setDuration(d)).catch(() => {});
      getAttributes(accountId).then(d => alive && setAttrs(d)).catch(() => {});
      getRoles(accountId).then(d => alive && setRoles(d.slice(0, 7))).catch(() => {});
      getRecent(accountId).then(r => alive && setRecent([...r].reverse())).catch(() => {});
    };

    const poll = () => {
      getOverview(accountId)
        .then(o => {
          if (!alive) return;
          if (o && Number(o.total_games) > 0) {
            setOverview(o);
            loadCharts();
            setStatus("ready");
          } else if (++attempts < MAX_ATTEMPTS) {
            setTimeout(poll, 5000);
          } else {
            setStatus("empty");
          }
        })
        .catch(() => {
          if (!alive) return;
          if (++attempts < MAX_ATTEMPTS) setTimeout(poll, 5000);
          else setStatus("empty");
        });
    };

    poll();
    return () => { alive = false; };
  }, [accountId]);

  const wr = overview ? Number(overview.win_rate) : null;
  const heroData = heroes.filter(h => h.games >= 3).slice(0, 12);

  if (status === "loading") {
    return (
      <div className="fade-in sync-state">
        <span className="spinner" />
        <h3>Syncing match history…</h3>
        <p>
          Pulling this player's recent matches from OpenDota and crunching the
          numbers. This takes up to a minute (the free backend also wakes from
          sleep on the first request). The dashboard loads automatically when
          it's ready — no need to refresh.
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="fade-in sync-state">
        <div style={{ fontSize: 34 }}>🔒</div>
        <h3>No public match data</h3>
        <p>
          We couldn't find public matches for this account. In Dota 2, players
          must turn on <strong>Settings → Options → Advanced → Expose Public
          Match Data</strong> for their history to be visible. Try another player.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <TipBox accountId={accountId} provider={provider} />

      <div className="stat-grid">
        <Stat val={overview.total_games ?? "—"} lbl="Games" />
        <Stat val={`${overview.win_rate ?? "—"}%`} lbl="Win rate"
              cls={wr != null && wr >= 50 ? "good" : "bad"} />
        <Stat val={overview.avg_gpm ?? "—"} lbl="Avg GPM" cls="gold" />
        <Stat val={`${overview.avg_kills ?? "—"} / ${overview.avg_deaths ?? "—"}`} lbl="Avg K / D" />
        <Stat val={overview.total_wins ?? "—"} lbl="Wins" cls="good" />
      </div>

      <Section title="Win rate by hero" />
      <div className="card chart-card">
        <h3>Best heroes <span className="dim">(min 3 games)</span></h3>
        {heroData.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={heroData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="hero" tick={AXIS} interval={0} angle={-18} textAnchor="end" height={54} />
                <YAxis domain={[0, 100]} tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }}
                         formatter={(v: any, _n, p: any) => [`${v}%  ·  ${p.payload.games} games`, "win rate"]} />
                <Bar dataKey="win_rate" radius={[5, 5, 0, 0]}>
                  {heroData.map((h, i) => (
                    <Cell key={i} fill={h.win_rate >= 50 ? "#46d17f" : "#f2635f"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="caption">
              Win rate on each hero you’ve played at least 3 times. Green = winning
              record, red = losing. Hover for the game count.
            </p>
          </>
        )}
      </div>

      <Section title="Hero type" />
      <div className="card chart-card">
        <h3>Win rate by attribute</h3>
        {attrs.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={attrs} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="attribute" tick={AXIS} />
                <YAxis domain={[0, 100]} tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }}
                         formatter={(v: any, _n, p: any) => [`${v}%  ·  ${p.payload.games} games`, "win rate"]} />
                <Bar dataKey="win_rate" radius={[5, 5, 0, 0]}>
                  {attrs.map((a, i) => (
                    <Cell key={i} fill={ATTR_COLOR[a.attribute] || "#6b7284"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="caption">
              Grouped by each hero’s primary attribute — Strength, Agility,
              Intelligence, or Universal. Shows which hero types suit your playstyle.
            </p>
          </>
        )}
      </div>

      <Section title="Role" />
      <div className="card chart-card">
        <h3>Win rate by role</h3>
        {roles.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={roles} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="role" tick={AXIS} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }}
                         formatter={(v: any, _n, p: any) => [`${v}%  ·  ${p.payload.games} games`, "win rate"]} />
                <Bar dataKey="win_rate" radius={[5, 5, 0, 0]} fill="#e2402f" />
              </BarChart>
            </ResponsiveContainer>
            <p className="caption">
              Win rate for Carry, Support, Nuker, etc. Heroes fill several roles,
              so a match counts toward each of its hero’s roles — read this as a
              directional signal (e.g. do you win more on supports or carries?),
              not exact position tracking.
            </p>
          </>
        )}
      </div>

      <Section title="Game phase" />
      <div className="card chart-card">
        <h3>Win rate by game duration</h3>
        {duration.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={duration} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="bucket" tick={AXIS} />
                <YAxis domain={[0, 100]} tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }}
                         formatter={(v: any, _n, p: any) => [`${v}%  ·  ${p.payload.games} games`, "win rate"]} />
                <Bar dataKey="win_rate" radius={[5, 5, 0, 0]} fill="#5b9df0" />
              </BarChart>
            </ResponsiveContainer>
            <p className="caption">
              How you do in short vs long matches. A low late-game rate can mean
              you close out leads slowly; a low early rate can mean weak laning.
            </p>
          </>
        )}
      </div>

      <Section title="Trend" />
      <div className="card chart-card">
        <h3>GPM over recent matches</h3>
        {recent.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={recent} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis hide />
                <YAxis tick={AXIS} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#ffffff20" }} formatter={(v: any) => [v, "GPM"]} />
                <Line type="monotone" dataKey="gpm" stroke="#f0a830" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="caption">
              Gold per minute across recent games (oldest → newest). Heads-up: GPM
              depends heavily on role — a support naturally farms far less than a
              carry, so dips often reflect hero choice, not a slump.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ val, lbl, cls }: { val: any; lbl: string; cls?: string }) {
  return (
    <div className="stat">
      <div className={`val ${cls || ""}`}>{val}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div className="section-title">{title}</div>;
}

function Empty() {
  return (
    <div style={{ padding: "34px 0", textAlign: "center", color: "#6b7284", fontSize: 13.5 }}>
      No match data yet — this player may be private, or the sync is still running.
    </div>
  );
}
