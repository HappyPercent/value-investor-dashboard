"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { readSSEStream } from "@/lib/sse-client";
import type { SeedOptions } from "@/types/screener";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: SeedOptions;
}

interface SeedState {
  status: "idle" | "running" | "done" | "error";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  log: string[];
  errorMsg: string | null;
  durationMs: number | null;
}

const initialState: SeedState = {
  status: "idle",
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  log: [],
  errorMsg: null,
  durationMs: null,
};

export function SeedProgressModal({ isOpen, onClose, options }: Props) {
  const [state, setState] = useState<SeedState>(initialState);
  const [forceRefresh, setForceRefresh] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setState(initialState);
      setForceRefresh(false);
    } else {
      abortRef.current?.abort();
    }
  }, [isOpen]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  function startSeed() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState((s) => ({ ...s, status: "running" }));

    async function run() {
      try {
        const res = await fetch("/api/screener/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...options, forceRefresh }),
          signal: ctrl.signal,
        });

        await readSSEStream(res, (event) => {
          if (event.event === "seed_start") {
            const d = event.data as { jobId: number; total: number };
            setState((s) => ({ ...s, total: d.total }));
          } else if (event.event === "ticker_done") {
            const d = event.data as { ticker: string; success: boolean; processed: number; total: number };
            setState((s) => ({
              ...s,
              processed: d.processed,
              succeeded: s.succeeded + (d.success ? 1 : 0),
              failed: s.failed + (d.success ? 0 : 1),
              log: [...s.log.slice(-49), `${d.success ? "✓" : "✗"} ${d.ticker}`],
            }));
          } else if (event.event === "seed_complete") {
            const d = event.data as { succeeded: number; failed: number; durationMs: number };
            setState((s) => ({
              ...s,
              status: "done",
              succeeded: d.succeeded,
              failed: d.failed,
              durationMs: d.durationMs,
            }));
          } else if (event.event === "error") {
            const d = event.data as { message: string };
            setState((s) => ({ ...s, status: "error", errorMsg: d.message }));
          }
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setState((s) => ({ ...s, status: "error", errorMsg: String(e) }));
        }
      }
    }

    run();
  }

  const pct = state.total > 0 ? (state.processed / state.total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && state.status !== "running" && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.status === "done" ? "Seed Complete" :
             state.status === "error" ? "Seed Failed" :
             state.status === "running" ? "Seeding Universe…" :
             "Seed Universe"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {state.status === "idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Fetch latest fundamentals for all tickers in the selected index.
              </p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Force refresh (re-fetch tickers updated within the last 24h)
              </label>
              <Button onClick={startSeed} className="w-full">Start Seed</Button>
            </div>
          )}

          {state.status === "running" && (
            <div className="space-y-2">
              <Progress value={pct} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {state.processed} / {state.total} ({pct.toFixed(0)}%)
              </p>
            </div>
          )}

          {state.status === "done" && (
            <div className="text-sm space-y-1">
              <p className="text-green-600 font-medium">
                ✓ {state.succeeded} succeeded, {state.failed} failed
              </p>
              {state.durationMs !== null && (
                <p className="text-muted-foreground">
                  Completed in {(state.durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.errorMsg}</p>
          )}

          {state.log.length > 0 && (
            <div
              ref={logRef}
              className="h-40 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs space-y-0.5"
            >
              {state.log.map((line, i) => (
                <div
                  key={i}
                  className={line.startsWith("✓") ? "text-green-600" : "text-red-500"}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          {state.status !== "running" && state.status !== "idle" && (
            <Button onClick={onClose} className="w-full">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
