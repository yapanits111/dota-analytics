import { useState } from "react";
import { searchPlayer, syncPlayer, getAccountProfile } from "../api/client";

interface Player { account_id: number; personaname: string; last_match_time?: string; }
interface Props  { onPlayerSelect: (id: number, name: string) => void; }

export default function PlayerSearch({ onPlayerSelect }: Props) {
  const [q,         setQ]         = useState("");
  const [results,   setResults]   = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [error,     setError]     = useState("");
  const [searched,  setSearched]  = useState(false);

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    // Allow entering a raw OpenDota account ID directly. This bypasses the
    // sometimes-flaky OpenDota name search and works for private-name profiles.
    if (/^\d+$/.test(term)) {
      setError("");
      setResults([]);
      setSearched(true);
      setSearching(true);
      try {
        const p = await getAccountProfile(Number(term));
        setResults([{ account_id: Number(term), personaname: p.personaname }]);
      } catch {
        setResults([{ account_id: Number(term), personaname: `Account ${term}` }]);
      } finally {
        setSearching(false);
      }
      return;
    }
    setSearching(true);
    setError("");
    setResults([]);
    setSearched(false);
    try {
      const data = await searchPlayer(term);
      setResults(data);
      setSearched(true);
    } catch (e: any) {
      setError(
        "OpenDota didn't respond (it rate-limits search). Wait a few seconds and try again."
      );
    } finally {
      setSearching(false);
    }
  };

  const select = async (p: Player) => {
    setSyncing(true);
    setResults([]);
    setSearched(false);
    setError("");
    try {
      await syncPlayer(p.account_id);
    } catch {
      /* sync runs in the background; ignore transient errors here */
    }
    setSyncing(false);
    onPlayerSelect(p.account_id, p.personaname);
  };

  return (
    <div className="hero fade-in">
      <h2>Know your <span className="accent">Dota&nbsp;2</span> game</h2>
      <p>
        Search a Steam name to pull your match history, then ask anything about
        your performance in plain English — answered by AI over your real data.
      </p>

      <div className="search-row">
        <input
          className="input"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Steam username or OpenDota account ID"
          autoFocus
        />
        <button className="btn btn-primary" onClick={search} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searching && (
        <div className="loading"><span className="spinner" /> Searching OpenDota…</div>
      )}
      {error && <p className="error-text">{error}</p>}
      {searched && !error && results.length === 0 && (
        <p className="hint">
          No players found for “{q}”. Try the exact in-game name (e.g. “yapanits”,
          not “yapanits_111”), or paste your numeric account ID.
        </p>
      )}
      {syncing && (
        <div className="loading">
          <span className="spinner" /> Syncing match history in the background…
        </div>
      )}
      {!searched && !searching && !syncing && (
        <p className="hint">Tip: you can paste an OpenDota account ID directly (e.g. 70388657).</p>
      )}

      {results.length > 0 && (
        <div className="result-list">
          {results.map(p => (
            <button key={p.account_id} className="result-item" onClick={() => select(p)}>
              <span>{p.personaname}</span>
              <span className="id">id {p.account_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
