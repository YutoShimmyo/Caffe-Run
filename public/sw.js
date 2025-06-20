// public/sw.js

const DB_NAME = "caffe_run_db";
const STORE_NAME = "schedules";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject("Error opening DB");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function getNextScheduleFromDB() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      resolve(event.target.result?.value);
    };
  });
}

async function deleteScheduleFromDB(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
}
// --- ヘルパーここまで ---

let a_timeoutId = null;

async function scheduleNextNotification() {
  if (a_timeoutId) {
    clearTimeout(a_timeoutId);
    a_timeoutId = null;
  }

  const nextTask = await getNextScheduleFromDB();
  if (!nextTask) {
    console.log("No more schedules.");
    return;
  }

  const delay = nextTask.id - Date.now();
  if (delay <= 0) {
    // 既に時間切れの場合は即時実行（またはエラー処理）
    showNotification(nextTask);
    await deleteScheduleFromDB(nextTask.id);
    scheduleNextNotification(); // 次のタスクを予約
    return;
  }
  
  console.log(`Next notification scheduled in ${Math.round(delay / 1000)}s`);
  
  a_timeoutId = setTimeout(async () => {
    await showNotification(nextTask);
    await deleteScheduleFromDB(nextTask.id);
    scheduleNextNotification(); // 次のタスクを予約
  }, delay);
}

function showNotification(task) {
  console.log("Showing notification:", task.message.body);
  return self.registration.showNotification(task.message.title, {
    body: task.message.body,
    icon: '/icons/icon-192x192.png',
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NEXT_NOTIFICATION') {
    console.log("Received a message to schedule next notification.");
    scheduleNextNotification();
  }
});

self.addEventListener('activate', (event) => {
  console.log("Service worker activated. Scheduling next notification.");
  event.waitUntil(scheduleNextNotification());
});

self.addEventListener("push", (event) => {
    const data = event.data?.json() ?? {
      title: "Caffe-Run",
      body: "カフェイン摂取の時間です！",
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192x192.png", // 事前に適切なサイズのアイコンを配置してください
      }),
    );
  });
  
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            let client = clientList[0];
            for (let i = 0; i < clientList.length; i++) {
              if (clientList[i].focused) {
                client = clientList[i];
              }
            }
            return client.focus();
          }
          return clients.openWindow("/");
        }),
    );
  });