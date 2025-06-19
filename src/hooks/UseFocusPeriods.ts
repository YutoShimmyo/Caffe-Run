import { useState, useEffect } from "react";

export interface FocusPeriod {
  start: string;
  end: string;
}

/**
 * フォーカス時間帯を管理するカスタムフック
 */
export function useFocusPeriods(
  initial?: FocusPeriod[],
  skipStorage?: boolean,
) {
  const [focusPeriods, setPeriods] = useState<FocusPeriod[]>(
    initial ?? [{ start: "09:00", end: "12:00" }],
  );

  const loadFromStorage = () => {
    const savedPeriods = localStorage.getItem("focusPeriods");
    if (savedPeriods) {
      try {
        const parsedPeriods = JSON.parse(savedPeriods);
        if (Array.isArray(parsedPeriods) && parsedPeriods.length > 0) {
          setPeriods(parsedPeriods);
        }
      } catch (error) {
        console.warn("Failed to load focus periods from localStorage:", error);
      }
    }
  };

  useEffect(() => {
    if (!skipStorage) {
      loadFromStorage();
    }

    // カスタムイベントを監視してlocalStorageの変更を検知
    const handleStorageChange = () => {
      if (!skipStorage) {
        loadFromStorage();
      }
    };

    window.addEventListener("focusPeriodsUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("focusPeriodsUpdated", handleStorageChange);
    };
  }, [skipStorage]);

  /** 新しいフォーカス時間帯を追加 */
  const addFocusPeriod = () => {
    setPeriods((prev) => {
      const newPeriods = [...prev, { start: "", end: "" }];
      localStorage.setItem("focusPeriods", JSON.stringify(newPeriods));
      return newPeriods;
    });
  };

  /** インデックス指定で時間帯を削除 */
  const removeFocusPeriod = (index: number) => {
    setPeriods((prev) => {
      const newPeriods = prev.filter((_, i) => i !== index);
      localStorage.setItem("focusPeriods", JSON.stringify(newPeriods));
      return newPeriods;
    });
  };

  /** インデックスとキーを指定して時間帯を更新 */
  const updateFocusPeriod = (
    idx: number,
    key: "start" | "end",
    value: string,
  ) => {
    setPeriods((prev) => {
      const newPeriods = prev.map((p, i) =>
        i === idx ? { ...p, [key]: value } : p,
      );
      localStorage.setItem("focusPeriods", JSON.stringify(newPeriods));
      return newPeriods;
    });
  };

  return {
    focusPeriods,
    addFocusPeriod,
    removeFocusPeriod,
    updateFocusPeriod,
  };
}
