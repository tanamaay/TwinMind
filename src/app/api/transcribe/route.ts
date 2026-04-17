import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OkResponse = {
  text: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-groq-api-key")?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Groq API key." }, { status: 400 });
    }

    const form = await req.formData();
    const audio = form.get("audio");
    const prompt = String(form.get("prompt") ?? "").slice(0, 2000);
    const language = String(form.get("language") ?? "").trim();

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
    }

    const groqForm = new FormData();
    groqForm.set("file", audio);
    groqForm.set("model", "whisper-large-v3");
    groqForm.set("response_format", "json");
    if (prompt) groqForm.set("prompt", prompt.slice(0, 800)); // Whisper prompt is small; keep it short
    if (language) groqForm.set("language", language);
    groqForm.set("temperature", "0");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: "Groq transcription failed.", details: text.slice(0, 4000) },
        { status: 502 },
      );
    }

    const data = (await r.json()) as { text?: string };
    const text = data.text?.trim() ?? "";
    const resp: OkResponse = { text };
    return NextResponse.json(resp);
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected server error.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

