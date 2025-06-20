// src/app/api/cron/send-notifications/route.ts
import { kv } from "@/lib/kv";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { NextRequest } from "next/server";

// VAPIDキーの設定
if (
  !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY
) {
  console.warn("VAPID keys are not set. Push notifications are disabled.");
} else {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || "admin@example.com"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { success: false, message: "VAPID keys not configured." },
      { status: 500 },
    );
  }
  try {
    const scheduleKeys = [];
    let cursor = 0;
    do {
      const [nextCursor, keys] = await kv.scan(cursor, {
        match: "schedules:*",
      });
      cursor = Number(nextCursor);
      scheduleKeys.push(...keys);
    } while (cursor !== 0);

    if (scheduleKeys.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schedules to process.",
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const twoMinutesFromNow = now + 120;
    const threeMinutesFromNow = now + 180;
    let sentCount = 0;

    for (const key of scheduleKeys) {
      const tasks = await kv.zrange(
        key,
        `(${twoMinutesFromNow}`,
        threeMinutesFromNow,
        { byScore: true },
      );
      if (tasks.length === 0) {
        continue;
      }

      for (const task of tasks) {
        try {
          const taskData: {
            userId: string;
            message: object;
            subscription: webpush.PushSubscription;
          } = JSON.parse(task as string);
          const { userId, message, subscription } = taskData;
          console.log(
            `Sending 3-minute-warning notification to userId: ${userId}`,
          );
          await webpush.sendNotification(subscription, JSON.stringify(message));
          await kv.zrem(key, task);
          sentCount++;
        } catch (err) {
          if (
            err instanceof Error &&
            "statusCode" in err &&
            (err.statusCode === 410 || err.statusCode === 404)
          ) {
            const taskData = JSON.parse(task as string);
            console.log(
              `Subscription for userId: ${taskData.userId} is expired or invalid. Deleting user and task.`,
            );
            await kv.del(`user:${taskData.userId}`);
            await kv.zrem(key, task);
          } else {
            console.error(`Error processing task:`, err);
          }
        }
      }
    }
    return NextResponse.json({ success: true, sentCount });
  } catch (error) {
    console.error("Cron job failed:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return new NextResponse(message, { status: 500 });
  }
}
