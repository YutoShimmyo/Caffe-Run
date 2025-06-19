import { useMemo } from "react";
import { CaffeineLogEntry } from "../components/CaffeineLogTable";

/**
 * 全履歴から caffeineMg の配列のみを返すフック
 * @param logs CaffeineLogEntry[] | null
 * @returns number[]  // 各エントリの caffeineMg
 */
export function useCaffeineAmounts(logs: CaffeineLogEntry[] | null): number[] {
  return useMemo(() => {
    if (!logs) return [];
    return logs.map((entry) => entry.caffeineMg);
  }, [logs]);
}
