"use client";

import { CalendarDays, LogOut } from "lucide-react";
import styles from "../briars.module.css";
import type { Payload } from "../page";

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
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.h1}>Briars Fixtures</h1>
        <div className={styles.sub}>
          Source: <span className={styles.strong}>{data.source}</span> • Refreshed {data.refreshedAt}
        </div>
      </div>

      <div className={styles.actions}>
        {toast ? <span className={styles.toast}>{toast}</span> : null}

        <button className={`${styles.btn} ${styles.btnSoft}`} type="button" onClick={onDownloadCalendar}>
          <CalendarDays size={16} />
          Add all games to calendar
        </button>

        {pinOk ? (
          <button className={`${styles.btn} ${styles.btnSoft}`} type="button" onClick={onLogout}>
            <LogOut size={16} />
            Log out
          </button>
        ) : null}
      </div>
    </header>
  );
}
