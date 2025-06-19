/// <reference lib="webworker" />

// Service Worker内では 'self' を 'this' のように使います
// この行は、TypeScriptにService Workerの型定義を認識させるためのものです
/** @type {ServiceWorkerGlobalScope} */
const self = /** @type {ServiceWorkerGlobalScope} */ (this);

// Service Workerがインストールされたときに一度だけ実行される
self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  // 新しいService Workerをすぐに有効化する
  event.waitUntil(self.skipWaiting());
});

// Service Workerが有効化されたときに実行される
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  // 古いキャッシュなどをここで削除できる（今回は何もしない）
  event.waitUntil(self.clients.claim());
});

// プッシュ通知をサーバーから受け取ったときに実行される
self.addEventListener("push", (event) => {
  console.log("Push notification received");

  // サーバーから送られてくるJSONデータを取得
  // データがなければデフォルトのメッセージを使う
  const data = event.data
    ? event.data.json()
    : { title: "Caffe-Run", body: "新しい通知です" };

  const title = data.title;
  const options = {
    body: data.body,
    icon: "/icon-192x192.png", // publicフォルダに置いたアイコンへのパス
    badge: "/icon-96x96.png", // Androidなどで表示される小さなアイコン
  };

  // 通知を表示する処理。これが完了するまでService Workerは終了しない
  event.waitUntil(self.registration.showNotification(title, options));
});
