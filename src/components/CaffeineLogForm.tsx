"use client";
import React, { useState } from "react";
import { DRINK_OPTIONS, DrinkOption } from "../lib/CaffeineDrinkOptions";
import CaffeineDrinkSelect from "./CaffeineDrinkSelect";
import CaffeineLogTable, { CaffeineLogEntry } from "./CaffeineLogTable";

// ドリンク摂取量(ml)からカフェイン摂取量(mg)へ計算する関数
function calcCaffeineMg(drink: DrinkOption, ml: number): number {
  return Math.round((drink.caffeineMgPer100ml * ml) / 100);
}

// 現在時刻を "HH:MM" 形式で返すユーティリティ関数
function getNowTimeString(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface Props {
  logs: CaffeineLogEntry[] | null;
  setLogs: React.Dispatch<React.SetStateAction<CaffeineLogEntry[] | null>>;
}

// カフェイン摂取記録フォームのコンポーネント
const CaffeineLogForm: React.FC<Props> = ({ logs, setLogs }) => {
  const [time, setTime] = useState(getNowTimeString());
  const [drinkName, setDrinkName] = useState(DRINK_OPTIONS[0].name);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [cups, setCups] = useState(DRINK_OPTIONS[0].cupPresets[0]);
  const [ml, setMl] = useState(DRINK_OPTIONS[0].defaultMlPerCup);

  // const [logs, setLogs] = useCaffeineLogs(); // カスタムフックから状態取得

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedDrink = DRINK_OPTIONS.find((d) => d.name === drinkName)!;
  const totalMl =
    mode === "preset"
      ? Number(cups) * selectedDrink.defaultMlPerCup
      : Number(ml);

  const handleDrinkChange = (next: string) => {
    setDrinkName(next);
    const found = DRINK_OPTIONS.find((d) => d.name === next)!;
    setCups(found.cupPresets[0]);
    setMl(found.defaultMlPerCup);
    setMode("preset");
  };

  const handleAddLog = () => {
    if (!time) {
      setError("摂取時間を入力してください");
      setSuccess("");
      return;
    }
    setError("");
    const caffeineMg = calcCaffeineMg(selectedDrink, totalMl);
    setLogs((prev) => [
      ...(prev || []),
      {
        time,
        drink: drinkName,
        mode,
        cups: mode === "preset" ? Number(cups) : undefined,
        ml: totalMl,
        caffeineMg,
      },
    ]);
    setTime(getNowTimeString());
    setSuccess("カフェイン摂取履歴を登録しました");
    setTimeout(() => setSuccess(""), 2000);
  };

  const handleDeleteLog = (idx: number) => {
    setLogs((prev) => (prev ? prev.filter((_, i) => i !== idx) : []));
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 bg-white rounded-2xl shadow-md">
      <div className="flex flex-col gap-4 mb-4">
        <div>
          <CaffeineDrinkSelect
            drinkOptions={DRINK_OPTIONS}
            drink={drinkName}
            mode={mode}
            setMode={setMode}
            cups={cups}
            setCups={setCups}
            ml={ml}
            setMl={setMl}
            onDrinkChange={handleDrinkChange}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">摂取時間</label>
          <input
            type="time"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <button
        className="w-full mb-4 px-6 py-2 bg-blue-500 text-white font-semibold rounded-xl shadow hover:bg-blue-600 transition"
        onClick={handleAddLog}
        type="button"
      >
        追加
      </button>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      {success && <div className="text-green-600 text-sm mb-2">{success}</div>}

      <CaffeineLogTable logs={logs || []} onDeleteLog={handleDeleteLog} />
    </div>
  );
};

export default CaffeineLogForm;
