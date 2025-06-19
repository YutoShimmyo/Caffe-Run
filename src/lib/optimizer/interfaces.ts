// /src/lib/optimizer/interfaces.ts
// --------------------------------------------------
// 型定義をまとめたファイル

/** 睡眠期間 */
export interface SleepPeriod {
  start: Date;
  end: Date;
}

/** カフェイン摂取量 */
export interface CaffeineDose {
  time: Date;
  mg: number;
}

/** 最適化のパラメータ */
export interface OptimizationParams {
  timeWindows: { start: Date; end: Date }[]; // この期間のパフォーマンスを最大化
  targetPerformance: number; // 維持したい最低パフォーマンスレベル (0-1)
  maxDosePerIntake: number; // 1回あたりの最大摂取量 (mg)
  minTimeBetweenDosesHours: number; // 摂取の最短間隔 (時間)
  fallbackDose?: number; // 追加：フォールバック時の推奨摂取量(mg)
  doseOptions?: number[]; // ★追加：最適化で試行するカフェイン量の選択肢
}
