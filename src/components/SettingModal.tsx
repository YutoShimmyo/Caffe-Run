// components/SettingModal.tsx
"use client";
import React, { useState } from "react";
import SleepForm from "./SleepForm";
import FocusForm from "./FocusForm";
import { useSleepTimes } from "@/hooks/UseSleepTimes";
import { useFocusPeriods } from "@/hooks/UseFocusPeriods";

interface SettingModalProps {
  onClose: (minPerformances: number[], targetPerformance: number) => void;
}

const SettingModal: React.FC<SettingModalProps> = ({ onClose }) => {
  const { bedTime, wakeTime, setBedTime, setWakeTime } = useSleepTimes();
  const { focusPeriods, addFocusPeriod, removeFocusPeriod, updateFocusPeriod } =
    useFocusPeriods([{ start: "09:00", end: "12:00" }], true);

  const [error, setError] = useState("");

  const isValid = () =>
    !!bedTime && !!wakeTime && focusPeriods.some((p) => p.start && p.end);

  const handleSave = async () => {
    if (!isValid()) {
      setError("全ての情報を入力してください");
      return;
    }

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
        }),
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      mins = json.minPerformances || [];
      tgt = json.targetPerformance ?? 0.7;
      setError("");
    } catch {
      setError("初期プラン取得中にエラーが発生しました");
      return;
    }

    // **ここでローカル変数を渡す**
    onClose(mins, tgt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-center">初回設定</h2>

        <SleepForm
          bedTime={bedTime}
          wakeTime={wakeTime}
          setBedTime={setBedTime}
          setWakeTime={setWakeTime}
          disabled={false}
        />

        <FocusForm
          focusPeriods={focusPeriods}
          addFocusPeriod={addFocusPeriod}
          removeFocusPeriod={removeFocusPeriod}
          updateFocusPeriod={updateFocusPeriod}
          disabled={false}
        />

        {error && <div className="text-red-600 mb-2">{error}</div>}

        <button
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded"
          onClick={handleSave}
        >
          保存してはじめる
        </button>
      </div>
    </div>
  );
};

export default SettingModal;
