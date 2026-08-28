import { useEffect, useRef } from 'react';

/**
 * SwarmCursor —— 光标粒子群（跟随鼠标游动 + 点击散开）
 *
 * 用法（这就是你之前贴的那段 React 写法，现在它真的存在了）：
 *   <SwarmCursor
 *     color="#f9dc82"
 *     accentColor="#ffffff"
 *     count={10}
 *     size={10}
 *     speed={2.5}
 *     spread={100}
 *     wander={0.25}
 *     trail={0.75}
 *     scatterOnClick
 *   />
 *
 * 粒子只「看」鼠标，不拦截任何点击（pointer-events: none），不挡滚轮推进、卡片点击。
 */
export default function SwarmCursor({
  color = '#f9dc82',
  accentColor = '#ffffff',
  count = 10,
  size = 10,
  speed = 2.5,
  spread = 100,
  wander = 0.25,
  trail = 0.75,
  scatterOnClick = true,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let raf = 0;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    const mouse = { x: W / 2, y: H / 2 };
    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    // 粒子：位置在鼠标附近，环绕角度 + 半径随机分配，30% 用强调色
    const ps = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      ps.push({
        x: mouse.x + Math.cos(a) * spread * 0.5,
        y: mouse.y + Math.sin(a) * spread * 0.5,
        vx: 0,
        vy: 0,
        angle: a,
        radius: spread * (0.35 + Math.random() * 0.65),
        accent: Math.random() < 0.3,
      });
    }

    // 点击散开：给每个粒子一个「远离鼠标」的冲量，再由弹簧拉回来
    const onMouseDown = () => {
      for (const p of ps) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = 340 / Math.sqrt(d);
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    };

    let t = 0;
    const frame = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      for (const p of ps) {
        // 目标点 = 鼠标 + 环绕偏移；wander 让环绕角/半径轻微漂移，产生「游动」感
        const wob = Math.sin(t * speed * 0.9 + p.angle * 3) * spread * wander;
        const tx = mouse.x + Math.cos(p.angle + t * 0.4) * (p.radius + wob);
        const ty = mouse.y + Math.sin(p.angle + t * 0.4) * (p.radius + wob);

        // 弹簧式加速度：朝目标点靠，speed 控制跟手快慢
        p.vx += (tx - p.x) * 0.02 * speed;
        p.vy += (ty - p.y) * 0.02 * speed;
        // 拖尾：trail 越大，每帧保留的速度越多 = 拖尾越长
        p.vx *= trail;
        p.vy *= trail;
        p.x += p.vx;
        p.y += p.vy;

        // 画粒子：加柔光，深色背景上会微微发光
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 18;
        ctx.shadowColor = p.accent ? accentColor : color;
        ctx.fillStyle = p.accent ? accentColor : color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };
    frame();

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    if (scatterOnClick) window.addEventListener('mousedown', onMouseDown);

    // cleanup：组件卸载时停掉循环、拆掉监听（React 要求，避免内存泄漏/重复监听）
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      if (scatterOnClick) window.removeEventListener('mousedown', onMouseDown);
    };
  }, [color, accentColor, count, size, speed, spread, wander, trail, scatterOnClick]);

  return <canvas ref={canvasRef} className="swarm-cursor" />;
}
