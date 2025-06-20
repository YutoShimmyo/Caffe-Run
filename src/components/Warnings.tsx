"use client";

import React, { useEffect, useState } from "react";
import { Transition } from "@headlessui/react";

interface WarningsProps {
  minPerformances: number[]; // API で返ってきた 0〜1 の配列
  targetPerformance: number; // API で返ってきた目標値 0〜1
}

/**
 * 目標未達の時間帯が一つでもあれば、
 * 画面上部からポップアップ警告を表示するコンポーネント
 */
const Warnings: React.FC<WarningsProps> = ({
  minPerformances,
  targetPerformance,
}) => {
  // 目標未達があるかどうか
  const hasFailure = minPerformances.some((perf) => perf < targetPerformance);

  // ポップアップの表示制御
  const [show, setShow] = useState(hasFailure);

  // props が変わったときにも反映
  useEffect(() => {
    if (hasFailure) {
      setShow(true);
    }
  }, [hasFailure, minPerformances, targetPerformance]);

  // 自動で数秒後に消したい場合
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!hasFailure) return null;

  return (
    <div className="fixed inset-x-0 top-4 flex flex-col items-center z-50 pointer-events-none">
      <Transition
        appear
        show={show}
        enter="transform transition ease-out duration-300"
        enterFrom="-translate-y-12 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transform transition ease-in duration-200"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="-translate-y-12 opacity-0"
      >
        <div className="pointer-events-auto mb-2 max-w-lg w-full flex items-center bg-red-600 text-white px-5 py-4 rounded-lg shadow-2xl ring-4 ring-red-300 animate-pulse">
          {/* ⚠️ アイコン */}
          <svg
            className="w-6 h-6 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.68-1.36 3.445 0l5.504 9.79c.75 1.334-.213 
               2.111-1.372 2.111H4.125c-1.16 0-2.122-.777-1.372-2.11l5.504-9.79zM11 
               13a1 1 0 11-2 0 1 1 0 012 0zm-1-2a1 1 0 01.993.883L11 12v1a1 1 0 
               11-2 0v-1a1 1 0 011-1zm0-4a1 1 0 01.993.883L11 9v2a1 1 0 11-2 0V9a1 
               1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>

          <p className="flex-1 text-center text-sm md:text-base lg:text-lg font-semibold">
            入力された集中時間のうち、
            <br />
            目標値を下回る時間帯があります。
          </p>
        </div>
      </Transition>
    </div>
  );
};

export default Warnings;
