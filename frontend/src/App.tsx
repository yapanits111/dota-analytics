import { useState } from "react";
import PlayerSearch      from "./components/PlayerSearch";
import Dashboard         from "./components/Dashboard";
import ChatInterface     from "./components/ChatInterface";
import ProviderSelector  from "./components/ProviderSelector";

type Tab = "dashboard" | "chat";

export default function App() {
  const [player,   setPlayer]   = useState<{ id: number; name: string } | null>(null);
  const [tab,      setTab]      = useState<Tab>("dashboard");
  const [provider, setProvider] = useState("groq");

  const initial = player?.name?.trim()?.[0]?.toUpperCase() || "?";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⚔️</span>
          Dota&nbsp;2 <span className="accent">Analytics</span>
        </div>
        <ProviderSelector value={provider} onChange={setProvider} />
      </header>

      <main className="container">
        {!player && (
          <PlayerSearch
            onPlayerSelect={(id, name) => {
              setPlayer({ id, name });
              setTab("dashboard");
            }}
          />
        )}

        {player && (
          <div className="fade-in">
            <div className="player-head">
              <div className="avatar">{initial}</div>
              <div>
                <h2>{player.name}</h2>
                <div className="sub">account id {player.id}</div>
              </div>
              <div className="tabs">
                <button
                  className={`tab ${tab === "dashboard" ? "active" : ""}`}
                  onClick={() => setTab("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`tab ${tab === "chat" ? "active" : ""}`}
                  onClick={() => setTab("chat")}
                >
                  Ask a question
                </button>
                <button
                  className="tab"
                  onClick={() => setPlayer(null)}
                  title="Search a different player"
                >
                  ↺ New search
                </button>
              </div>
            </div>

            {tab === "dashboard" && (
              <Dashboard accountId={player.id} provider={provider} />
            )}
            {tab === "chat" && (
              <ChatInterface accountId={player.id} provider={provider} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
