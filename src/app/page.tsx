"use client";
import React, { useState, useEffect, useCallback } from "react";
import SettingModal from "../components/SettingModal";
import BlueButton from "../components/BlueButton";
import UnityModel from "../components/UnityModel";
import Chart from "@/components/Chart";
import RecommendedPlanList from "../components/NextCaffeineTime";
import CaffeineLogForm from "../components/CaffeineLogForm";
import SleepForm from "../components/SleepForm";
import FocusForm from "../components/FocusForm";
import { useFocusPeriods } from "@/hooks/UseFocusPeriods";
import { useSleepTimes } from "@/hooks/UseSleepTimes";
import Summery from "../components/Summery";
import type { Recommendation } from "../components/NextCaffeineTime";
import { useCaffeineAmounts } from "../hooks/UseCaffeineAmounts";
import { useCaffeineLogs } from "@/hooks/UseCaffeineLogs";
import { useUnityContext } from "react-unity-webgl";
import Warnings from "@/components/Warnings";
import TopBackButton from "@/components/TopBackButton";

const HomePage: React.FC = () => {
  // developブランチの新しいカスタムフックで状態を管理
  const { bedTime, wakeTime, setBedTime, setWakeTime } = useSleepTimes();
  // 状態の初期化（localStorageの値を優先）
  const { focusPeriods, addFocusPeriod, removeFocusPeriod, updateFocusPeriod } =
    useFocusPeriods();
  // カフェイン摂取量の履歴を取得
  const [logs, setLogs] = useCaffeineLogs();
  const amounts = useCaffeineAmounts(logs);

  // エラー、ローディング、グラフ関連のstate
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogFormOpen, setIsLogFormOpen] = useState(true);
  const [showSettingModal, setShowSettingModal] = useState(false);
  type GraphPoint = { time: string; value: number };
  const [graphData, setGraphData] = useState<{
    simulation: GraphPoint[];
    current: GraphPoint[];
  }>({ simulation: [], current: [] });
  const [activeGraph, setActiveGraph] = useState<"simulation" | "current">(
    "simulation",
  );
  const { unityProvider, sendMessage, isLoaded } = useUnityContext({
    loaderUrl: "/unity/Build/public.loader.js", // Unityビルドファイルのパス
    dataUrl: "/unity/Build/public.data",
    frameworkUrl: "/unity/Build/public.framework.js",
    codeUrl: "/unity/Build/public.wasm",
  });

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [minPerformances, setMinPerformances] = useState<number[]>([]);
  const [targetPerformance, setTargetPerformance] = useState<number>(0.7);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // 入力チェック関数を、developブランチの変数名(camelCase)に合わせる
  const isValid = useCallback(() => {
    return (
      !!bedTime && !!wakeTime && focusPeriods.some((p) => p.start && p.end)
    );
  }, [bedTime, wakeTime, focusPeriods]);

  const handleSubscribe = useCallback(async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    setSubscriptionError("");

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSubscriptionError("このブラウザはプッシュ通知に対応していません。");
      setIsSubscribing(false);
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      setSubscriptionError("VAPIDキーが設定されていません。");
      setIsSubscribing(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // ユーザーが許可しなかった場合は、静かに処理を終える
        setIsSubscribing(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      alert("プッシュ通知が有効になりました！");
    } catch (error) {
      console.error("プッシュ通知の購読に失敗しました:", error);
      if (error instanceof Error) setSubscriptionError(error.message);
      else setSubscriptionError("不明なエラーが発生しました。");
    } finally {
      setIsSubscribing(false);
    }
  }, [isSubscribing]);

  const handleGeneratePlan = useCallback(async () => {
    if (!isValid()) {
      setError("集中時間・睡眠時間を入力してください");
      return;
    }
    setError("");
    setIsLoading(true);
    setGraphData({ simulation: [], current: [] });

    try {
      const savedLogs = window.localStorage.getItem("caffeine-logs");
      const caffeine_logs = savedLogs ? JSON.parse(savedLogs) : [];
      const requestData = {
        bed_time: bedTime,
        wake_time: wakeTime,
        focus_periods: focusPeriods,
        caffeine_logs,
      };

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error("APIリクエストに失敗しました");
      }

      const result = await response.json();

      setGraphData({
        simulation: result.simulationData || [],
        current: result.currentStatusData || [],
      });
      setRecommendations(result.caffeinePlan || []);

      // Warnings コンポーネントに必要なデータを設定
      setMinPerformances(result.minPerformances || []);
      setTargetPerformance(result.targetPerformance);

      setActiveGraph("simulation");
      if (
        result.caffeinePlan.length > 0 &&
        window.Notification &&
        Notification.permission === "default"
      ) {
        // ブラウザの通知許可ダイアログを直接呼び出す
        await handleSubscribe();
      }
    } catch (error) {
      console.error("エラーが発生しました:", error);
      setError("プラン生成中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [bedTime, wakeTime, focusPeriods, isValid, handleSubscribe]);

  // --- 集中度をUnityに定期的に送信するuseEffectを追加 ---
  useEffect(() => {
    // 5秒ごとに実行するタイマー
    const interval = setInterval(() => {
      // Unityがロード済みで、グラフデータが存在する場合のみ実行
      if (isLoaded && graphData.simulation.length > 0) {
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // グラフデータから現在時刻に最も近いデータポイントを探す
        const currentPoint = graphData.simulation.find(
          (p) => p.time === currentTimeStr,
        );

        if (currentPoint) {
          const concentrationValue = currentPoint.value; // 集中度の値 (0-100)

          console.log(`Sending to Unity: ${concentrationValue}`); // デバッグ用

          // Unityのメソッドを呼び出す
          // 第1引数: GameObject名 ("PerformanceController")
          // 第2引数: C#スクリプトのメソッド名 ("UpdateConcentration")
          // 第3引数: 送信する値 (数値を文字列に変換)
          sendMessage(
            "PerformanceController",
            "UpdateConcentration",
            concentrationValue.toString(),
          );
        }
      }
    }, 5000); // 5000ms = 5秒

    // コンポーネントがアンマウントされるときにタイマーをクリア
    return () => clearInterval(interval);
  }, [isLoaded, graphData.simulation, sendMessage]); // 依存配列に設定

  // 初回起動時にモーダルを出す
  useEffect(() => {
    if (!localStorage.getItem("initial-setup-complete")) {
      setShowSettingModal(true);
    }
  }, []);
  return (
    <div>
      <TopBackButton />
      <Warnings
        minPerformances={minPerformances}
        targetPerformance={targetPerformance}
      />
      {showSettingModal && (
        <SettingModal
          onClose={(mins, tgt) => {
            // 親で受け取ってモーダルを閉じつつ警告データを保存
            setMinPerformances(mins);
            setTargetPerformance(tgt);
            setShowSettingModal(false);
            // 続けて一度プラン生成も行う (モーダル内で生成済みなら不要)
            // handleGeneratePlan();
          }}
        />
      )}
      {!showSettingModal && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8">
          <div className="w-full max-w-2xl flex justify-center">
            {/* UnityModelにunityProviderを渡す */}
            <UnityModel unityProvider={unityProvider} />
          </div>

          {/* developブランチの新しいレイアウトを採用 */}
          <div className="w-full max-w-2xl mx-auto flex flex-row items-center justify-center gap-1 mt-8 px-0">
            <div className="flex-2">
              <RecommendedPlanList recommendations={recommendations} />
            </div>
            <div className="flex-1">
              <Summery caffeineData={amounts} />
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto mt-8 mb-2">
            <div className="flex items-center mb-2">
              <button
                type="button"
                className="mr-3 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 font-bold transition text-xl"
                onClick={() => setIsLogFormOpen((p) => !p)}
                aria-label={isLogFormOpen ? "閉じる" : "開く"}
              >
                {isLogFormOpen ? "-" : "+"}
              </button>
              <h2 className="text-lg font-bold text-gray-800">
                カフェイン摂取記録
              </h2>
            </div>
            {isLogFormOpen && <CaffeineLogForm logs={logs} setLogs={setLogs} />}
          </div>

          <main className="flex flex-col items-start flex-1 w-full max-w-2xl mx-auto px-4">
            {/* developブランチの新しいフォームコンポーネントを使用 */}
            <SleepForm
              bedTime={bedTime}
              wakeTime={wakeTime}
              setBedTime={setBedTime}
              setWakeTime={setWakeTime}
              disabled={isLoading}
            />
            <FocusForm
              focusPeriods={focusPeriods}
              addFocusPeriod={addFocusPeriod}
              removeFocusPeriod={removeFocusPeriod}
              updateFocusPeriod={updateFocusPeriod}
              disabled={isLoading}
            />

            {error && (
              <div className="text-red-600 font-semibold mb-3">{error}</div>
            )}
            {subscriptionError && (
              <div className="text-red-600 font-semibold mb-3">
                {subscriptionError}
              </div>
            )}

            <div className="w-full flex justify-center mt-8 mb-6">
              <BlueButton
                label={isLoading ? "計画生成中..." : "カフェイン計画を生成する"}
                href="#"
                onClick={handleGeneratePlan}
                disabled={isLoading}
              />
            </div>

            {/* あなたが実装したグラフ表示部分 */}
            {(graphData.simulation.length > 0 ||
              graphData.current.length > 0) && (
              <div className="w-full max-w-2xl flex flex-col items-center justify-center mt-8">
                <div className="flex justify-center gap-4 mb-4">
                  <button
                    onClick={() => setActiveGraph("simulation")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeGraph === "simulation" ? "bg-indigo-500 text-white shadow" : "bg-gray-200 text-gray-700"}`}
                  >
                    理想の集中度
                  </button>
                  <button
                    onClick={() => setActiveGraph("current")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeGraph === "current" ? "bg-teal-500 text-white shadow" : "bg-gray-200 text-gray-700"}`}
                  >
                    現在の集中度
                  </button>
                </div>
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                    カフェイン効果予測
                  </h3>
                  <Chart data={graphData[activeGraph]} />
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default HomePage;
