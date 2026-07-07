import { useEffect, useState } from "react";
import { getSuggestions } from "../api/client";

interface Props {
  accountId: number;
  provider:  string;
  onSelect:  (q: string) => void;
}

export default function SuggestedQuestions({ accountId, provider, onSelect }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let alive = true;
    setQuestions([]);
    setLoading(true);
    getSuggestions(accountId, provider)
      .then(d => alive && setQuestions(d.suggestions || []))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [accountId, provider]);

  if (loading) {
    return (
      <div className="suggestions">
        <div className="thinking">
          Generating suggestions<span className="dots"><span/><span/><span/></span>
        </div>
      </div>
    );
  }

  if (!questions.length) return null;

  return (
    <div className="suggestions">
      <div className="lbl">Try asking</div>
      <div className="suggestion-chips">
        {questions.map((q, i) => (
          <button key={i} className="suggestion" onClick={() => onSelect(q)}>
            <span className="q-ico">›</span> {q}
          </button>
        ))}
      </div>
    </div>
  );
}
