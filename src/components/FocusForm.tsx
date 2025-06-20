"use client";
import React from "react";

export interface FocusPeriod {
  start: string;
  end: string;
}

export interface FocusFormProps {
  focusPeriods: FocusPeriod[];
  addFocusPeriod: () => void;
  removeFocusPeriod: (idx: number) => void;
  updateFocusPeriod: (idx: number, key: "start" | "end", value: string) => void;
  disabled?: boolean;
}

export const FocusForm: React.FC<FocusFormProps> = ({
  focusPeriods,
  addFocusPeriod,
  removeFocusPeriod,
  updateFocusPeriod,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {focusPeriods.map((period, idx) => (
        <div key={idx} className="flex flex-col">
          <div className="flex items-center gap-3 w-full">
            <label className="text-gray-600 text-sm font-medium min-w-[95px]">
              集中時間
            </label>
            <input
              type="time"
              value={period.start}
              onChange={(e) => updateFocusPeriod(idx, "start", e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 bg-white w-24 text-black"
              disabled={disabled}
            />
            <span className="text-gray-500">～</span>
            <input
              type="time"
              value={period.end}
              onChange={(e) => updateFocusPeriod(idx, "end", e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 bg-white w-24 text-black"
              disabled={disabled}
            />
            {focusPeriods.length > 1 && (
              <button
                type="button"
                onClick={() => removeFocusPeriod(idx)}
                className="ml-2 text-red-500 font-bold text-lg px-2 rounded hover:bg-red-100"
                disabled={disabled}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addFocusPeriod}
        className="mt-2 flex items-center text-blue-600 font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled}
      >
        <span className="text-xl mr-1">＋</span>集中時間帯を追加
      </button>
    </div>
  );
};

export default FocusForm;
