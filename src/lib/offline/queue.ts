"use client";

import { useEffect, useState } from "react";
import { getDb } from "./db";
import { recordAtBat, updateAtBat, deleteAtBat } from "@/app/actions/atBats";
import type { AtBat } from "@/types/database";

// The in-game at-bat mutations are the ones that fire rapidly during play and
// must survive a dead signal. Game start/finalize happen at moments with
// connectivity (and need navigation), so they stay direct calls.
type RecordArgs = Parameters<typeof recordAtBat>[0];
type UpdateArgs = { id: string; updates: Parameters<typeof updateAtBat>[1] };
type DeleteArgs = { id: string };

export type QueuedOp =
  | { op: "recordAtBat"; args: RecordArgs }
  | { op: "updateAtBat"; args: UpdateArgs }
  | { op: "deleteAtBat"; args: DeleteArgs };

async function dispatch(op: string, args: unknown): Promise<void> {
  switch (op) {
    case "recordAtBat":
      await recordAtBat(args as RecordArgs);
      return;
    case "updateAtBat": {
      const a = args as UpdateArgs;
      await updateAtBat(a.id, a.updates);
      return;
    }
    case "deleteAtBat":
      await deleteAtBat((args as DeleteArgs).id);
      return;
    default:
      throw new Error(`Unknown sync op: ${op}`);
  }
}

// --- subscription so the UI can show pending count -------------------------
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

// --- enqueue ---------------------------------------------------------------
export async function enqueue(op: QueuedOp): Promise<void> {
  const db = getDb();

  // Coalesce a record→undo that both happened before the insert synced: drop the
  // queued insert (and any updates) instead of round-tripping a create + delete.
  if (op.op === "deleteAtBat") {
    const pending = await db.outbox.toArray();
    const hasUnsyncedInsert = pending.some(
      (i) => i.op === "recordAtBat" && (i.args as RecordArgs).id === op.args.id
    );
    if (hasUnsyncedInsert) {
      const related = pending.filter(
        (i) =>
          ((i.op === "recordAtBat" && (i.args as RecordArgs).id === op.args.id) ||
            (i.op === "updateAtBat" && (i.args as UpdateArgs).id === op.args.id)) &&
          i.id != null
      );
      await db.outbox.bulkDelete(related.map((i) => i.id as number));
      notify();
      return;
    }
  }

  await db.outbox.add({
    op: op.op,
    args: op.args,
    createdAt: Date.now(),
    attempts: 0,
  });
  notify();
  void flush();
}

// --- flush -----------------------------------------------------------------
let flushing = false;

export async function flush(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    const db = getDb();
    // Drain strictly in FIFO order; stop at the first failure so dependent ops
    // (insert → update → delete on the same row) never run out of order.
    for (;;) {
      const item = await db.outbox.orderBy("id").first();
      if (!item || item.id == null) break;
      try {
        await dispatch(item.op, item.args);
        await db.outbox.delete(item.id);
        notify();
      } catch {
        await db.outbox.update(item.id, { attempts: (item.attempts ?? 0) + 1 });
        notify();
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

// --- React hook: pending count, plus reconnect/focus/interval flushing ------
export function useSyncStatus(): number {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const db = getDb();
    let active = true;

    const refresh = async () => {
      const n = await db.outbox.count();
      if (active) setPending(n);
    };

    listeners.add(refresh);
    refresh();
    void flush(); // drain anything left from a previous session

    const onOnline = () => void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void flush(), 15000);

    return () => {
      active = false;
      listeners.delete(refresh);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return pending;
}

// Convenience wrappers used by the recording UI.
export function queueRecordAtBat(args: RecordArgs): Promise<void> {
  return enqueue({ op: "recordAtBat", args });
}
export function queueUpdateAtBat(id: string, updates: UpdateArgs["updates"]): Promise<void> {
  return enqueue({ op: "updateAtBat", args: { id, updates } });
}
export function queueDeleteAtBat(id: string): Promise<void> {
  return enqueue({ op: "deleteAtBat", args: { id } });
}

export type { AtBat };
