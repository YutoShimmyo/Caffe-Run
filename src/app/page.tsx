"use client";
import React, { useState, useEffect, useCallback } from "react";
import SettingModal from "../components/SettingModal";
import BlueButton from "../components/BlueButton";
import UnityModelWrapper from "@/components/UnityModelWrapper";
import TopBackButton from "@/components/TopBackButton";
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
import NotificationInitializer from "@/components/NotificationInitializer";
import { usePushNotifications } from "@/hooks/UsePushNotifications";
import { setSchedules } from "@/lib/local-db";

const HomePage: React.FC = () => {
  const { userId } = usePushNotifications();
  // developブランチの新しいカスタムフックで状態を管理
  const { bedTime, wakeTime, setBedTime, setWakeTime } = useSleepTimes();
  // 状態の初期化（localStorageの値を優先）
  const { focusPeriods, addFocusPeriod, removeFocusPeriod, updateFocusPeriod } =
    useFocusPeriods();

  // カフェイン摂取量の履歴取得
  const [logs, setLogs] = useCaffeineLogs();
  const amounts = useCaffeineAmounts(logs);

  // あなたが追加した、エラー、ローディング、グラフ関連のstate
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
    loaderUrl: "/unity/Build/Downloads.loader.js",
    dataUrl: "/unity/Build/Downloads.data",
    frameworkUrl: "/unity/Build/Downloads.framework.js",
    codeUrl: "/unity/Build/Downloads.wasm",
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [minPerformances, setMinPerformances] = useState<number[]>([]);
  const [targetPerformance, setTargetPerformance] = useState<number>(0.7);

  // 入力チェック関数を、developブランチの変数名(camelCase)に合わせる
  const isValid = useCallback(() => {
    return (
      !!bedTime && !!wakeTime && focusPeriods.some((p) => p.start && p.end)
    );
  }, [bedTime, wakeTime, focusPeriods]);

  // あなたが実装したAPI呼び出し関数を、developブランチの変数名に合わせる
  // handleGeneratePlan を useCallback に変更
  const handleGeneratePlan = useCallback(async () => {
    if (!isValid()) {
      setError("集中時間・睡眠時間を入力してください");
      return;
    }
    setError("");
    setIsLoading(true);
    setGraphData({ simulation: [], current: [] });

    if (!userId) {
      setError("ユーザーIDが取得できません。ページをリロードしてください。");
      return;
    }

    try {
      const savedLogs = window.localStorage.getItem("caffeine-logs");
      const caffeine_logs = savedLogs ? JSON.parse(savedLogs) : [];

      const requestData = {
        bed_time: bedTime,
        wake_time: wakeTime,
        focus_periods: focusPeriods,
        caffeine_logs,
        userId: userId,
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

      if (result.caffeinePlan && result.caffeinePlan.length > 0) {
        // ユーザーの購読情報を取得
        const swReg = await navigator.serviceWorker.ready;
        const subscription = await swReg.pushManager.getSubscription();

        if (subscription) {
          const tasks = result.caffeinePlan.map((plan: Recommendation) => {
            const doseTime = new Date(plan.time);
            return {
              id: doseTime.getTime(),
              userId: userId,
              message: {
                title: "Caffe-Run",
                body: `まもなく ${doseTime.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })} にカフェイン ${plan.caffeineAmount}mg の摂取時間です！`,
              },
              subscription: subscription.toJSON(),
            };
          });

          // 1. IndexedDBにスケジュールを保存
          await setSchedules(tasks);

          // 2. Service Workerに次の通知を予約するようメッセージを送る
          navigator.serviceWorker.controller?.postMessage({
            type: "SCHEDULE_NEXT_NOTIFICATION",
          });
        }
      }

      setGraphData({
        simulation: result.simulationData || [],
        current: result.currentStatusData || [],
      });
      setRecommendations(result.caffeinePlan || []);

      // Warnings コンポーネントに必要なデータを設定
      setMinPerformances(result.minPerformances || []);
      setTargetPerformance(result.targetPerformance);

      setActiveGraph("simulation");
    } catch (error) {
      console.error("エラーが発生しました:", error);
      setError("プラン生成中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [bedTime, wakeTime, focusPeriods, isValid, userId]);

  // --- 集中度をUnityに定期的に送信するuseEffectを追加 ---
  useEffect(() => {
    // ★ 修正点2: isLoadedでUnityの準備完了をチェック
    if (!isLoaded || graphData[activeGraph].length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const now = new Date();
      const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;

      // ★ 修正点3: グラフデータから現在時刻に一致するものを探す（シンプル版）
      const currentPoint = graphData[activeGraph].find(
        (p) => p.time === nowStr,
      );

      if (currentPoint) {
        // ★ 修正点1: currentPoint.value（集中度）をそのまま使う
        const focusValue = currentPoint.value;

        sendMessage(
          "unitychan",
          "SetAnimationSpeed",
          focusValue.toString(), // ★ 修正点1: 未定義だったconcentrationValueをfocusValueに修正
        );
      }
    }, 2000); // 2秒ごと

    return () => clearInterval(intervalId);
  }, [isLoaded, sendMessage, graphData, activeGraph]);
  // 初回起動時にモーダルを出す
  useEffect(() => {
    if (!localStorage.getItem("initial-setup-complete")) {
      setShowSettingModal(true);
      //handleGeneratePlan();
    } else {
      // 初回設定が終わっている場合はプランを自動生成
      handleGeneratePlan();
    }
  }, [handleGeneratePlan]); // handleGeneratePlanが生成されるたびに実行
  return (
    <div>
      <NotificationInitializer />
      <Warnings
        minPerformances={minPerformances}
        targetPerformance={targetPerformance}
      />
      <TopBackButton />
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
            <UnityModelWrapper unityProvider={unityProvider} />
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
