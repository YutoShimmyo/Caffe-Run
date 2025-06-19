// hooks/useSleepTimes.ts
import { useState, useEffect } from "react";

export const useSleepTimes = () => {
  const [bedTime, setBedTime] = useState<string>("23:00");
  const [wakeTime, setWakeTime] = useState<string>("07:00");

  const loadFromStorage = () => {
    const savedBed = localStorage.getItem("bedTime");
    const savedWake = localStorage.getItem("wakeTime");
    if (savedBed) setBedTime(savedBed);
    if (savedWake) setWakeTime(savedWake);
  };

  useEffect(() => {
    loadFromStorage();

    // カスタムイベントを監視してlocalStorageの変更を検知
    const handleStorageChange = () => {
      loadFromStorage();
    };

    window.addEventListener("sleepTimesUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("sleepTimesUpdated", handleStorageChange);
    };
  }, []);

  // 保存時にlocalStorageにも書き込む（任意）
  const updateBedTime = (time: string) => {
    setBedTime(time);
    localStorage.setItem("bedTime", time);
  };
  const updateWakeTime = (time: string) => {
    setWakeTime(time);
    localStorage.setItem("wakeTime", time);
  };

  return {
    bedTime,
    wakeTime,
    setBedTime: updateBedTime,
    setWakeTime: updateWakeTime,
  };
};
