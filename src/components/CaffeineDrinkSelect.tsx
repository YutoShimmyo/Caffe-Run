import React from "react";
import type { DrinkOption } from "@/lib/CaffeineDrinkOptions";

interface Props {
  drinkOptions: DrinkOption[];
  drink: string;
  mode: "preset" | "custom";
  setMode: (m: "preset" | "custom") => void;
  cups: number | string;
  setCups: (n: number) => void;
  ml: number;
  setMl: (n: number) => void;
  onDrinkChange: (drink: string) => void;
}

const CaffeineDrinkSelect: React.FC<Props> = ({
  drinkOptions,
  drink,
  mode,
  setMode,
  cups,
  setCups,
  ml,
  setMl,
  onDrinkChange,
}) => {
  // 選択中の飲料情報
  const selected =
    drinkOptions.find((d) => d.name === drink) || drinkOptions[0];
  const enableCustom = selected.enableCustomMl !== false;

  // 杯数入力時のカフェイン量計算
  const cupsNum = mode === "preset" ? Number(cups) : 0;
  const totalMl =
    mode === "preset" ? cupsNum * selected.defaultMlPerCup : Number(ml);

  // カフェイン含有量計算
  const caffeineMg =
    totalMl && selected.caffeineMgPer100ml
      ? Math.round((selected.caffeineMgPer100ml * totalMl) / 100)
      : 0;

  return (
    <div className="flex flex-col gap-2 flex-1">
      {/* 飲料名セレクトボックス */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">飲料名</label>
        <div className="flex items-center gap-2"></div>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
          value={drink}
          onChange={(e) => onDrinkChange(e.target.value)}
        >
          <option value="" disabled className="text-gray-400">
            選択してください
          </option>
          {drinkOptions.map((opt) => {
            // 1杯あたりのカフェイン量
            const caffeinePerCup = Math.round(
              (opt.caffeineMgPer100ml * opt.defaultMlPerCup) / 100,
            );
            return (
              <option key={opt.name} value={opt.name}>
                {opt.name}({opt.defaultMlPerCup}ml, {caffeinePerCup}mg)
              </option>
            );
          })}
        </select>
      </div>

      {/* 摂取量の入力欄（プリセット or 任意ml） */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">摂取量</label>
        <div className="flex gap-2">
          {/* 杯数 or 任意ml モード切替ボタン */}
          <button
            type="button"
            className={`px-3 py-1 rounded-l-xl border ${mode === "preset" ? "bg-blue-500 text-white" : "bg-white text-blue-500 border-blue-400"}`}
            onClick={() => setMode("preset")}
          >
            杯数
          </button>
          {enableCustom && (
            <button
              type="button"
              className={`px-3 py-1 rounded-r-xl border-l-0 border ${mode === "custom" ? "bg-blue-500 text-white" : "bg-white text-blue-500 border-blue-400"}`}
              onClick={() => setMode("custom")}
            >
              任意ml
            </button>
          )}
        </div>

        {/* 杯数入力（セレクトボックス） */}
        {mode === "preset" ? (
          <div className="flex items-center mt-2 gap-3">
            <select
              className="w-28 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
              value={cups}
              onChange={(e) => setCups(Number(e.target.value))}
            >
              {selected.cupPresets.map((n) => (
                <option key={n} value={n}>
                  {n === 0.5 ? "半分" : `${n}杯`}
                </option>
              ))}
            </select>
            {/* 「hoge杯 = fuga ml」 */}
            <span className="text-sm text-gray-500">
              {cups &&
                cups !== "" &&
                `${cups}杯 = ${cupsNum * selected.defaultMlPerCup}ml`}
              {/* カフェイン含有量表示 */}
              {cups && cups !== "" && (
                <span className="text-sm text-gray-500">
                  （{caffeineMg}mg）
                </span>
              )}
            </span>
          </div>
        ) : (
          // 任意ml入力
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min={10}
              step={10}
              className="w-28 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
              value={ml || ""}
              onChange={(e) => setMl(Number(e.target.value))}
              placeholder="入力してください"
            />
            <span className="text-gray-600">ml</span>
            {/* カフェイン含有量表示 */}
            {ml > 0 && (
              <span className="text-sm text-gray-500">
                （カフェイン: {caffeineMg}mg）
              </span>
            )}
          </div>
        )}

        {/* 杯数モードの時に1杯あたりmlを注記表示 */}
        {mode === "preset" && (
          <div className="text-xs text-gray-400 mt-1">
            1杯 = {selected.defaultMlPerCup}ml
          </div>
        )}
      </div>
    </div>
  );
};

export default CaffeineDrinkSelect;
