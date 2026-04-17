"use client";

import { useState } from "react";
import type { AppSettings } from "@/types";
import styles from "@/app/app.module.css";

type Props = {
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
};

export function SettingsDrawer({ settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 100vw)",
          height: "100%",
          background: "var(--background)",
          borderLeft: "1px solid rgba(127,127,127,0.25)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Settings</div>
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Groq API Key</div>
          <input
            value={draft.groqApiKey}
            onChange={(e) => setDraft({ ...draft, groqApiKey: e.target.value })}
            placeholder="gsk_..."
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Refresh / Chunk Interval (seconds)</div>
          <input
            type="number"
            min={5}
            max={300}
            value={Math.round(draft.refreshIntervalMs / 1000)}
            onChange={(e) =>
              setDraft({
                ...draft,
                refreshIntervalMs: Math.max(5, Number(e.target.value || 30)) * 1000,
              })
            }
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Whisper Language Hint (optional)</div>
          <input
            value={draft.languageHint}
            onChange={(e) => setDraft({ ...draft, languageHint: e.target.value })}
            placeholder="e.g. en (leave blank for auto)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Live Suggestions Context (chunks)</div>
          <input
            type="number"
            min={1}
            max={50}
            value={draft.context.liveSuggestionsContextChunks}
            onChange={(e) =>
              setDraft({
                ...draft,
                context: { ...draft.context, liveSuggestionsContextChunks: Number(e.target.value) },
              })
            }
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Expanded Answer Context (chunks)</div>
          <input
            type="number"
            min={1}
            max={50}
            value={draft.context.expandedAnswerContextChunks}
            onChange={(e) =>
              setDraft({
                ...draft,
                context: { ...draft.context, expandedAnswerContextChunks: Number(e.target.value) },
              })
            }
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Transcription Prompt Hint</div>
          <textarea
            value={draft.prompts.transcriptionPromptHint}
            onChange={(e) =>
              setDraft({ ...draft, prompts: { ...draft.prompts, transcriptionPromptHint: e.target.value } })
            }
            rows={3}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Live Suggestions Prompt</div>
          <textarea
            value={draft.prompts.liveSuggestionsPrompt}
            onChange={(e) => setDraft({ ...draft, prompts: { ...draft.prompts, liveSuggestionsPrompt: e.target.value } })}
            rows={10}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Expanded Answer Prompt</div>
          <textarea
            value={draft.prompts.expandedAnswerPrompt}
            onChange={(e) =>
              setDraft({ ...draft, prompts: { ...draft.prompts, expandedAnswerPrompt: e.target.value } })
            }
            rows={8}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.muted}>Chat Prompt</div>
          <textarea
            value={draft.prompts.chatPrompt}
            onChange={(e) => setDraft({ ...draft, prompts: { ...draft.prompts, chatPrompt: e.target.value } })}
            rows={6}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(127,127,127,0.35)",
              background: "transparent",
              color: "inherit",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
            }}
          />
        </label>

        <div className={styles.settingsFooter}>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.saveBtn}`}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

