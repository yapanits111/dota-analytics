import { useEffect, useState } from "react";
import { getTip } from "../api/client";

interface Props { accountId: number; provider: string; }

export default function TipBox({ accountId, provider }: Props) {
  const [tip,     setTip]     = useState("");
  const [error,   setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setTip("");
    setError(false);
    setLoading(true);
    getTip(accountId, provider)
      .then(d => {
        if (!alive) return;
        if (d.error) setError(true);
        setTip(d.tip);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [accountId, provider]);

  if (loading) {
    return (
      <div className="tip">
        <div className="tip-head">💡 Performance tip</div>
        <div className="thinking">
          Analyzing your matches<span className="dots"><span/><span/><span/></span>
        </div>
      </div>
    );
  }

  if (!tip) return null;

  return (
    <div className={`tip ${error ? "err" : ""}`}>
      <div className="tip-head">{error ? "⚠️ Heads up" : "💡 Performance tip"}</div>
      <p>{tip}</p>
    </div>
  );
}
