"use client";

import type { SuggestionBatch } from "@/types";
import styles from "@/app/app.module.css";

type Props = {
  batches: SuggestionBatch[];
  onClickSuggestion: (batchId: string, suggestionId: string) => void;
  disabled?: boolean;
};

export function SuggestionsPanel({ batches, onClickSuggestion, disabled = false }: Props) {
  return (
    <div className={styles.panelBody}>
      {batches.length === 0 ? (
        <div className={styles.muted}>Suggestions will appear after the first refresh.</div>
      ) : (
        batches.map((b) => (
          <div key={b.id} style={{ marginBottom: 14 }}>
            <div className={styles.muted}>
              {new Date(b.createdAt).toLocaleTimeString()} (based on {b.transcriptChunkIds.length} chunk(s))
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {b.suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onClickSuggestion(b.id, s.id)}
                  disabled={disabled}
                  className={styles.btn}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(127,127,127,0.08)",
                    opacity: disabled ? 0.7 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                    <div className={styles.muted}>{s.type}</div>
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{s.preview}</div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

