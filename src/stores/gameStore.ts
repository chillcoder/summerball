import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AtBat, AtBatOutcome, OutcomeCategory, Player } from "@/types/database";

export type SelfAbMode = "handoff" | "voice" | "pending";

export type RecordingStep =
  | { type: "category" }
  | { type: "outcome"; category: OutcomeCategory; step1Time: number };

interface GameState {
  // Active game
  gameId: string | null;
  teamId: string | null;

  // Batting order for the current game (player IDs in order)
  battingOrder: string[];
  currentBatterIndex: number;

  // Players in the lineup (full objects for display)
  players: Player[];

  // At-bats recorded this session (may include optimistic ones not yet synced)
  atBats: AtBat[];

  // Recording UI state
  recordingStep: RecordingStep;
  lastAbTime: number | null;

  // Last committed AB for undo (3s window)
  undoAb: { atBat: AtBat; expiresAt: number } | null;

  // Self-AB preferences
  preferredSelfAbMode: SelfAbMode;
  // Which roster player is the recorder ("me") — drives the self-AB flow.
  selfPlayerId: string | null;

  // Game start time
  gameStartTime: number | null;

  // Actions
  startGame: (gameId: string, teamId: string, players: Player[], order: string[]) => void;
  setRecordingStep: (step: RecordingStep) => void;
  commitAtBat: (atBat: AtBat) => void;
  undoLastAtBat: () => AtBat | null;
  clearUndo: () => void;
  advanceBatter: () => void;
  skipBatter: () => void;
  setPendingAtBat: (atBatId: string) => void;
  setSelfAbMode: (mode: SelfAbMode) => void;
  setSelfPlayerId: (id: string | null) => void;
  endGame: () => void;
  reset: () => void;
}

const initialState = {
  gameId: null,
  teamId: null,
  battingOrder: [],
  currentBatterIndex: 0,
  players: [],
  atBats: [],
  recordingStep: { type: "category" as const },
  lastAbTime: null,
  undoAb: null,
  preferredSelfAbMode: "pending" as SelfAbMode,
  selfPlayerId: null,
  gameStartTime: null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startGame: (gameId, teamId, players, order) =>
        set({
          gameId,
          teamId,
          players,
          battingOrder: order,
          currentBatterIndex: 0,
          atBats: [],
          recordingStep: { type: "category" },
          lastAbTime: null,
          undoAb: null,
          gameStartTime: Date.now(),
        }),

      setRecordingStep: (step) => set({ recordingStep: step }),

      commitAtBat: (atBat) => {
        const now = Date.now();
        set((state) => ({
          atBats: [...state.atBats, atBat],
          undoAb: { atBat, expiresAt: now + 3000 },
          lastAbTime: now,
          recordingStep: { type: "category" },
        }));
      },

      undoLastAtBat: () => {
        const { undoAb } = get();
        if (!undoAb || Date.now() > undoAb.expiresAt) return null;
        set((state) => ({
          atBats: state.atBats.filter((ab) => ab.id !== undoAb.atBat.id),
          undoAb: null,
          // Move batter back
          currentBatterIndex: Math.max(0, state.currentBatterIndex - 1),
        }));
        return undoAb.atBat;
      },

      clearUndo: () => set({ undoAb: null }),

      advanceBatter: () =>
        set((state) => ({
          currentBatterIndex:
            (state.currentBatterIndex + 1) % state.battingOrder.length,
          recordingStep: { type: "category" },
        })),

      skipBatter: () =>
        set((state) => ({
          currentBatterIndex:
            (state.currentBatterIndex + 1) % state.battingOrder.length,
          recordingStep: { type: "category" },
        })),

      setPendingAtBat: (atBatId) =>
        set((state) => ({
          atBats: state.atBats.map((ab) =>
            ab.id === atBatId ? { ...ab, is_pending: true } : ab
          ),
        })),

      setSelfAbMode: (mode) => set({ preferredSelfAbMode: mode }),

      setSelfPlayerId: (id) => set({ selfPlayerId: id }),

      endGame: () => set({ gameId: null, gameStartTime: null }),

      reset: () => set(initialState),
    }),
    {
      name: "summerball-game",
      // Only persist preferences, not active game state
      partialize: (state) => ({
        preferredSelfAbMode: state.preferredSelfAbMode,
        selfPlayerId: state.selfPlayerId,
      }),
    }
  )
);

// Selector helpers
export const selectCurrentBatter = (state: GameState): Player | null => {
  const id = state.battingOrder[state.currentBatterIndex];
  return state.players.find((p) => p.id === id) ?? null;
};

export const selectOnDeckBatter = (state: GameState): Player | null => {
  const nextIndex = (state.currentBatterIndex + 1) % state.battingOrder.length;
  const id = state.battingOrder[nextIndex];
  return state.players.find((p) => p.id === id) ?? null;
};

export const selectTodayStats = (
  state: GameState,
  playerId: string
): { hits: number; ab: number } => {
  const abs = state.atBats.filter(
    (ab) => ab.player_id === playerId && !ab.is_pending
  );
  const hits = abs.filter((ab) => ["1B", "2B", "3B", "HR"].includes(ab.outcome)).length;
  const ab = abs.filter((ab) => !["BB", "SAC"].includes(ab.outcome)).length;
  return { hits, ab };
};
