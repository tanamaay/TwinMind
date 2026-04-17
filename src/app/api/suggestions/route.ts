import { NextResponse } from "next/server";

type SuggestionType =
  | "question_to_ask"
  | "talking_point"
  | "answer"
  | "clarification"
  | "fact_check"
  | "follow_up"
  | "risk_flag";

type Suggestion = {
  type: SuggestionType;
  title: string;
  preview: string;
  rationale?: string;
};

type SuggestionsResponse = {
  suggestions: Suggestion[];
  conversationSummary?: string;
};

export const runtime = "nodejs";
const SUGGESTION_GUARD_PROMPT = [
  "You are generating live meeting copilot suggestions.",
  "Prioritize the most recent transcript lines, not generic meeting templates.",
  "Do NOT default to agenda/objectives/introductions unless transcript explicitly indicates meeting start setup.",
  "Each preview must reference concrete context from transcript in natural language.",
  "Keep previews short and practical (1-2 sentences, no markdown).",
].join("\n");

function normalizeType(t: string): SuggestionType {
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
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseSuggestions(raw: string): SuggestionsResponse | null {
  const jsonText = extractJsonObject(raw) ?? raw;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { suggestions?: unknown; conversationSummary?: unknown };
    if (!Array.isArray(obj.suggestions)) return null;
    const suggestions: Suggestion[] = [];
    for (const item of obj.suggestions) {
      if (!item || typeof item !== "object") continue;
      const it = item as { type?: unknown; title?: unknown; preview?: unknown; rationale?: unknown };
      const title = typeof it.title === "string" ? it.title.trim() : "";
      const preview = typeof it.preview === "string" ? it.preview.trim() : "";
      if (!title || !preview) continue;
      const type = typeof it.type === "string" ? normalizeType(it.type) : "answer";
      const rationale = typeof it.rationale === "string" ? it.rationale.trim() : undefined;
      suggestions.push({ type, title, preview, rationale });
    }
    const conversationSummary = typeof obj.conversationSummary === "string" ? obj.conversationSummary.trim() : undefined;
    return { suggestions, conversationSummary };
  } catch {
    return null;
  }
}

function dedupeByTitle(s: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const item of s) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function looksTooGeneric(s: Suggestion): boolean {
  const text = `${s.title} ${s.preview}`.toLowerCase();
  const genericPhrases = [
    "set the meeting agenda",
    "introduce meeting objectives",
    "clarify participants",
    "who else is joining",
    "before we dive in",
  ];
  return genericPhrases.some((p) => text.includes(p));
}

async function groqChat(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens: 900,
      messages,
    }),
  });

  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`Groq chat failed (${r.status}): ${txt.slice(0, 1200)}`);
  }

  const data = JSON.parse(txt) as unknown;
  if (!data || typeof data !== "object") throw new Error("Groq chat returned invalid JSON.");
  const choicesUnknown = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choicesUnknown) || choicesUnknown.length === 0) throw new Error("Groq chat returned no choices.");
  const first = choicesUnknown[0] as { message?: unknown };
  const messageUnknown = first?.message;
  if (!messageUnknown || typeof messageUnknown !== "object") throw new Error("Groq chat returned no message.");
  const contentUnknown = (messageUnknown as { content?: unknown }).content;
  if (typeof contentUnknown !== "string") throw new Error("Groq chat returned no content.");
  return contentUnknown;
}

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-groq-api-key")?.trim();
    if (!apiKey) return NextResponse.json({ error: "Missing Groq API key." }, { status: 400 });

    const body = (await req.json()) as {
      transcript: Array<{ id: string; text: string; startedAt: string; endedAt: string }>;
      conversationSummary?: string;
      prompt: string;
    };

    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    const conversationSummary = typeof body.conversationSummary === "string" ? body.conversationSummary : "";
    const prompt = typeof body.prompt === "string" ? body.prompt : "";

    const transcriptText = transcript
      .map((c) => `[${c.startedAt} - ${c.endedAt}] ${c.text}`)
      .join("\n")
      .slice(0, 45_000);

    const messages = [
      { role: "system", content: `${SUGGESTION_GUARD_PROMPT}\n\n${prompt}` },
      {
        role: "user",
        content: [
          "Recent transcript context:",
          transcriptText || "(no transcript yet)",
          "",
          conversationSummary ? `Rolling summary:\n${conversationSummary}` : "Rolling summary: (empty)",
        ].join("\n"),
      },
    ];

    // First attempt
    let content = await groqChat(apiKey, messages);
    let parsed = parseSuggestions(content);

    // One repair attempt if needed
    if (!parsed || parsed.suggestions.length < 3 || parsed.suggestions.some(looksTooGeneric)) {
      content = await groqChat(apiKey, [
        ...messages,
        {
          role: "user",
          content:
            "Repair: Return ONLY valid JSON in {\"suggestions\":[...]} with exactly 3 items. Avoid generic meeting openers; anchor to transcript specifics.",
        },
      ]);
      parsed = parseSuggestions(content);
    }

    if (!parsed) return NextResponse.json({ error: "Failed to parse suggestions." }, { status: 502 });

    const cleaned = dedupeByTitle(parsed.suggestions).slice(0, 3);
    if (cleaned.length !== 3) {
      return NextResponse.json({ error: "Model did not produce 3 usable suggestions." }, { status: 502 });
    }

    return NextResponse.json({ suggestions: cleaned, conversationSummary: parsed.conversationSummary ?? "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

