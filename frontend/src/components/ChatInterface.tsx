import { useState } from "react";
import { chatQuery } from "../api/client";
import SuggestedQuestions from "./SuggestedQuestions";

interface Message {
  role:      "user" | "assistant";
  content:   string;
  sql?:      string;
  provider?: string;
}

interface Props {
  accountId: number;
  provider:  string;
}

export default function ChatInterface({ accountId, provider }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const send = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await chatQuery(q, accountId, provider);
      setMessages(m => [
        ...m,
        {
          role:     "assistant",
          content:  res.insight || res.error || "No answer returned.",
          sql:      res.sql,
          provider: res.provider
        }
      ]);
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: "Something went wrong reaching the server." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {messages.length === 0 && (
        <SuggestedQuestions accountId={accountId} provider={provider} onSelect={send} />
      )}

      {messages.length > 0 && (
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">
                {m.role === "user" ? "You" : `Analyst · ${m.provider ?? provider}`}
              </span>
              <div className="bubble">
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant">
              <span className="who">Analyst · {provider}</span>
              <div className="bubble">
                <span className="thinking">
                  Thinking<span className="dots"><span/><span/><span/></span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="chat-input-row">
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask anything about your Dota 2 stats…"
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading}>
          Ask
        </button>
      </div>
    </div>
  );
}
