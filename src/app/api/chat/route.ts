import { NextResponse } from "next/server";

export const runtime = "nodejs";
const CHAT_GUARD_PROMPT = [
  "Answer for a live meeting context.",
  "Be concise and practical.",
  "No markdown tables.",
  "Avoid long boilerplate sections.",
  "If transcript context is weak, state uncertainty in one short line and ask one clarifying question.",
].join("\n");

async function groqChat(apiKey: string, messages: Array<{ role: string; content: string }>, maxTokens: number) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens: maxTokens,
      messages,
    }),
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(`Groq chat failed (${r.status}): ${txt.slice(0, 1200)}`);

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
      kind: "expand" | "chat";
      prompt: string;
      transcript: Array<{ id: string; text: string; startedAt: string; endedAt: string }>;
      conversationSummary?: string;
      userMessage?: string;
      suggestion?: { type?: string; title: string; preview: string; rationale?: string };
    };

    const kind = body.kind;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    const conversationSummary = typeof body.conversationSummary === "string" ? body.conversationSummary : "";

    const transcriptText = transcript
      .map((c) => `[${c.startedAt} - ${c.endedAt}] ${c.text}`)
      .join("\n")
      .slice(0, 90_000);

    if (kind === "expand") {
      if (!body.suggestion || typeof body.suggestion !== "object") {
        return NextResponse.json({ error: "Missing suggestion." }, { status: 400 });
      }
      const title = String(body.suggestion.title ?? "").trim();
      const preview = String(body.suggestion.preview ?? "").trim();
      const type = String(body.suggestion.type ?? "").trim();
      const rationale = typeof body.suggestion.rationale === "string" ? body.suggestion.rationale.trim() : "";

      const messages = [
        { role: "system", content: `${CHAT_GUARD_PROMPT}\n\n${prompt}` },
        {
          role: "user",
          content: [
            "Selected suggestion:",
            `Type: ${type || "(unknown)"}`,
            `Title: ${title}`,
            `Preview: ${preview}`,
            rationale ? `Rationale: ${rationale}` : "",
            "",
            "Transcript context:",
            transcriptText || "(no transcript yet)",
            "",
            conversationSummary ? `Rolling summary:\n${conversationSummary}` : "Rolling summary: (empty)",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ];

      const answer = await groqChat(apiKey, messages, 600);
      return NextResponse.json({ answer });
    }

    if (kind === "chat") {
      const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
      if (!userMessage) return NextResponse.json({ error: "Missing user message." }, { status: 400 });

      const messages = [
        { role: "system", content: `${CHAT_GUARD_PROMPT}\n\n${prompt}` },
        {
          role: "user",
          content: [
            "User question:",
            userMessage,
            "",
            "Transcript context:",
            transcriptText || "(no transcript yet)",
            "",
            conversationSummary ? `Rolling summary:\n${conversationSummary}` : "Rolling summary: (empty)",
          ].join("\n"),
        },
      ];

      const answer = await groqChat(apiKey, messages, 600);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

