"use client";

import { CalendarDays, LogOut } from "lucide-react";
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
  const refreshed =
    data?.refreshedAt
      ? new Date(data.refreshedAt).toLocaleString("en-AU", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Briars Fixtures</h1>
        <div className={styles.sub}>
          {data.team} • {data.source}
          {refreshed ? ` • Updated ${refreshed}` : ""}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onDownloadCalendar}
        >
          <CalendarDays size={16} />
          Add all to calendar
        </button>

        {pinOk ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSoft}`}
            onClick={onLogout}
          >
            <LogOut size={16} />
            Log out
          </button>
        ) : null}

        {toast ? <div className={styles.toast}>{toast}</div> : null}
      </div>
    </header>
  );
}
