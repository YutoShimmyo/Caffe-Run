// src/app/api/subscribe/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    if (!subscription) {
      return new NextResponse("No subscription data provided.", {
        status: 400,
      });
    }
    await kv.sadd("subscriptions", subscription);
    return NextResponse.json({
      success: true,
      message: "購読情報を受け取りました。",
    });
  } catch (error) {
    console.error("購読情報の保存中にエラー:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
