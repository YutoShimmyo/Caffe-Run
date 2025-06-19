// /src/lib/optimizer/CaffeineOptimizer.ts
// --------------------------------------------------
// 最適なカフェイン摂取スケジュールを探すクラス (ベストエフォート方式)

import { SleepPeriod, CaffeineDose, OptimizationParams } from "./interfaces";
import { PerformanceModel } from "./PerformanceModel";

export class CaffeineOptimizer {
  private model: PerformanceModel;

  constructor() {
    this.model = new PerformanceModel();
  }

  /**
   * スケジュールのパフォーマンスを評価し、成功した集中時間帯の数と、その間の最低パフォーマンスを返す
   * @returns {{ successfulWindows: number, minimumPerformance: number }} 評価結果
   */
  private evaluateSchedulePerformance(
    schedule: CaffeineDose[],
    sleepHistory: SleepPeriod[],
    params: OptimizationParams,
  ): { successfulWindows: number; minimumPerformance: number } {
    const { timeWindows, targetPerformance } = params;
    let successfulWindows = 0;
    let overallMinimumPerformance = 1.0; // パフォーマンスの最低値を記録（1.0から開始）

    for (const window of timeWindows) {
      let isWindowSuccessful = true;
      let windowMinimumPerformance = 1.0;

      for (
        let t = window.start.getTime();
        t <= window.end.getTime();
        t += 30 * 60 * 1000 // 30分ごとにチェック
      ) {
        const performance = this.model.predict(
          new Date(t),
          sleepHistory,
          schedule,
          params.timeWindows,
        );
        // このウィンドウ内の最低パフォーマンスを更新
        windowMinimumPerformance = Math.min(
          windowMinimumPerformance,
          performance,
        );
        if (performance < targetPerformance) {
          isWindowSuccessful = false;
        }
      }

      if (isWindowSuccessful) {
        successfulWindows++;
        // 全ての成功したウィンドウを通しての最低パフォーマンスを更新
        overallMinimumPerformance = Math.min(
          overallMinimumPerformance,
          windowMinimumPerformance,
        );
      }
    }

    // 成功したウィンドウが一つもなければ、最低パフォーマンスは0とする
    if (successfulWindows === 0) {
      return { successfulWindows, minimumPerformance: 0 };
    }

    return { successfulWindows, minimumPerformance: overallMinimumPerformance };
  }

  /**
   * 最善のカフェイン摂取スケジュールを見つける (ベストエフォート)
   */
  public findOptimalSchedule(
    sleepHistory: SleepPeriod[],
    params: OptimizationParams,
  ): CaffeineDose[] | null {
    const noCaffeinePerformance = this.evaluateSchedulePerformance(
      [],
      sleepHistory,
      params,
    );
    // もし全ての集中時間で目標を達成できるなら、カフェインは不要
    if (noCaffeinePerformance.successfulWindows === params.timeWindows.length) {
      return []; // 空の配列を返し、「カフェイン不要」と判断
    }
    let bestSchedule: CaffeineDose[] | null = null;
    let maxWindowsAchieved = 0;
    let bestMinimumPerformance = 0; // ★ 最低パフォーマンスの最高値を記録
    let minCaffeineForMaxWindows = Infinity;

    const defaultDoseOptions = [50, 100, 150, 200];
    const doseOptions = (params.doseOptions ?? defaultDoseOptions).filter(
      (d) => d <= params.maxDosePerIntake,
    );

    if (doseOptions.length === 0) return null;

    const timeSlots: Date[] = [];
    params.timeWindows.forEach((window) => {
      const primarySlot = new Date(window.start.getTime() - 30 * 60 * 1000);
      if (!timeSlots.some((t) => t.getTime() === primarySlot.getTime())) {
        timeSlots.push(primarySlot);
      }
      let t = new Date(window.start.getTime());
      while (t < window.end) {
        const isTooClose = timeSlots.some(
          (existingSlot) =>
            Math.abs(existingSlot.getTime() - t.getTime()) <
            params.minTimeBetweenDosesHours * 3600 * 1000,
        );
        if (!isTooClose) {
          timeSlots.push(new Date(t));
        }
        t = new Date(t.getTime() + 60 * 60 * 1000);
      }
    });

    timeSlots.sort((a, b) => a.getTime() - b.getTime());
    const searchSlots = timeSlots;

    const evaluateAndUpdateBest = (schedule: CaffeineDose[]) => {
      const {
        successfulWindows,
        minimumPerformance,
      } = // ★ 最低パフォーマンスを取得
        this.evaluateSchedulePerformance(schedule, sleepHistory, params);

      if (successfulWindows === 0) return;

      const totalCaffeine = schedule.reduce((sum, d) => sum + d.mg, 0);

      // --- ★ 評価ロジックを「最低パフォーマンス」優先に変更 ---
      // 1. 成功した時間帯の数が多いものを最優先
      if (successfulWindows > maxWindowsAchieved) {
        maxWindowsAchieved = successfulWindows;
        minCaffeineForMaxWindows = totalCaffeine;
        bestMinimumPerformance = minimumPerformance;
        bestSchedule = schedule;
      } else if (successfulWindows === maxWindowsAchieved) {
        // 2. 成功した時間帯の数が同じなら、カフェイン総量が少ないものを優先
        if (totalCaffeine < minCaffeineForMaxWindows) {
          minCaffeineForMaxWindows = totalCaffeine;
          bestMinimumPerformance = minimumPerformance;
          bestSchedule = schedule;
        } else if (totalCaffeine === minCaffeineForMaxWindows) {
          // 3. カフェイン総量も同じなら、パフォーマンスが高いものを優先（タイブレーク）
          if (minimumPerformance > bestMinimumPerformance) {
            bestMinimumPerformance = minimumPerformance;
            bestSchedule = schedule;
          }
        }
      }
    };
    // 1回摂取の全パターンを試す
    for (const slot of searchSlots) {
      for (const dose of doseOptions) {
        evaluateAndUpdateBest([{ time: slot, mg: dose }]);
      }
    }

    // 2回摂取の全パターンを試す
    if (searchSlots.length >= 2) {
      for (let i = 0; i < searchSlots.length; i++) {
        for (let j = i + 1; j < searchSlots.length; j++) {
          for (const dose1 of doseOptions) {
            for (const dose2 of doseOptions) {
              evaluateAndUpdateBest([
                { time: searchSlots[i], mg: dose1 },
                { time: searchSlots[j], mg: dose2 },
              ]);
            }
          }
        }
      }
    }
    // フォールバックで使用する摂取量を決定（パラメータで指定されていなければ200mg）
    const doseForFallback = params.fallbackDose ?? 200;
    const finalFallbackDose = Math.min(
      doseForFallback,
      params.maxDosePerIntake,
    );

    if (!bestSchedule && params.timeWindows.length > 0) {
      const firstFocusStart = params.timeWindows[0].start;
      const intakeTime = new Date(firstFocusStart.getTime() - 30 * 60 * 1000);

      // 1回の最大摂取量を超えないように調整したフォールバック量を適用
      bestSchedule = [{ time: intakeTime, mg: finalFallbackDose }];
    }
    // 強制的なフォールバック提案ロジック
    // 各集中時間帯に対して、すでに提案があるかチェックする
    if (bestSchedule === null) {
      bestSchedule = [];
    }

    const finalSchedule = bestSchedule;

    params.timeWindows.forEach((window) => {
      // このウィンドウをカバーする提案がすでにあるかチェック
      const isWindowCovered = finalSchedule.some((dose) => {
        const doseTime = dose.time.getTime();
        const windowStartTime = window.start.getTime();
        const windowEndTime = window.end.getTime();
        // 集中開始1時間前から、集中終了までの間に摂取提案があれば「カバーされている」と見なす
        return (
          doseTime >= windowStartTime - 1 * 3600 * 1000 &&
          doseTime <= windowEndTime
        );
      });

      // もしカバーされていない場合、フォールバックの提案を追加する
      if (!isWindowCovered) {
        const intakeTime = new Date(window.start.getTime() - 30 * 60 * 1000);
        // 1回の最大摂取量を超えないように調整したフォールバック量を適用
        finalSchedule.push({ time: intakeTime, mg: finalFallbackDose });
      }
    });
    // 最終的なスケジュールを時系列順に並び替える
    finalSchedule.sort((a, b) => a.time.getTime() - b.time.getTime());

    return finalSchedule;
  }
}
