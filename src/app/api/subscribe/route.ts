import { NextResponse } from "next/server";
import { z } from "zod";
import { kv } from "@/lib/kv"; // Vercel KVをインポート

const subscribeSchema = z.object({
  subscription: z.any(),
  userId: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = subscribeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.flatten() },
      { status: 400 },
    );
  }

  const { subscription, userId } = result.data;
  console.log(`Subscribing userId: ${userId}`);

  try {
    // 購読情報をKVに保存
    await kv.set(`user:${userId}`, subscription);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription failed:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return new NextResponse(message, { status: 500 });
  }
}
