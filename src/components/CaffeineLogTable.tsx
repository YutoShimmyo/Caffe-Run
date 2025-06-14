import React, { useState } from "react";

// 1件の摂取記録データの型定義
export interface CaffeineLogEntry {
  time: string; // 摂取時間（hh:mm形式）
  drink: string; // 飲料名
  mode: "preset" | "custom"; // 入力モード：プリセットか任意mlか
  cups?: number; // 杯数（プリセット時のみ）
  ml: number; // 総摂取量（ml）
  caffeineMg: number; // 総カフェイン量（mg）
}

interface Props {
  logs: CaffeineLogEntry[];
  onDeleteLog: (index: number) => void;
}

// カフェイン摂取履歴テーブル本体コンポーネント
const CaffeineLogTable: React.FC<Props> = ({ logs, onDeleteLog }) => {
  // テーブルの開閉状態を管理
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-6">
      {/* タイトル＆開閉ボタン */}
      <div className="flex items-center mb-2">
        <h3 className="text-md font-semibold text-gray-700 mr-2">摂取履歴</h3>
        <button
          type="button"
          className="text-blue-500 underline text-xs"
          onClick={() => setOpen((o) => !o)} // 折り畳み/展開をトグル
        >
          {open ? "▲" : "▼"}
        </button>
      </div>
      {/* 開いているときだけ履歴を表示 */}
      {open &&
        (logs.length === 0 ? (
          // 履歴がなければメッセージ
          <div className="text-gray-400 text-sm">まだ記録がありません。</div>
        ) : (
          // 履歴テーブル本体
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 text-gray-500">時間</th>
                <th className="text-left p-2 text-gray-500">飲料名</th>
                <th className="text-left p-2 text-gray-500">杯数/量</th>
                <th className="text-left p-2 text-gray-500">総摂取ml</th>
                <th className="text-left p-2 text-gray-500">
                  カフェイン量(mg)
                </th>
                {/* ADDED: 削除ボタン用の見出しを追加 */}
                <th className="text-left p-2 text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {/* 履歴データを1行ずつ出力 */}
              {logs.map((log, idx) => (
                <tr
                  key={idx}
                  className="border-b last:border-none text-gray-900"
                >
                  <td className="p-2">{log.time}</td>
                  <td className="p-2">{log.drink}</td>
                  <td className="p-2">
                    {/* プリセット時は杯数、カスタム時はmlで表示 */}
                    {log.mode === "preset"
                      ? log.cups !== undefined
                        ? `${log.cups}杯`
                        : "-"
                      : `${log.ml}ml（手入力）`}
                  </td>
                  <td className="py-2">{log.caffeineMg}</td>
                  <td className="p-2">{log.ml}</td>
                  <td className="p-2">{log.caffeineMg}</td>
                  {/* ADDED: 削除ボタンを追加 */}
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => onDeleteLog(idx)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
};

export default CaffeineLogTable;
