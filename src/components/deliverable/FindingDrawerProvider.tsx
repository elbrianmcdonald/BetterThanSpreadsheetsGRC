"use client";

/**
 * Story 17.1: Single shared Finding Drawer instance (AC19).
 *
 * Every deliverable body (17.2–17.5) opens the SAME drawer via useFindingDrawer().
 * There is exactly ONE FindingDrawer mounted here — bodies never own their own.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FindingDrawer } from "./FindingDrawer";
import type { FindingLike } from "./types";

interface FindingDrawerApi {
  openFinding: (finding: FindingLike) => void;
  close: () => void;
}

const Ctx = createContext<FindingDrawerApi | null>(null);

export function useFindingDrawer(): FindingDrawerApi {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useFindingDrawer must be used within a FindingDrawerProvider");
  }
  return v;
}

export function FindingDrawerProvider({ children }: { children: ReactNode }) {
  const [finding, setFinding] = useState<FindingLike | null>(null);

  const openFinding = useCallback((f: FindingLike) => setFinding(f), []);
  const close = useCallback(() => setFinding(null), []);

  const api = useMemo<FindingDrawerApi>(
    () => ({ openFinding, close }),
    [openFinding, close],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <FindingDrawer finding={finding} onClose={close} />
    </Ctx.Provider>
  );
}
