import { SleepPeriod, OptimizationParams } from "@/lib/optimizer/interfaces";
import { PerformanceModel } from "@/lib/optimizer/PerformanceModel";
import { CaffeineOptimizer } from "@/lib/optimizer/CaffeineOptimizer";
import { NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { kv } from "@vercel/kv";

// --- 型定義（フロントエンドからのリクエストボディ） ---
export type FocusPeriodRequest = {
  start: string; // "09:00"
  end: string; // "17:00"
};

/**
 * "HH:mm" 形式の時刻文字列を、指定された日付のDateオブジェクトに変換する
 * @param timeStr "HH:mm"
 * @param date 基準となる日付
 */
const timeToDate = (timeStr: string, date: Date): Date => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bed_time, wake_time, focus_periods } = body;

    // --- バリデーション ---
    if (
      !bed_time ||
      !wake_time ||
      !focus_periods ||
      focus_periods.length === 0
    ) {
      return NextResponse.json(
        { error: "必須の時刻データが不足しています。" },
        { status: 400 },
      );
    }
    const validFocusPeriods = focus_periods.filter(
      (p: FocusPeriodRequest) => p.start && p.end,
    );
    if (validFocusPeriods.length === 0) {
      return NextResponse.json(
        { error: "有効な集中時間がありません。" },
        { status: 400 },
      );
    }

    // --- データの前処理 ---
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // 時刻の前後関係を比較するために、一旦同じ日付のDateオブジェクトに変換
    const bedTimeOnSameDay = timeToDate(bed_time, today);
    const wakeTimeOnSameDay = timeToDate(wake_time, today);

    // 就寝時刻が起床時刻より後（例: 23:00 > 07:00）なら、就寝日は昨日とする
    // そうでなければ（例: 01:00 < 09:00）、就寝日も今日とする
    const bedTimeDate =
      bedTimeOnSameDay > wakeTimeOnSameDay ? yesterday : today;

    const finalBedTime = timeToDate(bed_time, bedTimeDate);
    const finalWakeTime = timeToDate(wake_time, today);

    const sleepHistory: SleepPeriod[] = [
      {
        start: finalBedTime,
        end: finalWakeTime,
      },
    ];

    // 睡眠時間を計算 (時間単位)
    const sleepDurationMs = finalWakeTime.getTime() - finalBedTime.getTime();
    const sleepDurationHours = sleepDurationMs / (1000 * 60 * 60);

    const SHORT_SLEEP_THRESHOLD_HOURS = 5;
    const isShortSleep = sleepDurationHours < SHORT_SLEEP_THRESHOLD_HOURS;

    // 睡眠時間に応じてフォールバック量と、最適化で試行する選択肢を変更する
    const fallbackDose = isShortSleep ? 200 : 200;
    const doseOptions = isShortSleep ? [150, 200] : [50, 100, 150, 200];

    const params: OptimizationParams = {
      timeWindows: validFocusPeriods.map((p: FocusPeriodRequest) => {
        const startDate = timeToDate(p.start, today);
        let endDate = timeToDate(p.end, today);

        // 集中時間の開始時刻が終了時刻より後の場合（例: 23:00 > 05:00）、
        // 日をまたいだと判断し、終了日を明日に設定する
        if (startDate > endDate) {
          endDate = timeToDate(p.end, tomorrow);
        }

        return {
          start: startDate,
          end: endDate,
        };
      }),
      targetPerformance: 0.7,
      maxDosePerIntake: 200,
      minTimeBetweenDosesHours: 0.5, // 間隔を短くして柔軟性を高める
      fallbackDose: fallbackDose,
      doseOptions: doseOptions,
    };

    // --- 最適化の実行 ---
    const optimizer = new CaffeineOptimizer();
    const optimalSchedule = optimizer.findOptimalSchedule(sleepHistory, params);

    // --- パフォーマンス予測グラフの生成 ---
    const model = new PerformanceModel();
    const simulationData: { time: string; value: number }[] = [];
    const dayStart = timeToDate(wake_time, today);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(dayEnd.getHours() + 18);

    const windowMinPerformances = new Array(params.timeWindows.length).fill(
      1.1,
    ); // 1より大きい初期値

    for (
      let t = dayStart.getTime();
      t <= dayEnd.getTime();
      t += 15 * 60 * 1000
    ) {
      const currentTime = new Date(t);
      const performance = model.predict(
        currentTime,
        sleepHistory,
        optimalSchedule || [],
        params.timeWindows,
      );

      // 現在時刻がどの集中時間帯に含まれるかチェックし、最低パフォーマンスを更新
      params.timeWindows.forEach((window, index) => {
        if (currentTime >= window.start && currentTime <= window.end) {
          windowMinPerformances[index] = Math.min(
            windowMinPerformances[index],
            performance, // 0-1のパフォーマンス値を直接比較
          );
        }
      });

      simulationData.push({
        time: currentTime.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: Math.max(5, Math.round(performance * 100)), // キーを "focus" に変更し、値を0-100の範囲にする
      });
    }

    // --- 2. カフェインを摂取しなかった場合の覚醒度（現在の覚醒度グラフ用）---
    const noCaffeineData: { time: string; value: number }[] = [];
    for (
      let t = dayStart.getTime();
      t <= dayEnd.getTime();
      t += 15 * 60 * 1000
    ) {
      const currentTime = new Date(t);
      // model.predictの第3引数（カフェイン履歴）に空の配列[]を渡す
      const performance = model.predict(
        currentTime,
        sleepHistory,
        [],
        params.timeWindows,
      );
      noCaffeineData.push({
        time: currentTime.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: Math.max(5, Math.round(performance * 100)),
      });
    }

    // --- 最終的なレスポンス ---
    const isRecommended = optimalSchedule && optimalSchedule.length > 0;

    // 通知予約ロジック
    if (isRecommended) {
      const firstIntake = optimalSchedule[0];
      const notifyAt = new Date(firstIntake.time.getTime() - 5 * 60 * 1000);
      const payload = JSON.stringify({
        title: "Caffe-Run そろそろ準備の時間です！☕",
        body: `5分後に ${firstIntake.mg}mg のカフェイン摂取がおすすめです！`,
        url: "/",
      });

      const subscriptions: PushSubscription[] =
        await kv.smembers("subscriptions");
      console.log(`取得した購読情報: ${subscriptions.length}件`);

      if (subscriptions.length > 0) {
        const schedule = {
          subscriptions: subscriptions,
          notifyAt: notifyAt.toISOString(),
          payload: payload,
        };
        await kv.lpush("schedules", schedule);
        console.log(`${subscriptions.length}件の通知を予約しました。`);
      }
    }

    const responseData = {
      recommended: isRecommended, // ここで推奨フラグをセット
      caffeinePlan: isRecommended
        ? optimalSchedule.map((dose) => ({
            time: dose.time.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit", //ここで時間をフロントエントに返してる
            }),
            caffeineAmount: dose.mg, //同様にカフェイン量を返している
          }))
        : [],
      simulationData: simulationData,
      currentStatusData: noCaffeineData,
      minPerformances: windowMinPerformances,
      targetPerformance: params.targetPerformance,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("API Error:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "サーバーでエラーが発生しました。", details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "サーバーで不明なエラーが発生しました。" },
      { status: 500 },
    );
  }
}
