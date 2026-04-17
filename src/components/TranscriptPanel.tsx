"use client";

import { useEffect, useRef } from "react";
import type { TranscriptChunk } from "@/types";
import styles from "@/app/app.module.css";

type Props = {
  chunks: TranscriptChunk[];
};

export function TranscriptPanel({ chunks }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const node = endRef.current?.parentElement;
    if (!node) return;
    const onScroll = () => {
      const nearBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 48;
      userScrolledRef.current = !nearBottom;
    };
    node.addEventListener("scroll", onScroll);
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (userScrolledRef.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chunks.length]);

  return (
    <div className={styles.panelBody}>
      {chunks.length === 0 ? (
        <div className={styles.muted}>Start the mic to see transcript chunks here.</div>
      ) : (
        chunks.map((c) => (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <div className={styles.muted}>
              {new Date(c.startedAt).toLocaleTimeString()} - {new Date(c.endedAt).toLocaleTimeString()}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{c.text}</div>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

