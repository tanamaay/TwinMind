"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { AppSettings, ChatMessage, SessionState, SuggestionBatch, TranscriptChunk } from "@/types";
import { DEFAULT_SETTINGS } from "@/lib/defaultSettings";
import { loadJson, saveJson } from "@/lib/storage";
import { nowIso } from "@/lib/time";

const SETTINGS_KEY = "twinmind_settings_v1";

type Action =
  | { type: "setRecording"; isRecording: boolean }
  | { type: "appendTranscriptChunk"; chunk: TranscriptChunk }
  | { type: "prependSuggestionBatch"; batch: SuggestionBatch }
  | { type: "appendChat"; message: ChatMessage }
  | { type: "setConversationSummary"; summary: string }
  | { type: "setSettings"; settings: AppSettings }
  | { type: "setError"; error?: string }
  | { type: "resetSession" };

function initialState(): SessionState {
  const storedSettings = typeof window !== "undefined" ? loadJson<AppSettings>(SETTINGS_KEY) : undefined;
  return {
    sessionStartedAt: nowIso(),
    isRecording: false,
    transcriptChunks: [],
    suggestionBatches: [],
    chat: [],
    conversationSummary: "",
    settings: storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings } : DEFAULT_SETTINGS,
  };
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "setRecording":
      return { ...state, isRecording: action.isRecording };
    case "appendTranscriptChunk":
      return { ...state, transcriptChunks: [...state.transcriptChunks, action.chunk] };
    case "prependSuggestionBatch":
      return { ...state, suggestionBatches: [action.batch, ...state.suggestionBatches] };
    case "appendChat":
      return { ...state, chat: [...state.chat, action.message] };
    case "setConversationSummary":
      return { ...state, conversationSummary: action.summary };
    case "setSettings":
      return { ...state, settings: action.settings };
    case "setError":
      return { ...state, lastError: action.error };
    case "resetSession":
      return { ...initialState(), settings: state.settings };
    default:
      return state;
  }
}

export function useSessionState() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    saveJson(SETTINGS_KEY, state.settings);
  }, [state.settings]);

  const actions = useMemo(
    () => ({
      setRecording(isRecording: boolean) {
        dispatch({ type: "setRecording", isRecording });
      },
      appendTranscriptChunk(chunk: TranscriptChunk) {
        dispatch({ type: "appendTranscriptChunk", chunk });
      },
      prependSuggestionBatch(batch: SuggestionBatch) {
        dispatch({ type: "prependSuggestionBatch", batch });
      },
      appendChat(message: ChatMessage) {
        dispatch({ type: "appendChat", message });
      },
      setConversationSummary(summary: string) {
        dispatch({ type: "setConversationSummary", summary });
      },
      setSettings(settings: AppSettings) {
        dispatch({ type: "setSettings", settings });
      },
      setError(error?: string) {
        dispatch({ type: "setError", error });
      },
      resetSession() {
        dispatch({ type: "resetSession" });
      },
    }),
    [],
  );

  return { state, actions };
}

