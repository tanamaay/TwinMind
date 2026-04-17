export type IsoTimestamp = string;

export type TranscriptChunk = {
  id: string;
  startedAt: IsoTimestamp;
  endedAt: IsoTimestamp;
  text: string;
};

export type SuggestionType =
  | "question_to_ask"
  | "talking_point"
  | "answer"
  | "clarification"
  | "fact_check"
  | "follow_up"
  | "risk_flag";

export type Suggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string; // must be valuable standalone
  rationale?: string;
};

export type SuggestionBatch = {
  id: string;
  createdAt: IsoTimestamp;
  transcriptChunkIds: string[];
  suggestions: [Suggestion, Suggestion, Suggestion];
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  createdAt: IsoTimestamp;
  role: ChatRole;
  content: string;
  // If the message was initiated by clicking a suggestion
  suggestionId?: string;
  suggestionBatchId?: string;
};

export type PromptSettings = {
  liveSuggestionsPrompt: string;
  expandedAnswerPrompt: string;
  chatPrompt: string;
  transcriptionPromptHint: string;
};

export type ContextSettings = {
  liveSuggestionsContextChunks: number;
  expandedAnswerContextChunks: number;
};

export type AppSettings = {
  groqApiKey: string;
  languageHint: string; // ISO-639-1 or empty for auto
  refreshIntervalMs: number;
  prompts: PromptSettings;
  context: ContextSettings;
};

export type SessionState = {
  sessionStartedAt: IsoTimestamp;
  isRecording: boolean;
  transcriptChunks: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
  conversationSummary: string;
  settings: AppSettings;
  lastError?: string;
};

