import React, { useEffect, useRef } from 'react';

// Pháo hoa vẽ bằng canvas cho lúc học viên hoàn thành cả bộ thẻ. Vẽ trực tiếp
// bằng particle thay vì thư viện confetti để không thêm dependency.
//
// Người bật "giảm chuyển động" trong hệ điều hành thì không chạy animation —
// chỉ có phần âm thanh và dòng chúc mừng.

const COLORS = ['#f5c451', '#e2564a', '#4ea8de', '#63c76a', '#c77dff', '#ffffff'];
const BURSTS = 6;
const PARTICLES_PER_BURST = 44;
const GRAVITY = 0.045;
const DRAG = 0.986;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function Fireworks({ durationMs = 2600 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    const particles = [];

    function burst(x, y) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < PARTICLES_PER_BURST; i += 1) {
        const angle = (Math.PI * 2 * i) / PARTICLES_PER_BURST + Math.random() * 0.2;
        const speed = 1.6 + Math.random() * 2.4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          // Vài hạt đổi màu để chùm pháo không phẳng một sắc.
          color: Math.random() < 0.18 ? COLORS[Math.floor(Math.random() * COLORS.length)] : color,
          size: 1.4 + Math.random() * 1.8
        });
      }
    }

    const timers = [];
    for (let i = 0; i < BURSTS; i += 1) {
      timers.push(
        setTimeout(() => {
          burst(width * (0.18 + Math.random() * 0.64), height * (0.16 + Math.random() * 0.4));
        }, i * 280)
      );
    }

    let frame = 0;
    let running = true;

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    const stopTimer = setTimeout(() => {
      running = false;
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
    }, durationMs);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      clearTimeout(stopTimer);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs]);

  return <canvas ref={canvasRef} className="fireworks-canvas" aria-hidden="true" />;
}
