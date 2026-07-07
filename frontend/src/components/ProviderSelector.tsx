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

  useEffect(() => {
    getProviders().then(d => setConfigured(d.configured)).catch(() => {});
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
