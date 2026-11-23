"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * App-wide success/error messages. The provider lives in the root layout,
 * which is not re-mounted on client navigation, so a message triggered right
 * before `router.push` is still visible on the destination page.
 */

export type Feedback = { type: "success" | "error"; text: string } | null;

type FeedbackApi = {
  notifySuccess: (text: string) => void;
  notifyError: (text: string) => void;
};

type FeedbackState = {
  feedback: Feedback;
  dismiss: () => void;
};

// Two contexts: components that only send messages don't re-render when the
// current message changes.
const FeedbackApiContext = createContext<FeedbackApi | null>(null);
const FeedbackStateContext = createContext<FeedbackState | null>(null);

export function FeedbackProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  // `setFeedback` is stable, so these functions keep a stable identity and are
  // safe to use in effects and mutation callbacks.
  const api = useMemo<FeedbackApi>(
    () => ({
      notifySuccess: (text) => setFeedback({ type: "success", text }),
      notifyError: (text) => setFeedback({ type: "error", text }),
    }),
    [],
  );
  const state = useMemo<FeedbackState>(
    () => ({ feedback, dismiss: () => setFeedback(null) }),
    [feedback],
  );

  return (
    <FeedbackApiContext.Provider value={api}>
      <FeedbackStateContext.Provider value={state}>{children}</FeedbackStateContext.Provider>
    </FeedbackApiContext.Provider>
  );
}

/** Send a success or error message to the global feedback region. */
export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackApiContext);
  if (!api) throw new Error("useFeedback must be used inside <FeedbackProvider>.");
  return api;
}

/** Current message, for the region that displays it. */
export function useFeedbackState(): FeedbackState {
  const state = useContext(FeedbackStateContext);
  if (!state) throw new Error("useFeedbackState must be used inside <FeedbackProvider>.");
  return state;
}
