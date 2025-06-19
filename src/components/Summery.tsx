// src/components/Summery.tsx
"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";

export interface SummeryProps {
  caffeineData: number[]; // 各摂取記録のカフェイン量（mg単位）の配列
}

// 色定義
const COLOR_BLUE = "#2563eb"; // 摂取分（1周め）
const COLOR_GRAY = "#e5e7eb"; // 残り（200mgまでの灰色）
const COLOR_RED = "#ef4444"; // 超過分
const PIE_MAX = 200; // 1周あたり200mg

const Summery: React.FC<SummeryProps> = ({ caffeineData }) => {
  // 合計摂取量
  const total = caffeineData.reduce((sum, mg) => sum + mg, 0);

  // 円グラフ用データ構築
  const segments: { name: string; value: number; color: string }[] = [];
  if (total <= PIE_MAX) {
    if (total > 0)
      segments.push({ name: "摂取", value: total, color: COLOR_BLUE });
    const rest = PIE_MAX - total;
    if (rest > 0)
      segments.push({ name: "残り", value: rest, color: COLOR_GRAY });
  } else {
    segments.push({ name: "1周目", value: PIE_MAX, color: COLOR_BLUE });
    segments.push({ name: "超過分", value: total - PIE_MAX, color: COLOR_RED });
  }

  return (
    <div className="w-full max-w-sm mx-auto p-0 flex flex-col items-center">
      {/*タイトル */}
      <div className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-gray-700 mb-2 text-center">
        カフェイン総量
      </div>

      {/* グラフ */}
      <div className="w-full h-24 md:h-32 lg:h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart
            className="p-0 m-0 overflow-visible"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            style={{ padding: 0, margin: 0 }}
          >
            <Pie
              data={segments}
              dataKey="value"
              innerRadius="80%"
              outerRadius="100%"
              startAngle={450}
              endAngle={90}
              paddingAngle={0}
              stroke="white"
              labelLine={false}
            >
              {segments.map((seg, idx) => (
                <Cell key={idx} fill={seg.color} />
              ))}
              <Label
                position="center"
                value={`${total}/${PIE_MAX}mg`}
                fill="#111827"
                fontSize={15}
                fontWeight="bold"
                style={{ textAnchor: "middle", dominantBaseline: "middle" }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Summery;
