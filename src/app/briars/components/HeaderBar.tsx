"use client";

import { FiCalendar, FiLogOut } from "react-icons/fi";
import styles from "../briars.module.css";
import type { Payload } from "../../../lib/briars/types";

export default function HeaderBar({
  data,
  toast,
  pinOk,
  onLogout,
  onDownloadCalendar,
}: {
  data: Payload;
  toast: string | null;
  pinOk: boolean;
  onLogout: () => void;
  onDownloadCalendar: () => void;
}) {
  const refreshed = (() => {
    if (!data?.refreshedAt) return null;
    const d = new Date(data.refreshedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  })();

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>
          <span className={styles.h1Main}>Briars</span>
          <span className={styles.h1Subhead}>Snr Masters</span>
        </h1>
        <div className={styles.sub}>
          Updated{refreshed ? `: ${refreshed}` : ": unavailable"}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onDownloadCalendar}
        >
          <FiCalendar size={16} />
          Add all to calendar
        </button>

        {pinOk ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSoft}`}
            onClick={onLogout}
          >
            <FiLogOut size={16} />
            Log out
          </button>
        ) : null}

        {toast ? <div className={styles.toast}>{toast}</div> : null}
      </div>
    </header>
  );
}
