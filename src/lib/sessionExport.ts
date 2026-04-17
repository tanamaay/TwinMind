import type { SessionState } from "@/types";

export function buildExportPayload(state: SessionState) {
  return {
    exportedAt: new Date().toISOString(),
    sessionStartedAt: state.sessionStartedAt,
    transcript: state.transcriptChunks,
    suggestionBatches: state.suggestionBatches,
    chat: state.chat,
    conversationSummary: state.conversationSummary,
  };
}

