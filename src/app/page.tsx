"use client";

import { useCallback, useRef, useState } from "react";
import styles from "@/app/app.module.css";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { buildExportPayload } from "@/lib/sessionExport";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { useSessionState } from "@/lib/useSessionState";
import { useMicChunkTranscriber } from "@/lib/useMicChunkTranscriber";
import type { Suggestion, SuggestionBatch, SuggestionType, TranscriptChunk } from "@/types";

function MicSvgIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.micIcon}>
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z"
      />
    </svg>
  );
}

function cleanAssistantText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function Home() {
  const { state, actions } = useSessionState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);
  const chatRequestLockRef = useRef(false);

  const normalizeSuggestionType = useCallback((t: string): SuggestionType => {
    const x = t.trim().toLowerCase();
    const allowed: SuggestionType[] = [
      "question_to_ask",
      "talking_point",
      "answer",
      "clarification",
      "fact_check",
      "follow_up",
      "risk_flag",
    ];
    if ((allowed as string[]).includes(x)) return x as SuggestionType;
    if (x.includes("question")) return "question_to_ask";
    if (x.includes("fact")) return "fact_check";
    if (x.includes("risk")) return "risk_flag";
    if (x.includes("follow")) return "follow_up";
    if (x.includes("talk")) return "talking_point";
    if (x.includes("clar")) return "clarification";
    return "answer";
  }, []);

  const refreshSuggestions = useCallback(async () => {
    if (!state.settings.groqApiKey.trim()) {
      actions.setError("Add Groq API key in Settings first.");
      return;
    }
    if (isRefreshingSuggestions) return;
    setIsRefreshingSuggestions(true);
    actions.setError(undefined);
    try {
      const n = Math.max(1, state.settings.context.liveSuggestionsContextChunks);
      const recent = state.transcriptChunks.slice(-n);
      const recentText = recent.map((c) => c.text).join(" ").trim();
      if (recentText.length < 8) {
        actions.setError("Transcript abhi kaafi nahi hai. Pehle 30-40 sec बोलो, phir refresh karo.");
        return;
      }
      const r = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": state.settings.groqApiKey,
        },
        body: JSON.stringify({
          transcript: recent,
          conversationSummary: state.conversationSummary,
          prompt: state.settings.prompts.liveSuggestionsPrompt,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        actions.setError(`Suggestions failed (${r.status}). ${t.slice(0, 600)}`);
        return;
      }
      const data = (await r.json()) as unknown;
      if (!data || typeof data !== "object") {
        actions.setError("Suggestions response was invalid.");
        return;
      }
      const suggestionsUnknown = (data as { suggestions?: unknown }).suggestions;
      const conversationSummaryUnknown = (data as { conversationSummary?: unknown }).conversationSummary;
      if (!Array.isArray(suggestionsUnknown) || suggestionsUnknown.length !== 3) {
        actions.setError("Suggestions response was invalid (expected exactly 3).");
        return;
      }

      const batchId = newId("sb");
      const createdAt = nowIso();
      const transcriptChunkIds = recent.map((c) => c.id);
      const suggestionsParsed: Suggestion[] = [];
      for (const raw of suggestionsUnknown) {
        if (!raw || typeof raw !== "object") continue;
        const title = typeof (raw as { title?: unknown }).title === "string" ? (raw as { title: string }).title : "";
        const preview =
          typeof (raw as { preview?: unknown }).preview === "string" ? (raw as { preview: string }).preview : "";
        const typeRaw = typeof (raw as { type?: unknown }).type === "string" ? (raw as { type: string }).type : "answer";
        const rationale =
          typeof (raw as { rationale?: unknown }).rationale === "string"
            ? (raw as { rationale: string }).rationale
            : undefined;
        if (!title.trim() || !preview.trim()) continue;
        suggestionsParsed.push({
          id: newId("sug"),
          type: normalizeSuggestionType(typeRaw),
          title: title.trim(),
          preview: preview.trim(),
          rationale: rationale?.trim(),
        });
      }

      if (suggestionsParsed.length !== 3) {
        actions.setError("Model did not produce 3 usable suggestions.");
        return;
      }

      const batch: SuggestionBatch = {
        id: batchId,
        createdAt,
        transcriptChunkIds,
        suggestions: suggestionsParsed as [Suggestion, Suggestion, Suggestion],
      };
      actions.prependSuggestionBatch(batch);

      if (typeof conversationSummaryUnknown === "string" && conversationSummaryUnknown.trim()) {
        actions.setConversationSummary(conversationSummaryUnknown.trim());
      }
    } catch (e) {
      actions.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshingSuggestions(false);
    }
  }, [
    actions,
    isRefreshingSuggestions,
    state.conversationSummary,
    state.settings.context.liveSuggestionsContextChunks,
    state.settings.groqApiKey,
    state.settings.prompts.liveSuggestionsPrompt,
    state.transcriptChunks,
    normalizeSuggestionType,
  ]);

  const callChat = useCallback(
    async (payload: object) => {
      if (!state.settings.groqApiKey.trim()) {
        throw new Error("Missing Groq API key (open Settings).");
      }
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": state.settings.groqApiKey,
        },
        body: JSON.stringify(payload),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`Chat failed (${r.status}). ${txt.slice(0, 800)}`);
      const data = JSON.parse(txt) as unknown;
      const answer = (data as { answer?: unknown }).answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("Empty chat response.");
      return answer;
    },
    [state.settings.groqApiKey],
  );

  const onTranscriptChunk = useCallback(
    (chunk: TranscriptChunk) => {
      actions.appendTranscriptChunk(chunk);
      actions.setError(undefined);
      // Auto-refresh suggestions once per transcript chunk.
      void refreshSuggestions();
    },
    [actions, refreshSuggestions],
  );

  const onMicError = useCallback(
    (error: string) => {
      actions.setError(error);
      actions.setRecording(false);
    },
    [actions],
  );

  const { isBusy: isTranscribing } = useMicChunkTranscriber({
    enabled: state.isRecording,
    apiKey: state.settings.groqApiKey,
    chunkMs: state.settings.refreshIntervalMs,
    promptHint: state.settings.prompts.transcriptionPromptHint,
    languageHint: state.settings.languageHint,
    onChunk: onTranscriptChunk,
    onError: onMicError,
  });

  function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.app}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>TwinMind Copilot (Assignment)</div>
          <div className={styles.brandSub}>
            {state.isRecording ? (isTranscribing ? "Transcribing..." : "Recording...") : "Idle"} ·{" "}
            {state.transcriptChunks.length} transcript chunk(s) ·{" "}
            {state.suggestionBatches.length} suggestion batch(es)
          </div>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={`${state.isRecording ? styles.btnDanger : styles.btnPrimary} ${styles.micBtn}`}
            onClick={() => actions.setRecording(!state.isRecording)}
            title="Mic wiring comes next; this toggles state for now."
          >
            <MicSvgIcon />
            {state.isRecording ? "Stop mic" : "Start mic"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              void refreshSuggestions();
            }}
          >
            {isRefreshingSuggestions ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => downloadJson("twinmind-session.json", buildExportPayload(state))}
          >
            Export
          </button>
          <button type="button" className={styles.btn} onClick={() => actions.resetSession()}>
            New session
          </button>
          <button type="button" className={styles.btn} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      {state.lastError ? <div className={styles.error}>{state.lastError}</div> : null}

      <main className={styles.mainGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Transcript</div>
            <div className={styles.muted}>Auto-appends every ~30s while recording</div>
          </div>
          <TranscriptPanel chunks={state.transcriptChunks} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Live Suggestions</div>
            <div className={styles.muted}>Newest batch appears at top</div>
          </div>
          <SuggestionsPanel
            batches={state.suggestionBatches}
            disabled={isSending}
            onClickSuggestion={(batchId, suggestionId) => {
              if (chatRequestLockRef.current) return;
              const batch = state.suggestionBatches.find((b) => b.id === batchId);
              const suggestion = batch?.suggestions.find((s) => s.id === suggestionId);
              if (!batch || !suggestion) {
                actions.setError("Could not find that suggestion.");
                return;
              }

              chatRequestLockRef.current = true;
              const userMsgId = newId("chat_user");
              actions.appendChat({
                id: userMsgId,
                createdAt: nowIso(),
                role: "user",
                content: `Suggestion: ${suggestion.title}\n\n${suggestion.preview}`,
                suggestionBatchId: batchId,
                suggestionId,
              });

              setIsSending(true);
              const n = Math.max(1, state.settings.context.expandedAnswerContextChunks);
              const recent = state.transcriptChunks.slice(-n);
              void callChat({
                kind: "expand",
                prompt: state.settings.prompts.expandedAnswerPrompt,
                transcript: recent,
                conversationSummary: state.conversationSummary,
                suggestion: {
                  type: suggestion.type,
                  title: suggestion.title,
                  preview: suggestion.preview,
                  rationale: suggestion.rationale ?? "",
                },
              })
                .then((answer) => {
                  actions.appendChat({
                    id: newId("chat_assistant"),
                    createdAt: nowIso(),
                    role: "assistant",
                    content: cleanAssistantText(answer),
                    suggestionBatchId: batchId,
                    suggestionId,
                  });
                })
                .catch((e) => actions.setError(e instanceof Error ? e.message : String(e)))
                .finally(() => {
                  setIsSending(false);
                  chatRequestLockRef.current = false;
                });
            }}
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Chat</div>
            <div className={styles.muted}>One continuous chat per session</div>
          </div>
          <ChatPanel
            messages={state.chat}
            isSending={isSending}
            onSend={(text) => {
              if (chatRequestLockRef.current) return;
              chatRequestLockRef.current = true;
              actions.setError(undefined);
              actions.appendChat({ id: newId("chat_user"), createdAt: nowIso(), role: "user", content: text });
              setIsSending(true);

              const n = Math.max(1, state.settings.context.expandedAnswerContextChunks);
              const recent = state.transcriptChunks.slice(-n);
              void callChat({
                kind: "chat",
                prompt: state.settings.prompts.chatPrompt,
                transcript: recent,
                conversationSummary: state.conversationSummary,
                userMessage: text,
              })
                .then((answer) => {
                  actions.appendChat({
                    id: newId("chat_assistant"),
                    createdAt: nowIso(),
                    role: "assistant",
                    content: cleanAssistantText(answer),
                  });
                })
                .catch((e) => actions.setError(e instanceof Error ? e.message : String(e)))
                .finally(() => {
                  setIsSending(false);
                  chatRequestLockRef.current = false;
                });
            }}
          />
        </section>
      </main>

      {settingsOpen ? (
        <SettingsDrawer
          settings={state.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(settings) => actions.setSettings(settings)}
        />
      ) : null}
    </div>
  );
}
