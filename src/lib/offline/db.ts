import Dexie, { type Table } from "dexie";

// A single durable outbox of mutations that must reach Supabase. Writes go here
// first (synchronously, in IndexedDB) so an at-bat is never lost when the field
// has no signal; a background flush drains it FIFO once connectivity returns.
export interface OutboxItem {
  id?: number; // auto-increment, also the FIFO order key
  op: string;
  args: unknown;
  createdAt: number;
  attempts: number;
}

class SummerballDB extends Dexie {
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super("summerball");
    this.version(1).stores({
      outbox: "++id, createdAt",
    });
  }
}

// Lazy singleton: never instantiate during SSR (no indexedDB there). The queue
// only calls this from browser-only code paths (event handlers / effects).
let _db: SummerballDB | null = null;
export function getDb(): SummerballDB {
  if (!_db) _db = new SummerballDB();
  return _db;
}
