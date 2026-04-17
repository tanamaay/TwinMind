"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptChunk } from "@/types";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";

type Options = {
  enabled: boolean;
  apiKey: string;
  chunkMs: number;
  promptHint: string;
  languageHint: string;
  onChunk: (chunk: TranscriptChunk) => void;
  onError: (error: string) => void;
};

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useMicChunkTranscriber(opts: Options) {
  const { enabled, apiKey, chunkMs, promptHint, languageHint, onChunk, onError } = opts;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkStartAtRef = useRef<number>(0);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    async function stopAll() {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      recorderRef.current = null;
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
      streamRef.current = null;
    }

    async function start() {
      if (!enabled) return;
      if (!apiKey.trim()) {
        onError("Missing Groq API key (open Settings).");
        return;
      }
      if (recorderRef.current) return;

      if (typeof MediaRecorder === "undefined") {
        onError("MediaRecorder not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunkStartAtRef.current = Date.now();

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = async (ev) => {
        const blob = ev.data;
        if (!blob || blob.size === 0) return;

        const startedAt = new Date(chunkStartAtRef.current).toISOString();
        const endedAt = nowIso();
        chunkStartAtRef.current = Date.now();

        try {
          setIsBusy(true);
          const form = new FormData();
          form.set("audio", blob, "chunk.webm");
          form.set("prompt", promptHint);
          form.set("language", languageHint ?? "");

          const r = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "x-groq-api-key": apiKey },
            body: form,
          });

          if (!r.ok) {
            const t = await r.text();
            onError(`Transcription failed (${r.status}). ${t.slice(0, 600)}`);
            return;
          }

          const data = (await r.json()) as { text?: string; error?: string };
          if (!data.text) {
            onError(data.error ? `Transcription error: ${data.error}` : "Empty transcription.");
            return;
          }

          onChunk({
            id: newId("tr"),
            startedAt,
            endedAt,
            text: data.text,
          });
        } catch (e) {
          onError(e instanceof Error ? e.message : String(e));
        } finally {
          setIsBusy(false);
        }
      };

      recorder.onerror = () => onError("MediaRecorder error.");

      // Request data every chunkMs.
      recorder.start(chunkMs);
    }

    if (enabled) {
      start().catch((e) => onError(e instanceof Error ? e.message : String(e)));
    } else {
      stopAll().catch(() => undefined);
    }

    return () => {
      stopAll().catch(() => undefined);
    };
  }, [
    enabled,
    apiKey,
    chunkMs,
    promptHint,
    languageHint,
    onChunk,
    onError,
  ]);

  return { isBusy };
}

