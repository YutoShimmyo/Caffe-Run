// src/app/api/send-push/route.ts

import { NextResponse } from "next/server";
import webpush from "web-push";
import type { PushSubscription } from "web-push";

// TODO: 本来はデータベースから購読情報を取得します。
// 今回はテストのため、一時的にメモリ上の `subscribe` API からインポートします。
// この方法はサーバーが再起動するとデータが消えるため、本番ではDBに置き換えます。
const subscriptions: PushSubscription[] = []; // この部分は後でDB連携に置き換えます

export async function POST() {
  // 1. VAPIDキーが設定されているかチェック
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    console.error("VAPIDキーが.env.localに設定されていません。");
    return new NextResponse("VAPID keys are not configured.", { status: 500 });
  }

  // 2. web-pushライブラリにVAPIDキーを設定
  webpush.setVapidDetails(
    "mailto:your-email@example.com", // FIXME: あなたの連絡先メールアドレスに変更してください
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  // 3. 通知のペイロード（内容）を定義
  const payload = JSON.stringify({
    title: "Caffe-Runよりお知らせ☕",
    body: "これはテスト通知です。最適なタイミングでまたお知らせします！",
  });

  try {
    // 4. 保存されているすべての購読情報に対して通知を送信
    //    (実際のアプリでは、特定のユーザーにのみ送信します)
    if (subscriptions.length === 0) {
      // TODO: この部分は本来DBから取得するため、subscribe/route.ts側で管理するように変更します。
      //       現状はテスト用に空のままとします。
      console.log("通知先の購読情報がありません。");
    }

    const sendPromises = subscriptions.map((sub) =>
      webpush.sendNotification(sub, payload),
    );

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: "Push notification sent successfully.",
    });
  } catch (error) {
    console.error("Error sending push notification", error);
    return new NextResponse("Error sending push notification", { status: 500 });
  }
}
