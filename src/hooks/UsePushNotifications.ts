// src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

const USER_ID_KEY = "caffe-run-user-id";
const NOTIFICATION_PROMPTED_KEY = "caffe-run-notification-prompted";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let currentUserId = localStorage.getItem(USER_ID_KEY);
    if (!currentUserId) {
      currentUserId = uuidv4();
      localStorage.setItem(USER_ID_KEY, currentUserId);
    }
    setUserId(currentUserId);

    if (!("serviceWorker" in navigator && "PushManager" in window)) {
      console.error("Push Notifications are not supported.");
      setError("Push Notifications are not supported by this browser.");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker registration successful", reg);
        setSwRegistration(reg);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
        setError("Service Worker registration failed.");
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!swRegistration || !userId || !VAPID_PUBLIC_KEY) {
      return;
    }

    const prompted = localStorage.getItem(NOTIFICATION_PROMPTED_KEY);
    const permission = Notification.permission;

    if (permission === "default" && !prompted) {
      console.log("Conditions met, starting subscription process.");
      localStorage.setItem(NOTIFICATION_PROMPTED_KEY, "true");

      try {
        const readySwRegistration = await navigator.serviceWorker.ready;
        const sub = await readySwRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        console.log("PushManager subscribed successfully.");
        await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subscription: sub }),
        });

        console.log("Subscription sent to server.");
      } catch (err) {
        console.error("Failed to subscribe to push notifications:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred.",
        );
      }
    }
  }, [swRegistration, userId]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  return {
    userId,
    error,
  };
};
