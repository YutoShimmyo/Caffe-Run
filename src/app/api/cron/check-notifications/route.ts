// src/app/api/cron/check-notifications/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import webpush from "web-push";
import type { PushSubscription } from "web-push";

interface NotificationSchedule {
  subscriptions: PushSubscription[];
  notifyAt: string; // ISO文字列
  payload: string;
}

export async function GET() {
  const now = new Date();

  const schedules: NotificationSchedule[] = await kv.lrange("schedules", 0, -1);

  if (schedules.length === 0) {
    return NextResponse.json({ message: "送信する通知はありません。" });
  }

  const dueSchedules = schedules.filter((s) => new Date(s.notifyAt) <= now);
  const remainingSchedules = schedules.filter(
    (s) => new Date(s.notifyAt) > now,
  );

  if (dueSchedules.length > 0) {
    console.log(`${dueSchedules.length}件の予約を実行します...`);

    if (
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      console.error("VAPIDキーが設定されていません。");
      return NextResponse.json(
        { message: "VAPIDキーが未設定です。" },
        { status: 500 },
      );
    }

    webpush.setVapidDetails(
      "mailto:your-email@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    for (const schedule of dueSchedules) {
      for (const sub of schedule.subscriptions) {
        await webpush
          .sendNotification(sub, schedule.payload)
          .catch((err) => console.error(`送信に失敗:`, err.body));
      }
    }
  }

  await kv.del("schedules");
  if (remainingSchedules.length > 0) {
    await kv.lpush("schedules", ...remainingSchedules);
  }

  return NextResponse.json({
    success: true,
    sent: dueSchedules.length,
    remaining: remainingSchedules.length,
  });
}
