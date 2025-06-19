// src/hooks/useCaffeineLogs.ts
import { useState, useEffect } from "react";
import { CaffeineLogEntry } from "../components/CaffeineLogTable";

const CAFFEINE_LOGS_STORAGE_KEY = "caffeine-logs";

export function useCaffeineLogs(): [
  CaffeineLogEntry[] | null,
  React.Dispatch<React.SetStateAction<CaffeineLogEntry[] | null>>,
] {
  const [logs, setLogs] = useState<CaffeineLogEntry[] | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(CAFFEINE_LOGS_STORAGE_KEY);
        setLogs(saved ? JSON.parse(saved) : []);
      } catch (e) {
        console.error("Failed to load logs", e);
        setLogs([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && logs !== null) {
      try {
        window.localStorage.setItem(
          CAFFEINE_LOGS_STORAGE_KEY,
          JSON.stringify(logs),
        );
      } catch (e) {
        console.error("Failed to save logs", e);
      }
    }
  }, [logs]);

  return [logs, setLogs];
}
