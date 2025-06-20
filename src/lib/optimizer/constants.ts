// /src/lib/optimizer/constants.ts
// --------------------------------------------------
// 科学モデルで使用する定数
// --------------------------------------------------

/** 睡眠圧Sの上昇率 (単位時間あたり) - 値を小さくして疲れにくくする */
export const PROCESS_S_INCREASE_RATE = 0.025; // 0.05から変更
/** 睡眠圧Sの減衰率 (指数関数的減衰) */
export const PROCESS_S_DECAY_RATE = 0.3;
/** カフェインの吸収速度 (胃→血漿) */
export const CAFFEINE_ABSORPTION_RATE = 1.5;
/** カフェインの排出速度 (半減期 約5.7時間に対応) */
export const CAFFEINE_ELIMINATION_RATE = 0.1216;
/** カフェイン効果の最大値 - 値を大きくして効果を高める */
export const CAFFEINE_MAX_EFFECT = 0.4; // 0.3から変更
/** カフェイン効果が半減する血中濃度 */
export const CAFFEINE_EC50 = 100;
/** シミュレーションの時間ステップ (秒) */
export const TIME_STEP_SECONDS = 60 * 5; // 5分間隔
