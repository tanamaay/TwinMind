"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";
import styles from "@/app/app.module.css";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isSending: boolean;
};

export function ChatPanel({ messages, onSend, isSending }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className={styles.panelBody} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingRight: 6 }}>
        {messages.length === 0 ? (
          <div className={styles.muted}>Click a suggestion or ask a question.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div className={styles.muted}>
                {new Date(m.createdAt).toLocaleTimeString()} · {m.role}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.content}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          onSend(trimmed);
          setText("");
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question..."
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(127,127,127,0.35)",
            background: "transparent",
            color: "inherit",
          }}
          disabled={isSending}
        />
        <button className={styles.btnPrimary} type="submit" disabled={isSending} style={{ padding: "10px 12px" }}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

