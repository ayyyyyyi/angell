// ============ 缓动曲线（变速推进的关键） ============
// 关键：纯「先慢后快」（easeIn）结尾斜率最大，会「越滚越猛 + 结尾急刹」，视觉不丝滑。
// 换成「缓入缓出」S 曲线（先慢 → 中快 → 结尾收住）后，全程平滑，没有猛冲急停的顿挫。
export const EASING = {
  linear:     (t) => t,
  easeIn:     (t) => t * t * t,                               // 纯先慢后快：结尾最猛，容易「急刹」（不丝滑，留作对比）
  easeInQuad: (t) => t * t,                                   // 平方版「先慢后快」
  easeOut:    (t) => 1 - Math.pow(1 - t, 3),                  // 先快后慢（一般不用，留作反向）
  easeInOut:  (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // 缓入缓出立方：慢→快→慢，全程丝滑
  smoothstep: (t) => t * t * (3 - 2 * t),                     // 更柔和的 S 曲线（两端斜率都归零，最丝滑）
};

// ============ 推镜头：分段驱动 ============
// 每个图层有自己的变化区间 [start, end] + 缓动曲线 ease，在区间内从 from 放大到 to
export const zoomRange = {
  bg:     { from: 1.00, to: 1.10, start: 0.00, end: 1.00, ease: 'linear'    },  // 背景：全程匀速微放大
  angel:  { from: 1.00, to: 2.20, start: 0.00, end: 0.60, ease: 'easeInOut' },  // 神像：逼近到 60% 停
  pillar: { from: 1.00, to: 2.20, start: 0.00, end: 0.45, ease: 'easeInOut' },  // 石柱：快速让开（45% 就停）
};
