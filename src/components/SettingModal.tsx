// components/SettingModal.tsx
"use client";
import React, { useState } from "react";
import SleepForm from "./SleepForm";
import FocusForm from "./FocusForm";
import { useSleepTimes } from "@/hooks/UseSleepTimes";
import { useFocusPeriods } from "@/hooks/UseFocusPeriods";
// ★ 変更点 1: 必要なフックをインポート
import { usePushNotifications } from "@/hooks/UsePushNotifications";

interface SettingModalProps {
  onClose: (minPerformances: number[], targetPerformance: number) => void;
}

const SettingModal: React.FC<SettingModalProps> = ({ onClose }) => {
  const { bedTime, wakeTime, setBedTime, setWakeTime } = useSleepTimes();
  const { focusPeriods, addFocusPeriod, removeFocusPeriod, updateFocusPeriod } =
    useFocusPeriods([{ start: "09:00", end: "12:00" }], true);

  // ★ 変更点 2: userId をフックから取得
  const { userId } = usePushNotifications();

  const [error, setError] = useState("");
  // ★ 変更点 3: 保存処理中の状態を追加
  const [isSaving, setIsSaving] = useState(false);

  const isValid = () =>
    !!bedTime && !!wakeTime && focusPeriods.some((p) => p.start && p.end);

  const handleSave = async () => {
    // ★ 変更点 4: userIdがない場合は処理を中断
    if (!isValid() || !userId) {
      setError("情報が不足しています。ページをリロードしてみてください。");
      return;
    }

    setIsSaving(true);
    setError("");

    // localStorage 保存…
    localStorage.setItem("initial-setup-complete", "true");
    localStorage.setItem("bedTime", bedTime);
    localStorage.setItem("wakeTime", wakeTime);
    localStorage.setItem("focusPeriods", JSON.stringify(focusPeriods));
    window.dispatchEvent(new CustomEvent("sleepTimesUpdated"));
    window.dispatchEvent(new CustomEvent("focusPeriodsUpdated"));

    // API コールしてローカル変数に受け取る
    let mins: number[] = [];
    let tgt = 0.7;
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_time: bedTime,
          wake_time: wakeTime,
          focus_periods: focusPeriods,
          caffeine_logs: [],
          userId: userId, // ★ 変更点 5: リクエストにuserIdを追加
        }),
      });
      if (!res.ok) {
        // エラーレスポンスの内容を具体的に表示するよう改善
        const errorData = await res
          .json()
          .catch(() => ({ error: "APIから有効なJSON応答がありませんでした" }));
        throw new Error(errorData.error || "APIリクエストに失敗しました");
      }
      const json = await res.json();
      mins = json.minPerformances || [];
      tgt = json.targetPerformance ?? 0.7;
      setError("");
    } catch (err) {
      // エラーメッセージを具体的に表示するよう改善
      const message =
        err instanceof Error
          ? err.message
          : "初期プラン取得中に不明なエラーが発生しました";
      setError(message);
      setIsSaving(false); // エラー時にボタンを再度有効化
      return;
    }

    onClose(mins, tgt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-center text-black">
          初回設定
        </h2>

        <SleepForm
          bedTime={bedTime}
          wakeTime={wakeTime}
          setBedTime={setBedTime}
          setWakeTime={setWakeTime}
          disabled={isSaving}
        />

        <FocusForm
          focusPeriods={focusPeriods}
          addFocusPeriod={addFocusPeriod}
          removeFocusPeriod={removeFocusPeriod}
          updateFocusPeriod={updateFocusPeriod}
          disabled={isSaving}
        />

        {error && <div className="text-red-600 mb-2">{error}</div>}

        <button
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          onClick={handleSave}
          // ★ 変更点 6: isSaving中またはuserIdがない場合はボタンを無効化
          disabled={isSaving || !userId}
        >
          {isSaving ? "保存中..." : "保存してはじめる"}
        </button>
      </div>
    </div>
  );
};

export default SettingModal;
