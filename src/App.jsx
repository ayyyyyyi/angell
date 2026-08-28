import { useEffect, useRef, useState } from 'react';
import SwarmCursor from './SwarmCursor.jsx';
import { EASING, zoomRange } from './easing.js';
import { CARDS, flat } from './cards.js';

// ============ 工具函数 ============
function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export default function App() {
  // ---- React 状态：只存「离散开关」类的东西 ----
  const [activeCard, setActiveCard] = useState(null);   // 当前点开的卡片（null = 浮层关闭）
  const [videoShown, setVideoShown] = useState(false);  // 视频场景是否已转场出来

  // ---- ref：存「每帧都在变」的动画值（用 ref 直接改 DOM，不触发 React 重渲染，这是做 rAF 动画的标准做法）----
  const layerRefs = useRef({});        // 三张图层 { bg, angel, pillar }
  const cardElsRef = useRef([]);       // 5 张卡片的 DOM
  const fillRef = useRef(null);        // 进度条填充
  const labelRef = useRef(null);       // 阶段文字
  const trackRef = useRef(null);       // 进度条轨道
  const videoSceneRef = useRef(null);  // 视频场景容器
  const videoRef = useRef(null);       // <video> 元素

  const stateRef = useRef({
    target: 0,        // 目标进度
    progress: 0,      // 平滑后的进度（实际渲染用）
    scene: 'parallax',// 场景状态机：parallax → transition → video
    transitioning: false,
    cardT: 0,         // 卡片浮现进度 0~1
  });

  useEffect(() => {
    let raf = 0;
    const S = stateRef.current;
    const WHEEL_STEP = 1 / 20;   // 滚 20 格到底

    // ---- 推镜：根据进度 p 更新三层图的 transform/opacity ----
    function apply(p) {
      const els = layerRefs.current;
      for (const name in zoomRange) {
        const r = zoomRange[name];
        const t = clamp((p - r.start) / (r.end - r.start), 0, 1);
        const e = EASING[r.ease || 'linear'](t);
        const s = r.from + (r.to - r.from) * e;

        if (name === 'angel') {
          const dy = -e * 20;
          const op = e < 0.85 ? 1 : 1 - (e - 0.85) * 2;
          els[name].style.opacity = op.toFixed(2);
          els[name].style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
        } else if (name === 'pillar') {
          const op = p < 0.80 ? 1 : Math.max(0, 1 - (p - 0.80) * 5);
          els[name].style.opacity = op.toFixed(2);
          els[name].style.transform = 'scale(' + s.toFixed(3) + ')';
        } else {
          els[name].style.transform = 'scale(' + s.toFixed(3) + ')';
        }
      }

      fillRef.current.style.width = (p * 100).toFixed(1) + '%';
      if (p < 0.80) labelRef.current.textContent = '石柱让开 · 神像同步推进';
      else if (p < 0.90) labelRef.current.textContent = '贴脸 · 石柱退场';
      else labelRef.current.textContent = '贴脸 · 转场';
    }

    // ---- 卡片浮现：整体淡入 + 横排一字展开 ----
    function setCards(t) {
      const cOp = clamp(t, 0, 1);
      const liftPx = (1 - cOp) * 260;
      cardElsRef.current.forEach((el, i) => {
        const idx = i - (CARDS.length - 1) / 2;
        const x = idx * flat.spread * t;
        const y = flat.baseY + liftPx * (1 - t);
        const rot = idx * flat.tilt * t;
        el.style.opacity = cOp.toFixed(3);
        el.style.pointerEvents = cOp > 0.5 ? 'auto' : 'none';
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
      });
    }

    // ---- 滚到底 → 视差淡出 → 切视频画面 → 卡片浮现 ----
    function transitionToVideo() {
      if (S.transitioning) return;
      S.transitioning = true;
      S.scene = 'transition';

      ['bg', 'angel', 'pillar'].forEach((n) => {
        const el = layerRefs.current[n];
        el.style.transition = 'opacity 0.6s ease';
        el.style.opacity = '0';
      });

      trackRef.current.style.transition = 'opacity 0.5s ease';
      trackRef.current.style.opacity = '0';
      labelRef.current.textContent = '转场 · 进入视频画面';
      labelRef.current.style.transition = 'opacity 0.5s ease';
      labelRef.current.style.opacity = '0';

      setVideoShown(true);
      const v = videoRef.current;
      if (v) { v.currentTime = 0; v.play().catch(() => {}); }

      setTimeout(() => { S.scene = 'video'; }, 650);
    }

    // ---- 平滑循环 ----
    const loop = () => {
      S.progress += (S.target - S.progress) * 0.12;
      if (Math.abs(S.target - S.progress) < 0.0005) S.progress = S.target;

      if (S.scene === 'parallax' && !S.transitioning) {
        apply(S.progress);
        if (S.progress >= 0.97) transitionToVideo();
      } else if (S.scene === 'video') {
        S.cardT += (1 - S.cardT) * 0.08;
        if (1 - S.cardT < 0.001) S.cardT = 1;
        setCards(S.cardT);
      }

      raf = requestAnimationFrame(loop);
    };

    // ---- 驱动方式 ----
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
      S.target = clamp(S.target + dir * WHEEL_STEP, 0, 1);
    };

    let dragging = false;
    const onMouseDown = () => { dragging = true; };
    const onMouseUp = () => { dragging = false; };
    const onMouseLeave = () => { dragging = false; };
    const onMouseMove = (e) => {
      if (dragging) S.target = clamp(1 - e.clientY / window.innerHeight, 0, 1);
      if (trackDragging) S.target = trackFromEvent(e);
    };

    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      if (touchY !== null) {
        const dy = touchY - e.touches[0].clientY;
        S.target = clamp(S.target + dy * 0.001, 0, 1);
        touchY = e.touches[0].clientY;
      }
    };
    const onTouchEnd = () => { touchY = null; };

    // 进度条点击/拖动
    let trackDragging = false;
    const trackFromEvent = (e) => {
      const rect = trackRef.current.getBoundingClientRect();
      return clamp((e.clientX - rect.left) / rect.width, 0, 1);
    };
    const onTrackDown = (e) => {
      trackDragging = true;
      S.target = trackFromEvent(e);
      e.stopPropagation();
    };

    // 调试工具：1/2/3 单独开关图层，0 全开
    const onKeydown = (e) => {
      const k = e.key;
      if (k === 'Escape') { setActiveCard(null); return; }
      const map = { '1': ['bg'], '2': ['angel'], '3': ['pillar'] };
      if (k === '0') {
        Object.values(map).flat().forEach((n) => { layerRefs.current[n].style.display = 'block'; });
      } else if (map[k]) {
        map[k].forEach((n) => {
          const el = layerRefs.current[n];
          el.style.display = el.style.display === 'none' ? 'block' : 'none';
        });
      }
    };

    // 初始：卡片隐藏
    setCards(0);

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    trackRef.current.addEventListener('mousedown', onTrackDown);
    document.addEventListener('keydown', onKeydown);

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKeydown);
    };
  }, []);

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">AYI · 阿意</div>
        <div className="nav-menu">
          <a href="https://github.com/ayyyyyyi/angel-react" target="_blank" rel="noreferrer">React 版仓库</a>
        </div>
      </nav>

      {/* 三层视差图层 */}
      <img className="layer layer-bg" ref={(el) => (layerRefs.current.bg = el)} src="/layer-bg.png" alt="背景" />
      <img className="layer layer-angel" ref={(el) => (layerRefs.current.angel = el)} src="/layer-angel.png" alt="神像" />
      <img className="layer layer-pillar" ref={(el) => (layerRefs.current.pillar = el)} src="/layer-pillar.png" alt="石柱" />

      <div className="progress-label" ref={labelRef}>远景 · 雪山撑场</div>
      <div className="progress-track" ref={trackRef}>
        <div className="progress-fill" ref={fillRef}></div>
      </div>

      {/* 转场后的视频画面 */}
      <div className={'video-scene' + (videoShown ? ' show' : '')} ref={videoSceneRef}>
        <video ref={videoRef} src="/transition-small.mp4" muted playsInline preload="auto"></video>
      </div>

      {/* 5 张作品卡 */}
      <div className="cards-stage">
        {CARDS.map((c, i) => {
          const idx = i - (CARDS.length - 1) / 2;
          return (
            <div
              key={c.num}
              className={'card' + (idx === 0 ? ' playing' : '')}
              ref={(el) => (cardElsRef.current[i] = el)}
              onClick={() => setActiveCard(c)}
            >
              <div className="card-num">{c.num}</div>
              <h3 className="card-title">{c.title}</h3>
              <p className="card-desc">{c.cardDesc}</p>
              <div className="card-play">▶</div>
            </div>
          );
        })}
      </div>

      {/* 详情浮层：用 activeCard 状态驱动开关 */}
      <div
        className={'card-overlay' + (activeCard ? ' show' : '')}
        onClick={(e) => { if (e.target === e.currentTarget) setActiveCard(null); }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="card-overlay-panel">
          <div className="card-overlay-close" onClick={() => setActiveCard(null)}>✕</div>
          <div className="card-overlay-num">{activeCard ? activeCard.num : ''}</div>
          <div className="card-overlay-title">{activeCard ? activeCard.title : ''}</div>
          <div className="card-overlay-tag">WORK · 查看详情</div>
          <div className="card-overlay-desc">{activeCard ? activeCard.full : ''}</div>
        </div>
      </div>

      {/* 光标粒子群：真正的 React 组件了 */}
      <SwarmCursor
        color="#f9dc82"
        accentColor="#ffffff"
        count={10}
        size={10}
        speed={2.5}
        spread={100}
        wander={0.25}
        trail={0.75}
        scatterOnClick
      />

      <div className="hint">
        滚轮当油门 · 按住鼠标上下拖也行 &nbsp;|&nbsp; 按 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 开关图层 · <kbd>0</kbd> 全开
      </div>
    </>
  );
}
