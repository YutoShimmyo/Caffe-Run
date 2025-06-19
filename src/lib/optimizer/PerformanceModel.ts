// /src/lib/optimizer/PerformanceModel.ts
// --------------------------------------------------
// 睡眠とカフェインの効果を計算するコアロジック (エラー修正版)

import { SleepPeriod, CaffeineDose } from "./interfaces";
import * as C from "./constants";

// モデルが管理する内部状態
interface ModelState {
  time: Date;
  processS: number; // 睡眠圧
  caffeineInGut: number; // 胃の中のカフェイン量
  caffeineInPlasma: number; // 血漿中のカフェイン濃度
}

export class PerformanceModel {
  /**
   * 睡眠履歴とカフェイン履歴から未来のパフォーマンスを予測する
   */
  public predict(
    targetTime: Date,
    sleepHistory: SleepPeriod[],
    caffeineHistory: CaffeineDose[],
    focusWindows: { start: Date; end: Date }[] = [],
  ): number {
    let state: ModelState;
    let wakeUpTime: Date;

    // 睡眠履歴がない場合はデフォルト値を返す
    if (sleepHistory.length === 0) {
      wakeUpTime = new Date(targetTime);
      wakeUpTime.setHours(6, 0, 0, 0);
      // ここでは再宣言せず、値を代入する
      state = {
        time: targetTime,
        processS: 0.5, // 適度な睡眠圧を仮定
        caffeineInGut: 0,
        caffeineInPlasma: 0,
      };
      // ★★★ calculatePerformanceに focusWindows を渡す ★★★
      return this.calculatePerformance(state, wakeUpTime, focusWindows);
    }

    // 履歴の中で最も古い睡眠開始時刻を見つける
    const firstSleepStart = new Date(
      Math.min(...sleepHistory.map((s) => s.start.getTime())),
    );

    // 就寝前に16時間起き続けていたと仮定し、その間の睡眠圧を計算する
    const PRE_SIMULATION_HOURS = 16;
    const preSimStartTime = new Date(
      firstSleepStart.getTime() - PRE_SIMULATION_HOURS * 3600 * 1000,
    );

    const assumedWakeUpForPreSim = new Date(preSimStartTime);

    // ここでも再宣言せず、値を代入する
    state = {
      time: preSimStartTime,
      processS: 0,
      caffeineInGut: 0,
      caffeineInPlasma: 0,
    };

    // 16時間の覚醒期間のシミュレーションを実行して睡眠圧を溜める
    while (state.time < firstSleepStart) {
      const nextTime = new Date(
        state.time.getTime() + C.TIME_STEP_SECONDS * 1000,
      );
      state = this.step(state, false, assumedWakeUpForPreSim);
      state.time = nextTime;
    }

    // targetTimeより前の直近の起床時刻を取得する
    const relevantSleepPeriods = sleepHistory.filter(
      (s) => s.end <= targetTime,
    );
    relevantSleepPeriods.sort((a, b) => b.end.getTime() - a.end.getTime());
    wakeUpTime =
      relevantSleepPeriods.length > 0
        ? relevantSleepPeriods[0].end
        : new Date(new Date(targetTime).setHours(6, 0, 0, 0));

    // メインのシミュレーションループ
    while (state.time < targetTime) {
      const currentTimeMs = state.time.getTime();
      const nextTime = new Date(currentTimeMs + C.TIME_STEP_SECONDS * 1000);

      const doseNow = caffeineHistory.find(
        (d) =>
          d.time.getTime() >= currentTimeMs &&
          d.time.getTime() < nextTime.getTime(),
      );
      if (doseNow) {
        state.caffeineInGut += doseNow.mg;
      }

      state = this.step(
        state,
        this.isSleeping(state.time, sleepHistory),
        wakeUpTime,
      );
      state.time = nextTime;
    }

    // ★★★ calculatePerformanceに focusWindows を渡す ★★★
    return this.calculatePerformance(state, wakeUpTime, focusWindows);
  }

  /**
   * 1タイムステップ分、状態を進める
   */
  private step(
    currentState: ModelState,
    isSleeping: boolean,
    wakeUpTime: Date,
  ): ModelState {
    const dt = C.TIME_STEP_SECONDS / 3600; // 時間単位に変換
    const nextState = { ...currentState };

    if (isSleeping) {
      nextState.processS -= currentState.processS * C.PROCESS_S_DECAY_RATE * dt;
    } else {
      const currentHours =
        currentState.time.getHours() + currentState.time.getMinutes() / 60;
      const PEAK_HOURS_AFTER_WAKE = 2;
      const wakeUpHours = wakeUpTime.getHours() + wakeUpTime.getMinutes() / 60;
      const peakTime = wakeUpHours + PEAK_HOURS_AFTER_WAKE;
      const processC =
        0.5 * (1 + Math.sin((currentHours - peakTime) * (Math.PI / 12)));

      const modulationFactor = 1.3 - 0.6 * processC;
      const modulatedIncreaseRate =
        C.PROCESS_S_INCREASE_RATE * modulationFactor;

      nextState.processS += modulatedIncreaseRate * dt;
    }
    nextState.processS = Math.max(0, nextState.processS);

    const absorption =
      C.CAFFEINE_ABSORPTION_RATE * currentState.caffeineInGut * dt;
    const elimination =
      C.CAFFEINE_ELIMINATION_RATE * currentState.caffeineInPlasma * dt;
    nextState.caffeineInGut -= absorption;
    nextState.caffeineInPlasma += absorption - elimination;
    nextState.caffeineInGut = Math.max(0, nextState.caffeineInGut);
    nextState.caffeineInPlasma = Math.max(0, nextState.caffeineInPlasma);

    return nextState;
  }
  private hourDiff(h1: number, h2: number): number {
    const diff = h1 - h2;
    if (diff > 12) return diff - 24; // 12時間より大きい差は逆方向から数える
    if (diff < -12) return diff + 24; // -12時間より小さい差も同様
    return diff;
  }

  /**
   * 現在の状態からパフォーマンスを計算
   */
  private calculatePerformance(
    state: ModelState,
    wakeUpTime: Date,
    // ★★★ 集中時間の引数を追加（オプショナル） ★★★
    focusWindows: { start: Date; end: Date }[] = [],
  ): number {
    // 現在のシミュレーション時刻を0.0～23.99時間の形式で取得
    const hours = state.time.getHours() + state.time.getMinutes() / 60;
    // 起床時刻を0.0～23.99時間の形式で取得
    const wakeUpTimeInHours =
      wakeUpTime.getHours() + wakeUpTime.getMinutes() / 60;

    const morningPeakTime = (wakeUpTimeInHours + 4) % 24;
    // ★★★ パフォーマンス低下の時刻を「let」で宣言し、後で変更できるようにする ★★★
    let dipTime = (wakeUpTimeInHours + 7) % 24;

    // 1. パフォーマンス低下の自然な中心時刻（naturalDipTime）を計算
    const naturalDipTime = (wakeUpTimeInHours + 7) % 24;
    const dipInfluenceHours = 2.5; //ずらし間隔

    // 2. 集中時間と低下時間が近すぎないかチェックし、近すぎる場合は低下時間を遅らせる
    if (focusWindows && focusWindows.length > 0) {
      for (const window of focusWindows) {
        const focusEndHour =
          window.end.getHours() + window.end.getMinutes() / 60;

        // 集中時間の終わりと、自然な低下の中心時刻の差を計算
        const diffHours = this.hourDiff(naturalDipTime, focusEndHour);

        // もし集中時間終了後、dipInfluenceHours(2.5時間)以内に低下が始まる場合
        if (diffHours >= 0 && diffHours < dipInfluenceHours) {
          // 低下の中心を「集中時間の終了 + 影響範囲」の時間まで遅らせる
          dipTime = (focusEndHour + dipInfluenceHours) % 24;
          // 該当する集中時間が見つかったため、他の時間はチェックしない
          break;
        }
      }
    }

    const AFTERNOON_PEAK_OFFSET_HOURS = 2;
    const afternoonPeakTime = (dipTime + AFTERNOON_PEAK_OFFSET_HOURS) % 24;

    const morningPeak = Math.exp(
      -Math.pow(this.hourDiff(hours, morningPeakTime), 2) /
        (2 * Math.pow(1.5, 2)),
    );
    const afternoonPeak = Math.exp(
      -Math.pow(this.hourDiff(hours, afternoonPeakTime), 2) /
        (2 * Math.pow(1.2, 2)),
    );
    //谷の深さ
    const dip =
      -0.01 *
      Math.exp(
        // ★★★ 可変になった dipTime を使用する ★★★
        -Math.pow(this.hourDiff(hours, dipTime), 2) / (2 * Math.pow(1, 2)),
      );
    // 各曲線を合成して、基本的な集中度の波(processC)を作成します。
    const processC = 0.4 + 0.55 * morningPeak + 0.65 * afternoonPeak + dip;

    const caffeineEffect =
      C.CAFFEINE_MAX_EFFECT *
      (state.caffeineInPlasma / (C.CAFFEINE_EC50 + state.caffeineInPlasma));
    const performance = processC - state.processS * 1.15 + caffeineEffect;
    return Math.max(0, Math.min(1, performance));
  }

  private isSleeping(time: Date, sleepHistory: SleepPeriod[]): boolean {
    return sleepHistory.some((p) => time >= p.start && time < p.end);
  }
}
