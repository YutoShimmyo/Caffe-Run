// src/app/api/plan/route.ts

import {
  SleepPeriod,
  OptimizationParams,
  CaffeineDose,
} from "@/lib/optimizer/interfaces";
import { PerformanceModel } from "@/lib/optimizer/PerformanceModel";
import { CaffeineOptimizer } from "@/lib/optimizer/CaffeineOptimizer";
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import webpush, { PushSubscription } from "web-push";
import type { CaffeineLogEntry } from "@/components/CaffeineLogTable";

// VAPIDキーの設定
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || "admin@example.com"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("VAPID keys are not set. Push notifications are disabled.");
}

const timeToDate = (timeStr: string, date: Date): Date => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bed_time, wake_time, focus_periods, caffeine_logs, userId } = body;

    // --- バリデーション (変更なし) ---
    if (
      !bed_time ||
      !wake_time ||
      !focus_periods ||
      !Array.isArray(focus_periods) ||
      focus_periods.length === 0
    ) {
      return NextResponse.json(
        { error: "必須の時刻データが不足しています。" },
        { status: 400 },
      );
    }
    const validFocusPeriods = focus_periods.filter(
      (p: { start: string; end: string }) => p && p.start && p.end,
    );
    if (validFocusPeriods.length === 0) {
      return NextResponse.json(
        { error: "有効な集中時間がありません。" },
        { status: 400 },
      );
    }
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // --- データの前処理 (変更なし) ---
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const bedTimeOnSameDay = timeToDate(bed_time, today);
    const wakeTimeOnSameDay = timeToDate(wake_time, today);
    const bedTimeDate =
      bedTimeOnSameDay > wakeTimeOnSameDay ? yesterday : today;
    const finalBedTime = timeToDate(bed_time, bedTimeDate);
    const finalWakeTime = timeToDate(wake_time, today);
    const sleepHistory: SleepPeriod[] = [
      { start: finalBedTime, end: finalWakeTime },
    ];
    const actualCaffeineHistory: CaffeineDose[] = (caffeine_logs || []).map(
      (log: CaffeineLogEntry) => ({
        time: timeToDate(log.time, today),
        mg: log.caffeineMg,
      }),
    );
    const sleepDurationMs = finalWakeTime.getTime() - finalBedTime.getTime();
    const sleepDurationHours = sleepDurationMs / (1000 * 60 * 60);
    const SHORT_SLEEP_THRESHOLD_HOURS = 5;
    const isShortSleep = sleepDurationHours < SHORT_SLEEP_THRESHOLD_HOURS;
    const fallbackDose = isShortSleep ? 200 : 200;
    const doseOptions = isShortSleep ? [150, 200] : [50, 100, 150, 200];
    const params: OptimizationParams = {
      timeWindows: validFocusPeriods.map((p) => {
        const startDate = timeToDate(p.start, today);
        let endDate = timeToDate(p.end, today);
        if (startDate > endDate) {
          endDate = timeToDate(p.end, tomorrow);
        }
        return { start: startDate, end: endDate };
      }),
      targetPerformance: 0.7,
      maxDosePerIntake: 200,
      minTimeBetweenDosesHours: 0.5,
      fallbackDose,
      doseOptions,
    };

    const optimizer = new CaffeineOptimizer();
    const optimalSchedule = optimizer.findOptimalSchedule(sleepHistory, params);

    if (optimalSchedule && optimalSchedule.length > 0) {
      console.log(`Scheduling notifications for userId: ${userId}`);

      // 最初にユーザーの購読情報を一度だけ取得
      const subscription = await kv.get<PushSubscription>(`user:${userId}`);

      if (subscription) {
        const scheduleKey = `schedules:${userId}`;

        // 古いスケジュールをクリア
        await kv.del(scheduleKey);

        const promises = optimalSchedule.map((dose) => {
          const notificationTime = dose.time; // 摂取時間
          const unixTimestamp = Math.floor(notificationTime.getTime() / 1000); // 秒単位のタイムスタンプ

          const task = {
            userId: userId,
            subscription: subscription,
            message: {
              title: "caffe-run",
              body: `まもなくカフェイン ${dose.mg}mg の摂取時間です！`,
              url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000", // 通知クリック時の遷移先URL
            },
          };

          // Sorted Setにタスクを追加。スコアは摂取時間のタイムスタンプ
          return kv.zadd(scheduleKey, {
            score: unixTimestamp,
            member: JSON.stringify(task),
          });
        });

        await Promise.all(promises);
        console.log(`Successfully scheduled ${promises.length} notifications.`);
      } else {
        console.log(
          `No subscription found for userId: ${userId}. Skipping scheduling.`,
        );
      }
    }

    // --- グラフデータ生成 (変更なし) ---
    // ( ... グラフ生成ロジック ... )
    const model = new PerformanceModel();
    const simulationData: { time: string; value: number }[] = [];
    const dayStart = timeToDate(wake_time, today);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(dayEnd.getHours() + 18);
    const windowMinPerformances = new Array(params.timeWindows.length).fill(
      1.1,
    );
    const combinedCaffeineHistory = [
      ...actualCaffeineHistory,
      ...(optimalSchedule || []),
    ];
    for (
      let t = dayStart.getTime();
      t <= dayEnd.getTime();
      t += 15 * 60 * 1000
    ) {
      const currentTime = new Date(t);
      const performance = model.predict(
        currentTime,
        sleepHistory,
        combinedCaffeineHistory,
        params.timeWindows,
      );
      params.timeWindows.forEach((window, index) => {
        if (currentTime >= window.start && currentTime <= window.end) {
          windowMinPerformances[index] = Math.min(
            windowMinPerformances[index],
            performance,
          );
        }
      });
      simulationData.push({
        time: currentTime.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: Math.max(5, Math.round(performance * 100)),
      });
    }
    const currentStatusData: { time: string; value: number }[] = [];
    for (
      let t = dayStart.getTime();
      t <= dayEnd.getTime();
      t += 15 * 60 * 1000
    ) {
      const currentTime = new Date(t);
      const performance = model.predict(
        currentTime,
        sleepHistory,
        actualCaffeineHistory,
        params.timeWindows,
      );
      currentStatusData.push({
        time: currentTime.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: Math.max(5, Math.round(performance * 100)),
      });
    }

    // --- レスポンス (変更なし) ---
    // APIは計算結果をクライアントに返すだけ。DB保存や通知は行わない。
    const responseData = {
      recommended: optimalSchedule && optimalSchedule.length > 0,
      caffeinePlan: (optimalSchedule || []).map((dose) => ({
        time: dose.time.toISOString(), // ★ ISO文字列として返す
        caffeineAmount: dose.mg,
      })),
      // ... (simulationData, currentStatusDataなど)
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
