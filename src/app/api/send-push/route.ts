// src/app/api/send-push/route.ts
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import webpush, { PushSubscription } from "web-push";

// VAPIDキーの設定
if (
  !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY
) {
  throw new Error("VAPID keys are not set in environment variables.");
}

webpush.setVapidDetails(
  "mailto:hituyonai@gmail.com", //開発者のメールアドレス
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export async function POST(request: Request) {
  try {
    const { userId, payload } = await request.json();

    if (!userId || !payload) {
      return NextResponse.json(
        { error: "Missing userId or payload" },
        { status: 400 },
      );
    }

    // Vercel KVから購読情報を取得
    const subscription = await kv.get<PushSubscription>(`user:${userId}`);

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found for user" },
        { status: 404 },
      );
    }

    await webpush.sendNotification(subscription, JSON.stringify(payload));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending push notification:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(errorMessage, { status: 500 });
  }
}
