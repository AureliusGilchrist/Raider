import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/* ─── Space: star field ─────────────────────────────────────────── */
function SpaceLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate stars with position, size, speed, and initial phase
    const STAR_COUNT = 320;
    type Star = { x: number; y: number; r: number; speed: number; phase: number; color: string };
    const COLORS = ['#ffffff', '#ccd6f6', '#aac4ff', '#ffd6d6', '#ffe9b3', '#d6ffe8'];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.3,
      speed: Math.random() * 0.008 + 0.002, // twinkle speed
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    // Shooting stars
    type Shoot = { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number };
    const shoots: Shoot[] = [];
    let lastShoot = 0;

    let t = 0;
    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;

      // Regular stars
      for (const s of stars) {
        const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed * 60));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }

      // Shooting stars
      if (ts - lastShoot > 2800 + Math.random() * 2000) {
        lastShoot = ts;
        shoots.push({
          x: Math.random() * canvas.width * 1.5,
          y: -20,
          vx: -2.5 - Math.random() * 3,
          vy: 2 + Math.random() * 3,
          len: 80 + Math.random() * 80,
          life: 0,
          maxLife: 60,
        });
      }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life++;
        const progress = sh.life / sh.maxLife;
        const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * (sh.len / 3), sh.y - sh.vy * (sh.len / 3));
        grad.addColorStop(0, `rgba(255,255,255,${(alpha * 0.9).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - (sh.vx / Math.hypot(sh.vx, sh.vy)) * sh.len, sh.y - (sh.vy / Math.hypot(sh.vx, sh.vy)) * sh.len);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (sh.life >= sh.maxLife) shoots.splice(i, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Ocean: fish, bubbles, seaweed ────────────────────────────── */
function OceanLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* ---- Bubbles ---- */
    type Bubble = { x: number; y: number; r: number; speed: number; wobble: number; phase: number };
    const bubbles: Bubble[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + Math.random() * window.innerHeight,
      r: 2 + Math.random() * 6,
      speed: 0.3 + Math.random() * 0.7,
      wobble: (Math.random() - 0.5) * 0.8,
      phase: Math.random() * Math.PI * 2,
    }));

    /* ---- Fish ---- */
    type Fish = {
      x: number; y: number;
      vx: number; vy: number;
      size: number;
      color: string;
      tailPhase: number;
      turningTimer: number;
    };
    const FISH_COLORS = [
      '#2dd4bf', '#38bdf8', '#818cf8', '#f472b6',
      '#facc15', '#fb923c', '#a78bfa', '#34d399',
    ];
    const makeFish = (): Fish => {
      const goingRight = Math.random() > 0.5;
      return {
        x: goingRight ? -80 : window.innerWidth + 80,
        y: window.innerHeight * 0.2 + Math.random() * window.innerHeight * 0.65,
        vx: (goingRight ? 1 : -1) * (0.4 + Math.random() * 0.7),
        vy: (Math.random() - 0.5) * 0.15,
        size: 12 + Math.random() * 18,
        color: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
        tailPhase: Math.random() * Math.PI * 2,
        turningTimer: 0,
      };
    };
    const fish: Fish[] = Array.from({ length: 10 }, makeFish);

    /* ---- Jellyfish ---- */
    type Jelly = { x: number; y: number; vy: number; phase: number; size: number; hue: number };
    const jellies: Jelly[] = Array.from({ length: 4 }, () => ({
      x: 60 + Math.random() * (window.innerWidth - 120),
      y: window.innerHeight + Math.random() * 300,
      vy: -(0.15 + Math.random() * 0.25),
      phase: Math.random() * Math.PI * 2,
      size: 18 + Math.random() * 22,
      hue: 160 + Math.random() * 80,
    }));

    /* ---- Seaweed ---- */
    type Weed = { x: number; height: number; segments: number; phase: number; color: string };
    const WEED_COLORS = ['#065f46', '#047857', '#059669', '#0d9488', '#0e7490'];
    const weeds: Weed[] = Array.from({ length: 14 }, () => ({
      x: 20 + Math.random() * (window.innerWidth - 40),
      height: 50 + Math.random() * 100,
      segments: 6 + Math.floor(Math.random() * 5),
      phase: Math.random() * Math.PI * 2,
      color: WEED_COLORS[Math.floor(Math.random() * WEED_COLORS.length)],
    }));

    let t = 0;

    const drawFish = (f: Fish) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1);

      const tailWag = Math.sin(f.tailPhase) * 0.4;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = f.color + 'cc';
      ctx.fill();

      // Tail
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.85, 0);
      ctx.lineTo(-f.size * 1.5, -f.size * 0.55 + tailWag * f.size);
      ctx.lineTo(-f.size * 1.5, f.size * 0.55 + tailWag * f.size);
      ctx.closePath();
      ctx.fillStyle = f.color + 'aa';
      ctx.fill();

      // Eye
      ctx.beginPath();
      ctx.arc(f.size * 0.5, -f.size * 0.08, f.size * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.size * 0.52, -f.size * 0.1, f.size * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();

      // Fin
      ctx.beginPath();
      ctx.moveTo(0, -f.size * 0.35);
      ctx.lineTo(-f.size * 0.3, -f.size * 0.7 + tailWag * 0.5 * f.size);
      ctx.lineTo(f.size * 0.2, -f.size * 0.35);
      ctx.fillStyle = f.color + '88';
      ctx.fill();

      ctx.restore();
    };

    const drawJelly = (j: Jelly) => {
      ctx.save();
      ctx.translate(j.x, j.y);
      const pulse = 0.85 + 0.15 * Math.sin(j.phase);

      // Bell
      const grad = ctx.createRadialGradient(0, -j.size * 0.2, 0, 0, 0, j.size * pulse);
      grad.addColorStop(0, `hsla(${j.hue},80%,80%,0.55)`);
      grad.addColorStop(0.6, `hsla(${j.hue},70%,60%,0.3)`);
      grad.addColorStop(1, `hsla(${j.hue},60%,50%,0.05)`);
      ctx.beginPath();
      ctx.ellipse(0, 0, j.size * pulse, j.size * pulse * 0.7, 0, Math.PI, 0);
      ctx.fillStyle = grad;
      ctx.fill();

      // Tentacles
      for (let i = -3; i <= 3; i++) {
        const tx = (i / 3) * j.size * 0.7 * pulse;
        const wobble = Math.sin(j.phase * 2 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(tx, 4);
        ctx.bezierCurveTo(tx + wobble, j.size * 0.6, tx - wobble * 0.5, j.size * 1.1, tx, j.size * 1.4);
        ctx.strokeStyle = `hsla(${j.hue},70%,70%,0.35)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawWeed = (w: Weed, t: number) => {
      const segH = w.height / w.segments;
      ctx.save();
      ctx.translate(w.x, canvas.height);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      let cx = 0, cy = 0;
      for (let i = 0; i < w.segments; i++) {
        const sway = Math.sin(w.phase + t * 0.8 + i * 0.5) * 6;
        const nx = cx + sway;
        const ny = cy - segH;
        ctx.lineTo(nx, ny);
        cx = nx; cy = ny;
      }
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 3 + (w.segments - 3) * 0.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Leaves
      cx = 0; cy = 0;
      for (let i = 0; i < w.segments; i++) {
        const sway = Math.sin(w.phase + t * 0.8 + i * 0.5) * 6;
        const nx = cx + sway;
        const ny = cy - segH;
        if (i % 2 === 0) {
          const angle = Math.atan2(ny - cy, nx - cx) + Math.PI / 2;
          const lx = nx + Math.cos(angle) * 10;
          const ly = ny + Math.sin(angle) * 10;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 8, 4, angle, 0, Math.PI * 2);
          ctx.fillStyle = w.color + 'aa';
          ctx.fill();
        }
        cx = nx; cy = ny;
      }
      ctx.restore();
    };

    // Ray of light from surface
    const drawCaustics = (t: number) => {
      for (let i = 0; i < 5; i++) {
        const x = (canvas.width * (i + 0.5)) / 5 + Math.sin(t * 0.2 + i) * 30;
        const grad = ctx.createLinearGradient(x, 0, x + 30, canvas.height * 0.6);
        grad.addColorStop(0, 'rgba(100,200,255,0.055)');
        grad.addColorStop(1, 'rgba(100,200,255,0)');
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(Math.sin(t * 0.15 + i * 1.1) * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-20, canvas.height * 0.6);
        ctx.lineTo(20, canvas.height * 0.6);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    };

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Caustic light rays
      drawCaustics(t);

      // Seaweed
      for (const w of weeds) drawWeed(w, t);

      // Bubbles
      for (const b of bubbles) {
        b.y -= b.speed;
        b.x += Math.sin(b.phase + t) * b.wobble;
        if (b.y < -20) {
          b.y = canvas.height + b.r;
          b.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150,220,255,${0.25 + 0.2 * Math.sin(b.phase + t)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,240,255,0.5)';
        ctx.fill();
      }

      // Fish
      for (const f of fish) {
        f.tailPhase += 0.12;
        f.x += f.vx;
        f.y += f.vy;
        f.vy += (Math.random() - 0.5) * 0.015;
        f.vy = Math.max(-0.4, Math.min(0.4, f.vy));
        // Wrap horizontally
        if (f.vx > 0 && f.x > canvas.width + 100) Object.assign(f, makeFish(), { x: -80, vx: Math.abs(makeFish().vx) });
        if (f.vx < 0 && f.x < -100) Object.assign(f, makeFish(), { x: canvas.width + 80, vx: -Math.abs(makeFish().vx) });
        // Keep in vertical bounds
        if (f.y < canvas.height * 0.1 || f.y > canvas.height * 0.9) f.vy *= -1;
        drawFish(f);
      }

      // Jellyfish
      for (const j of jellies) {
        j.phase += 0.025;
        j.y += j.vy;
        j.x += Math.sin(j.phase * 0.5) * 0.3;
        if (j.y < -j.size * 2) {
          j.y = canvas.height + 50;
          j.x = 60 + Math.random() * (canvas.width - 120);
        }
        drawJelly(j);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Main export ───────────────────────────────────────────────── */
export function ThemeLayer() {
  const settings = useSettingsStore(s => s.settings);
  const scheme = settings?.color_scheme ?? '';

  if (scheme === 'space') return <SpaceLayer />;
  if (scheme === 'ocean') return <OceanLayer />;
  return null;
}
