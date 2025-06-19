// src/lib/store.ts
import type { PushSubscription } from "web-push";

// 通知予約の型定義
export interface NotificationSchedule {
  subscription: PushSubscription;
  notifyAt: Date; // 通知を送信すべき日時
  payload: string; // 通知の内容
}

// 本番ではデータベースに置き換えます
// サーバーのメモリ上にデータを保存するための簡易的なストア
export const subscriptions = new Set<PushSubscription>();
export const schedules: NotificationSchedule[] = [];
