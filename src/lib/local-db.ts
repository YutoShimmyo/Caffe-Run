// src/lib/local-db.ts
import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "caffe-run-db";
const STORE_NAME = "schedules";

export interface ScheduleTask {
  id: number; // 通知時間 (Unixタイムスタンプ)
  userId: string;
  message: {
    title: string;
    body: string;
  };
  subscription: PushSubscription;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function setSchedules(tasks: ScheduleTask[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  // 既存のスケジュールをクリアしてから新しいスケジュールを保存
  await tx.store.clear();
  await Promise.all(tasks.map((task) => tx.store.put(task)));
  await tx.done;
  console.log("Schedules saved to IndexedDB.");
}

export async function getNextSchedule(): Promise<ScheduleTask | undefined> {
  const db = await getDb();
  // id (タイムスタンプ) でソートされた最初のスケジュールを取得
  const cursor = await db.transaction(STORE_NAME).store.openCursor();
  return cursor?.value;
}

export async function deleteSchedule(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
  console.log(`Schedule ${id} deleted from IndexedDB.`);
}
