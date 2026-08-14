import { useEffect, useState } from "react";
import { getProviders } from "../api/client";

interface Props {
  value: string;
  onChange: (provider: string) => void;
}

const LABELS: Record<string, string> = {
  gemini: "Gemini",
  groq:   "Groq",
  claude: "Claude"
};

export default function ProviderSelector({ value, onChange }: Props) {
  const [configured, setConfigured] = useState<string[]>([]);

  // The free backend sleeps when idle, so the first request can fail while it
  // wakes (~50s). Retry until it answers, otherwise every provider would stay
  // locked until a manual reload.
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const load = () => {
      getProviders()
        .then(d => { if (alive) setConfigured(d.configured || []); })
        .catch(() => { if (alive && attempts++ < 15) setTimeout(load, 4000); });
    };
    load();
    return () => { alive = false; };
  }, []);

  return (
    <div className="provider-group">
      <span className="lbl">LLM</span>
      {["gemini", "groq", "claude"].map(p => {
        const isConfigured = configured.includes(p);
        const isActive     = value === p;
        return (
          <button
            key={p}
            className={`chip ${isActive ? "active" : ""} ${isConfigured ? "" : "locked"}`}
            onClick={() => isConfigured && onChange(p)}
            title={isConfigured ? LABELS[p] : `${LABELS[p]} — add an API key to enable`}
          >
            {LABELS[p]}
            {!isConfigured && " 🔒"}
          </button>
        );
      })}
    </div>
  );
}
