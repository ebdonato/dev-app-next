"use client";

import { useEffect } from "react";
import { useFeedbackState } from "./feedback-provider";
import styles from "./feedback-region.module.css";

const SUCCESS_TIMEOUT_MS = 4000;

/**
 * Shows the current message. The live region is always in the DOM (even when
 * empty) so screen readers announce changes. Success messages auto-dismiss;
 * errors stay until the user closes them.
 */
export function FeedbackRegion() {
  const { feedback, dismiss } = useFeedbackState();

  useEffect(() => {
    if (feedback?.type !== "success") return;
    const timer = setTimeout(dismiss, SUCCESS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [feedback, dismiss]);

  return (
    <div role="status" aria-live="polite" className={styles.region}>
      {feedback && (
        <div className={`${styles.message} ${styles[feedback.type]}`}>
          <p className={styles.text}>{feedback.text}</p>
          <button
            type="button"
            className={styles.close}
            onClick={dismiss}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
