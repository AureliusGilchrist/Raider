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

    // Billowing nebula clouds
    type Nebula = { cx: number; cy: number; rx: number; ry: number; hue: number; sat: number; alpha: number; phase: number };
    const NEBULA_HUES = [270, 195, 315, 240, 290, 210];
    const nebulas: Nebula[] = Array.from({ length: 6 }, (_, i) => ({
      cx: Math.random() * window.innerWidth,
      cy: Math.random() * window.innerHeight,
      rx: 280 + Math.random() * 320,
      ry: 140 + Math.random() * 200,
      hue: NEBULA_HUES[i],
      sat: 60 + Math.random() * 30,
      alpha: 0.030 + Math.random() * 0.048,
      phase: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
    type Shoot = { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number };
    const shoots: Shoot[] = [];
    let lastShoot = 0;

    let t = 0;
    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;

      // Nebulas - billowing clouds drawn behind stars
      for (const n of nebulas) {
        n.phase += 0.0018;
        const nx = n.cx + Math.sin(n.phase * 0.8) * 40;
        const ny = n.cy + Math.cos(n.phase * 0.6) * 25;
        ctx.save();
        ctx.translate(nx, ny);
        ctx.scale(1, n.ry / n.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx);
        grad.addColorStop(0,    `hsla(${n.hue},${n.sat}%,65%,${n.alpha.toFixed(3)})`);
        grad.addColorStop(0.3,  `hsla(${n.hue + 22},${n.sat}%,55%,${(n.alpha * 0.65).toFixed(3)})`);
        grad.addColorStop(0.65, `hsla(${n.hue - 15},${n.sat - 15}%,45%,${(n.alpha * 0.28).toFixed(3)})`);
        grad.addColorStop(1,    `hsla(${n.hue},${n.sat}%,40%,0)`);
        ctx.beginPath();
        ctx.arc(0, 0, n.rx, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

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

/* ─── Ocean ─────────────────────────────────────────────────────── */
function OceanLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    type Bubble = { x: number; y: number; r: number; speed: number; wobbleAmp: number; phase: number };
    type Weed   = { x: number; height: number; segs: number; phase: number; hue: number; thickness: number };
    type Ray    = { x: number; angle: number; phase: number; width: number };

    /* ---- Caustic rays ---- */
    const rays: Ray[] = Array.from({ length: 7 }, (_, i) => ({
      x: (canvas.width / 7) * i + canvas.width / 14,
      angle: -0.15 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      width: 30 + Math.random() * 60,
    }));

    /* ---- Bubbles ---- */
    const bubbles: Bubble[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + Math.random() * window.innerHeight,
      r: 1.5 + Math.random() * 7,
      speed: 0.25 + Math.random() * 0.8,
      wobbleAmp: 0.3 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    }));

    /* ---- Seaweed ---- */
    const weeds: Weed[] = Array.from({ length: 18 }, () => ({
      x: 15 + Math.random() * (window.innerWidth - 30),
      height: 55 + Math.random() * 120,
      segs: 7 + Math.floor(Math.random() * 6),
      phase: Math.random() * Math.PI * 2,
      hue: 150 + Math.random() * 40,
      thickness: 2.5 + Math.random() * 3,
    }));

    let t = 0;

    const drawRays = () => {
      for (const r of rays) {
        const drift = Math.sin(r.phase + t * 0.18) * 40;
        const rx = r.x + drift;
        const grad = ctx.createLinearGradient(rx, 0, rx + r.width * 0.3, canvas.height * 0.55);
        grad.addColorStop(0, 'rgba(120,210,255,0.07)');
        grad.addColorStop(1, 'rgba(120,210,255,0)');
        ctx.save();
        ctx.translate(rx, 0);
        ctx.rotate(r.angle + Math.sin(r.phase + t * 0.1) * 0.06);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r.width / 2, canvas.height * 0.55);
        ctx.lineTo(r.width / 2, canvas.height * 0.55);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    };

    const drawWeed = (w: Weed) => {
      const segH = w.height / w.segs;
      ctx.save();
      ctx.translate(w.x, canvas.height);
      let px = 0, py = 0;
      const pts: [number,number][] = [[0,0]];
      for (let i = 0; i < w.segs; i++) {
        const sway = Math.sin(w.phase + t * 0.7 + i * 0.55) * 8;
        px += sway; py -= segH;
        pts.push([px, py]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = `hsl(${w.hue},70%,28%)`;
      ctx.lineWidth = w.thickness;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      for (let i = 1; i < pts.length - 1; i++) {
        const [bx, by] = pts[i];
        const [nx, ny] = pts[i + 1];
        const perpAngle = Math.atan2(ny - by, nx - bx) + Math.PI / 2;
        const side = i % 2 === 0 ? 1 : -1;
        const fx = bx + Math.cos(perpAngle) * side * 12;
        const fy = by + Math.sin(perpAngle) * side * 12;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(fx, fy, bx + (nx - bx) * 0.5, by + (ny - by) * 0.5);
        ctx.strokeStyle = `hsl(${w.hue},65%,38%)`;
        ctx.lineWidth = w.thickness * 0.55;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawBubble = (b: Bubble) => {
      b.x += Math.sin(b.phase + t * 1.3) * b.wobbleAmp * 0.4;
      if (b.y < -15) { b.y = canvas.height + b.r; b.x = Math.random() * canvas.width; }
      const rimGrad = ctx.createRadialGradient(b.x, b.y, b.r * 0.55, b.x, b.y, b.r);
      rimGrad.addColorStop(0, 'rgba(180,235,255,0)');
      rimGrad.addColorStop(0.7, 'rgba(160,220,255,0.12)');
      rimGrad.addColorStop(1, `rgba(140,210,255,${0.3 + 0.15 * Math.sin(b.phase + t)})`);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = rimGrad; ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230,248,255,0.65)'; ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.r * 0.2, b.y + b.r * 0.2, b.r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,240,255,0.3)'; ctx.fill();
    };

    const draw = () => {
      t += 0.0145;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRays();
      for (const w of weeds) drawWeed(w);
      for (const b of bubbles) {
        b.y -= b.speed;
        drawBubble(b);
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', filter: 'saturate(0.55)' }} />;
}

/* ─── Aurora ─────────────────────────────────────────────────────── */
function AuroraLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Aurora is modeled as multiple overlapping vertical curtains made from
    // sinusoidal columns of color. Each band has its own base hue, speed,
    // wavelength and vertical extent — producing the characteristic rippling
    // curtain of green/cyan/violet light that real auroras show.
    type Band = {
      baseX: number;     // horizontal anchor (0..1 of width)
      width: number;     // spread of this curtain
      hue: number;       // base colour hue
      saturation: number;
      brightness: number;
      alpha: number;     // peak opacity
      speedX: number;    // horizontal drift
      speedWave: number; // wave undulation speed
      waveAmp: number;   // amplitude of vertical waviness
      waveFreq: number;  // frequency of undulation
      topFrac: number;   // curtain starts at this fraction of screen height
      heightFrac: number;// curtain hang-length as fraction of screen height
      phase: number;
    };

    const bands: Band[] = [
      // primary green curtain spanning most of the screen
      { baseX: 0.5,  width: 0.9,  hue: 128, saturation: 90, brightness: 68, alpha: 0.55, speedX: 0.00012, speedWave: 0.38, waveAmp: 0.055, waveFreq: 1.8, topFrac: 0.04, heightFrac: 0.48, phase: 0 },
      // teal / cyan inner band
      { baseX: 0.45, width: 0.55, hue: 175, saturation: 85, brightness: 62, alpha: 0.38, speedX: -0.00018, speedWave: 0.55, waveAmp: 0.04, waveFreq: 2.4, topFrac: 0.06, heightFrac: 0.35, phase: 1.1 },
      // violet lower edge glow
      { baseX: 0.52, width: 0.7,  hue: 270, saturation: 75, brightness: 60, alpha: 0.28, speedX: 0.00022, speedWave: 0.3, waveAmp: 0.065, waveFreq: 1.5, topFrac: 0.22, heightFrac: 0.28, phase: 2.3 },
      // pink/magenta accent
      { baseX: 0.3,  width: 0.4,  hue: 310, saturation: 80, brightness: 65, alpha: 0.2,  speedX: -0.00008, speedWave: 0.45, waveAmp: 0.05, waveFreq: 2.0, topFrac: 0.08, heightFrac: 0.38, phase: 0.6 },
      // wide faint blue backdrop
      { baseX: 0.6,  width: 1.1,  hue: 200, saturation: 70, brightness: 55, alpha: 0.15, speedX: 0.00006, speedWave: 0.22, waveAmp: 0.03, waveFreq: 1.2, topFrac: 0.0,  heightFrac: 0.55, phase: 3.5 },
    ];

    // Stars visible through the aurora
    const STAR_COUNT = 200;
    type Star = { x: number; y: number; r: number; phase: number; speed: number };
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(), y: Math.random() * 0.5,
      r: 0.3 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.003 + Math.random() * 0.009,
    }));

    let t = 0;

    const drawBand = (b: Band) => {
      const W = canvas.width, H = canvas.height;
      const COLS = 80; // vertical slices
      const colW = W / COLS;

      ctx.save();
      for (let col = 0; col < COLS; col++) {
        const xFrac = col / COLS;
        // Gaussian envelope — band fades to 0 at its edges
        const dx = xFrac - b.baseX;
        const envelope = Math.exp(-(dx * dx) / (b.width * b.width * 0.5));

        // Horizontal wave distortion — each column's top shifts sinusoidally
        const xShift = Math.sin(b.phase + xFrac * b.waveFreq * Math.PI * 2 + t * b.speedWave) * b.waveAmp * H;

        const topY  = b.topFrac * H + xShift;
        const curtH = b.heightFrac * H;
        const botY  = topY + curtH;

        // Vertical brightness: bright near top, fade to transparent below.
        // Also a secondary brighter "active stripe" 1/4 from top.
        const grad = ctx.createLinearGradient(0, topY, 0, botY);
        const a = b.alpha * envelope;
        const { hue: h, saturation: s, brightness: br } = b;
        grad.addColorStop(0,   `hsla(${h},${s}%,${br}%,0)`);
        grad.addColorStop(0.08,`hsla(${h},${s}%,${br}%,${(a * 0.45).toFixed(3)})`);
        grad.addColorStop(0.22,`hsla(${h},${s}%,${br + 12}%,${(a * 0.85).toFixed(3)})`);
        grad.addColorStop(0.38,`hsla(${h},${s}%,${br}%,${(a * 0.6).toFixed(3)})`);
        grad.addColorStop(0.65,`hsla(${h},${s}%,${br - 8}%,${(a * 0.3).toFixed(3)})`);
        grad.addColorStop(1,   `hsla(${h},${s}%,${br}%,0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(col * colW, topY, colW + 1, curtH);
      }
      ctx.restore();
    };

    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Stars
      for (const s of stars) {
        const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed * 80));
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,235,255,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // Move bands
      for (const b of bands) {
        b.baseX += b.speedX;
        if (b.baseX > 1.2) b.baseX = -0.2;
        if (b.baseX < -0.2) b.baseX = 1.2;
        b.phase += 0.004;
      }

      // additively blend bands for glow effect
      ctx.globalCompositeOperation = 'screen';
      for (const b of bands) drawBand(b);
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}

/* ─── Lava ────────────────────────────────────────────────────────── */
function LavaLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Cellular lava: a grid of metaball-like blobs that slowly rise, merge
    // and split, drawn via a field-sampling approach.
    // We rasterize at 1/4 resolution then scale up for performance.
    const SCALE = 4;

    type Blob = {
      x: number; y: number;
      vx: number; vy: number;
      r: number;        // influence radius
      hue: number;      // local colour
      life: number;     // 0..1 used for fade in/out
      dLife: number;
    };

    const W = () => Math.ceil(canvas.width  / SCALE);
    const H = () => Math.ceil(canvas.height / SCALE);

    const makeBlob = (spawnAtBottom = false): Blob => ({
      x: Math.random() * W(),
      y: spawnAtBottom ? H() + 5 : Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.04 + Math.random() * 0.18),   // rises slowly
      r: 18 + Math.random() * 28,
      hue: 4 + Math.random() * 28,           // deep red → orange-red
      life: spawnAtBottom ? 0.05 : 0.5 + Math.random() * 0.5,
      dLife: 0.002 + Math.random() * 0.004,
    });

    const NUM_BLOBS = 26;
    const blobs: Blob[] = Array.from({ length: NUM_BLOBS }, () => makeBlob(false));

    // Sparks / embers
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number };
    const sparks: Spark[] = [];

    // Off-screen raster buffer
    let offW = W(), offH = H();
    let imageData = ctx.createImageData(offW, offH);

    const THRESHOLD = 0.65; // isosurface level

    let t = 0;

    const draw = () => {
      t += 0.012;
      const cw = canvas.width, ch = canvas.height;
      const iw = W(), ih = H();

      // Rebuild imageData if canvas resized
      if (iw !== offW || ih !== offH) {
        offW = iw; offH = ih;
        imageData = ctx.createImageData(offW, offH);
      }

      const data = imageData.data;

      // Evaluate metaball field at each low-res pixel
      for (let py = 0; py < ih; py++) {
        for (let px = 0; px < iw; px++) {
          let field = 0;
          let hueAccum = 0, hueWeight = 0;
          for (const b of blobs) {
            const dx = px - b.x, dy = py - b.y;
            const d2 = dx * dx + dy * dy;
            const contrib = (b.r * b.r) / (d2 + 1);
            const w = contrib * b.life;
            field += w;
            hueAccum += b.hue * w;
            hueWeight += w;
          }
          const idx = (py * iw + px) * 4;
          if (field >= THRESHOLD) {
            const intensity = Math.min(1, (field - THRESHOLD) / 0.6);
            const hue = hueWeight > 0 ? hueAccum / hueWeight : 10;
            // Map hue + intensity to RGB: dark red → orange → bright yellow-white at core
            const lightness = 20 + intensity * 65;
            const sat = 95 - intensity * 20;
            // Convert HSL manually (simple approximation)
            const h = hue / 360, s = sat / 100, l = lightness / 100;
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p2 = 2 * l - q;
            const hue2rgb = (t: number) => {
              t = ((t % 1) + 1) % 1;
              if (t < 1/6) return p2 + (q - p2) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p2 + (q - p2) * (2/3 - t) * 6;
              return p2;
            };
            data[idx]   = Math.round(hue2rgb(h + 1/3) * 255);
            data[idx+1] = Math.round(hue2rgb(h)       * 255);
            data[idx+2] = Math.round(hue2rgb(h - 1/3) * 255);
            data[idx+3] = Math.round(180 + intensity * 70);
          } else {
            // Below surface: dark glow proportional to proximity
            const glow = Math.max(0, field / THRESHOLD);
            data[idx]   = Math.round(glow * glow * 80);
            data[idx+1] = 0;
            data[idx+2] = 0;
            data[idx+3] = Math.round(glow * glow * 120);
          }
        }
      }

      ctx.clearRect(0, 0, cw, ch);
      // Draw the low-res buffer scaled up (nearest neighbour gives the molten look)
      const tmp = new OffscreenCanvas(offW, offH);
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.putImageData(imageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, offW, offH, 0, 0, cw, ch);

      // Embers / sparks that pop off the top surface
      if (Math.random() < 0.18) {
        const hotBlob = blobs[Math.floor(Math.random() * blobs.length)];
        sparks.push({
          x: hotBlob.x * SCALE + (Math.random() - 0.5) * hotBlob.r * SCALE,
          y: hotBlob.y * SCALE - hotBlob.r * SCALE * 0.5,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(0.8 + Math.random() * 2.5),
          life: 1,
          r: 1 + Math.random() * 2.5,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.06; sp.life -= 0.025;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r * 2.5);
        sg.addColorStop(0, `rgba(255,220,80,${sp.life.toFixed(2)})`);
        sg.addColorStop(0.5, `rgba(255,80,10,${(sp.life * 0.6).toFixed(2)})`);
        sg.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = sg; ctx.fill();
      }

      // Update blobs
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        b.x += b.vx + Math.sin(t * 0.4 + i) * 0.12;
        b.y += b.vy;
        b.life += b.dLife;
        if (b.y < -b.r * 2 || b.life > 1.05) {
          blobs[i] = makeBlob(true);
        }
        // Wrap horizontal
        if (b.x < -b.r) b.x = iw + b.r;
        if (b.x > iw + b.r) b.x = -b.r;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}

/* ─── Matrix ─────────────────────────────────────────────────────── */
function MatrixLayer() {
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

    // Katakana + digits + latin that appear in the film
    const CHARS = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFZ:<>=|_-';
    const FONT_SIZE = 16;

    type Column = {
      x: number;
      y: number;        // current head Y (pixels)
      speed: number;    // pixels per frame
      length: number;   // number of glyphs in trail
      chars: string[];  // cached glyphs for this column's trail
      scrambleTimer: number;
    };

    const initColumns = (): Column[] => {
      const cols = Math.floor(canvas.width / FONT_SIZE);
      return Array.from({ length: cols }, (_, i) => ({
        x: i * FONT_SIZE,
        y: -(Math.random() * canvas.height * 1.5),
        speed: FONT_SIZE * (0.25 + Math.random() * 0.6),
        length: 8 + Math.floor(Math.random() * 28),
        chars: Array.from({ length: 36 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]),
        scrambleTimer: 0,
      }));
    };

    let columns = initColumns();

    const handleResize = () => {
      resize();
      columns = initColumns();
    };
    window.addEventListener('resize', handleResize);

    let lastTime = 0;
    const FPS_CAP = 30;

    const draw = (ts: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (ts - lastTime < 1000 / FPS_CAP) return;
      lastTime = ts;

      // Semi-transparent black overlay creates the fade trail
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px monospace`;

      for (const col of columns) {
        col.y += col.speed;
        col.scrambleTimer++;
        if (col.scrambleTimer > 3 + Math.floor(Math.random() * 4)) {
          col.scrambleTimer = 0;
          // mutate a random glyph in this column's char array
          const idx = Math.floor(Math.random() * col.chars.length);
          col.chars[idx] = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        for (let j = 0; j < col.length; j++) {
          const charY = col.y - j * FONT_SIZE;
          if (charY < 0 || charY > canvas.height) continue;

          const ch = col.chars[j % col.chars.length];
          if (j === 0) {
            // Head glyph — bright white/light-green
            ctx.fillStyle = 'rgba(220,255,220,0.95)';
          } else {
            // Trail: fade from bright green at head to dark at tail
            const fade = 1 - j / col.length;
            const green = Math.round(180 * fade);
            ctx.fillStyle = `rgba(0,${green + 60},0,${(fade * 0.85).toFixed(2)})`;
          }
          ctx.fillText(ch, col.x, charY);
        }

        // Reset when column has fully scrolled off screen
        if (col.y - col.length * FONT_SIZE > canvas.height) {
          col.y = -(Math.random() * canvas.height * 0.5);
          col.speed = FONT_SIZE * (0.25 + Math.random() * 0.6);
          col.length = 8 + Math.floor(Math.random() * 28);
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}

/* ─── Sakura ─────────────────────────────────────────────────────── */
function SakuraLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    type Petal = {
      x: number; y: number;
      vx: number; vy: number;
      swayAmp: number;   // total side-to-side sway width (px)
      swayFreq: number;  // sway frequency
      phase: number;
      tilt: number;      // 2-D visual tilt (radians)
      flipAngle: number; // 3-D flip around vertical axis
      flipSpeed: number;
      size: number;
      hue: number;
      sat: number;
      alpha: number;
    };

    const PETAL_COUNT = 50;

    const makePetal = (fromTop = false): Petal => ({
      x: Math.random() * window.innerWidth,
      y: fromTop ? -24 - Math.random() * 100 : Math.random() * window.innerHeight,
      vx: -0.12 + Math.random() * 0.24,          // near-zero base horizontal drift
      vy: 0.18 + Math.random() * 0.28,            // very gentle, slow fall
      swayAmp: 3 + Math.random() * 5,             // gentle left/right pendulum
      swayFreq: 0.10 + Math.random() * 0.14,      // very slow sway
      phase: Math.random() * Math.PI * 2,
      tilt: Math.random() * Math.PI * 2,
      flipAngle: Math.random() * Math.PI * 2,
      flipSpeed: 0.004 + Math.random() * 0.008,   // very slow 3-D tumble
      size: 7 + Math.random() * 9,
      hue: 338 + Math.random() * 20,              // pale-to-deep pink
      sat: 55 + Math.random() * 30,
      alpha: 0.62 + Math.random() * 0.32,
    });

    const petals: Petal[] = Array.from({ length: PETAL_COUNT }, () => makePetal(false));

    // Single realistic petal — an almond/teardrop with a faint centre vein
    const drawPetal = (p: Petal) => {
      // cos(flipAngle) simulates the petal spinning around its long axis in 3-D
      const flipCos = Math.cos(p.flipAngle);
      const visualAlpha = p.alpha * (0.25 + 0.75 * Math.abs(flipCos));

      ctx.save();
      ctx.translate(p.x, p.y);
      // tilt follows the sway direction so the leading edge dips naturally
      const swayPhase = Math.sin(p.phase + (rafRef.current > 0 ? 0 : 0)); // just use tilt
      ctx.rotate(p.tilt);
      ctx.scale(flipCos, 1);  // squish horizontally = 3-D flip illusion
      ctx.globalAlpha = visualAlpha;

      const s = p.size;
      const lBase = 84 + (1 - Math.abs(flipCos)) * 8; // slight brightening when edge-on

      const grad = ctx.createLinearGradient(0, -s, 0, s * 0.38);
      grad.addColorStop(0,   `hsla(${p.hue},     ${p.sat}%,     ${lBase}%, 1)`);
      grad.addColorStop(0.45,`hsla(${p.hue - 8}, ${p.sat + 10}%,76%,      1)`);
      grad.addColorStop(1,   `hsla(${p.hue - 14},${p.sat + 6}%, 68%,      0.65)`);

      // Almond shape: pointed tip at top, rounded heel at bottom
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo( s * 0.54, -s * 0.48,  s * 0.50,  s * 0.22,  0,  s * 0.38);
      ctx.bezierCurveTo(-s * 0.50,  s * 0.22, -s * 0.54, -s * 0.48,  0, -s);
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle vein — only visible when petal faces us
      const veinAlpha = 0.20 * Math.abs(flipCos);
      if (veinAlpha > 0.03) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.82);
        ctx.lineTo(0,  s * 0.22);
        ctx.strokeStyle = `hsla(${p.hue - 18},45%,52%,${veinAlpha.toFixed(2)})`;
        ctx.lineWidth = 0.55;
        ctx.stroke();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    };

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of petals) {
        // Pendulum sway: velocity = derivative of A·sin(ωt+φ) = A·ω·cos(ωt+φ)
        const swayVx = p.swayAmp * p.swayFreq * Math.cos(p.phase + t * p.swayFreq);
        p.x += p.vx + swayVx;
        p.y += p.vy;

        // Tilt follows the sway direction — leading edge dips as petal swings
        p.tilt = Math.sin(p.phase + t * p.swayFreq) * 0.28;

        p.flipAngle += p.flipSpeed;

        if (p.y > canvas.height + 40) Object.assign(p, makePetal(true));

        drawPetal(p);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}


/* ─── Deep Sea ───────────────────────────────────────────────────── */
function DeepSeaLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    /* ── types ── */
    type Particle = { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number };
    type Weed  = { x: number; height: number; segs: number; phase: number; hue: number; thickness: number };
    type Ray   = { x: number; angle: number; phase: number; width: number };

    /* ── Bioluminescent drifting particles ── */
    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.8 + Math.random() * 2.8,
      speed: 0.08 + Math.random() * 0.22,
      drift: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    /* ── Sparse deep-sea seaweed / coral stalks ── */
    const weeds: Weed[] = Array.from({ length: 12 }, () => ({
      x: 20 + Math.random() * (window.innerWidth - 40),
      height: 40 + Math.random() * 100,
      segs: 6 + Math.floor(Math.random() * 5),
      phase: Math.random() * Math.PI * 2,
      hue: 175 + Math.random() * 60,   // teal → indigo
      thickness: 1.5 + Math.random() * 2.5,
    }));

    /* ── Very faint downward light rays from far above ── */
    const rays: Ray[] = Array.from({ length: 5 }, (_, i) => ({
      x: (canvas.width / 5) * i + canvas.width / 10,
      angle: -0.08 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
      width: 20 + Math.random() * 45,
    }));

    let t = 0;

    const drawRays = () => {
      for (const r of rays) {
        const drift = Math.sin(r.phase + t * 0.12) * 30;
        const rx = r.x + drift;
        const grad = ctx.createLinearGradient(rx, 0, rx + r.width * 0.2, canvas.height * 0.6);
        grad.addColorStop(0, 'rgba(0,80,160,0.045)');
        grad.addColorStop(1, 'rgba(0,80,160,0)');
        ctx.save();
        ctx.translate(rx, 0);
        ctx.rotate(r.angle + Math.sin(r.phase + t * 0.07) * 0.04);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r.width / 2, canvas.height * 0.6);
        ctx.lineTo( r.width / 2, canvas.height * 0.6);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    };

    const drawWeed = (w: Weed) => {
      const segH = w.height / w.segs;
      ctx.save();
      ctx.translate(w.x, canvas.height);
      let px = 0, py = 0;
      const pts: [number, number][] = [[0, 0]];
      for (let i = 0; i < w.segs; i++) {
        const sway = Math.sin(w.phase + t * 0.5 + i * 0.6) * 6;
        px += sway; py -= segH;
        pts.push([px, py]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = `hsla(${w.hue},55%,22%,0.7)`;
      ctx.lineWidth = w.thickness;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      // side fronds
      for (let i = 1; i < pts.length - 1; i++) {
        const [bx, by] = pts[i];
        const [nx, ny] = pts[i + 1];
        const perp = Math.atan2(ny - by, nx - bx) + Math.PI / 2;
        const side = i % 2 === 0 ? 1 : -1;
        const fx = bx + Math.cos(perp) * side * 10;
        const fy = by + Math.sin(perp) * side * 10;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(fx, fy, bx + (nx - bx) * 0.5, by + (ny - by) * 0.5);
        ctx.strokeStyle = `hsla(${w.hue},50%,30%,0.5)`;
        ctx.lineWidth = w.thickness * 0.5;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawParticle = (p: Particle) => {
      // Bioluminescent plankton — faint cyan/blue glow that pulses
      const glowAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.phase + t * 2.1));
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      pg.addColorStop(0, `rgba(80,200,255,${glowAlpha.toFixed(3)})`);
      pg.addColorStop(0.5, `rgba(40,140,220,${(glowAlpha * 0.4).toFixed(3)})`);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = pg; ctx.fill();
      // bright core
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,240,255,${(glowAlpha * 0.85).toFixed(3)})`;
      ctx.fill();
    };

    const draw = () => {
      t += 0.013;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawRays();
      for (const w of weeds) drawWeed(w);

      // bioluminescent particles
      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift + Math.sin(p.phase + t * 0.9) * 0.12;
        p.phase += 0.018;
        if (p.y < -10) { p.y = canvas.height + p.r; p.x = Math.random() * canvas.width; }
        drawParticle(p);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}

/* ─── Black Hole ─────────────────────────────────────────────────── */
function BlackHoleLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    type Star = { x: number; y: number; r: number; phase: number; twinkle: number; pullSpeed: number; hue: number };

    const spawnStar = (): Star => {
      const angle = Math.random() * Math.PI * 2;
      const maxR = Math.sqrt((window.innerWidth / 2) ** 2 + (window.innerHeight / 2) ** 2);
      const spawnR = maxR * (0.78 + Math.random() * 0.22);
      return {
        x: Math.max(0, Math.min(window.innerWidth,  window.innerWidth  / 2 + Math.cos(angle) * spawnR)),
        y: Math.max(0, Math.min(window.innerHeight, window.innerHeight / 2 + Math.sin(angle) * spawnR)),
        r: 0.3 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.004 + Math.random() * 0.01,
        pullSpeed: 0.00012 + Math.random() * 0.00025,
        hue: Math.random() < 0.6 ? 200 + Math.random() * 50 : 30 + Math.random() * 30,
      };
    };

    const stars: Star[] = Array.from({ length: 420 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.3 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.004 + Math.random() * 0.01,
      pullSpeed: 0.00012 + Math.random() * 0.00025,
      hue: Math.random() < 0.6 ? 200 + Math.random() * 50 : 30 + Math.random() * 30,
    }));

    type Debris = { angle: number; radius: number; r: number; hue: number; alpha: number; speed: number };
    const makeDebris = (): Debris => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.11 + Math.random() * 0.24,
      r: 0.6 + Math.random() * 2.8,
      hue: 18 + Math.random() * 42,
      alpha: 0.55 + Math.random() * 0.45,
      speed: 0.005 + Math.random() * 0.013,
    });
    const debris: Debris[] = Array.from({ length: 180 }, makeDebris);

    // Plasma jet blobs shooting along polar axis
    type Blob = { offset: number; r: number; alpha: number; speed: number; dir: number };
    const makeBlob = (dir: number): Blob => ({
      offset: Math.random() * 0.8,
      r: 3 + Math.random() * 7,
      alpha: 0.25 + Math.random() * 0.45,
      speed: 1.2 + Math.random() * 1.8,
      dir,
    });
    const blobs: Blob[] = [
      ...Array.from({ length: 14 }, () => makeBlob(-1)),
      ...Array.from({ length: 14 }, () => makeBlob(1)),
    ];

    let t = 0;

    const draw = () => {
      t += 0.007;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const baseR = Math.min(W, H) * 0.10;
      const diskInner = baseR * 1.32;
      const diskOuter = baseR * 4.4;
      const tilt = 0.26;

      ctx.clearRect(0, 0, W, H);

      // ── Nebula background ──
      const nA = ctx.createRadialGradient(cx * 0.4, cy * 0.5, 0, cx * 0.4, cy * 0.5, W * 0.6);
      nA.addColorStop(0, 'rgba(45,10,90,0.20)'); nA.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nA; ctx.fillRect(0, 0, W, H);
      const nB = ctx.createRadialGradient(cx * 1.6, cy * 1.4, 0, cx * 1.6, cy * 1.4, W * 0.5);
      nB.addColorStop(0, 'rgba(10,25,70,0.16)'); nB.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nB; ctx.fillRect(0, 0, W, H);
      // Warm disk glow bleeding into background
      const diskGlow = ctx.createRadialGradient(cx, cy + baseR * 0.3, 0, cx, cy + baseR * 0.3, diskOuter * 1.5);
      diskGlow.addColorStop(0, 'rgba(255,110,15,0.12)');
      diskGlow.addColorStop(0.35, 'rgba(180,55,8,0.06)');
      diskGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = diskGlow; ctx.fillRect(0, 0, W, H);

      // ── Stars with trails near the hole ──
      for (const s of stars) {
        const dx = cx - s.x, dy = cy - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        s.x += dx * s.pullSpeed;
        s.y += dy * s.pullSpeed;
        if (dist < baseR * 0.85) Object.assign(s, spawnStar());
        // Gravitational blueshift feel — draw a short streak toward center
        if (dist < diskOuter * 1.8) {
          const trailFrac = Math.max(0, 1 - dist / (diskOuter * 1.8));
          const tLen = trailFrac * 12 * s.r;
          ctx.beginPath();
          ctx.moveTo(s.x + (dx / dist) * tLen, s.y + (dy / dist) * tLen);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = `hsla(${s.hue},75%,88%,${(trailFrac * 0.22).toFixed(3)})`;
          ctx.lineWidth = s.r * 0.7;
          ctx.stroke();
        }
        const alpha = 0.30 + 0.60 * (0.5 + 0.5 * Math.sin(s.phase + t * s.twinkle * 80));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},70%,95%,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // ── Polar jets — cone fill + plasma blobs ──
      const jetCone = (dir: number) => {
        const y0 = cy + dir * baseR * 1.05;
        const y1 = cy + dir * H * 0.52;
        const spread = W * 0.042;
        const g = ctx.createLinearGradient(cx, y0, cx, y1);
        g.addColorStop(0,   'rgba(160,210,255,0.40)');
        g.addColorStop(0.25,'rgba(120,170,255,0.18)');
        g.addColorStop(0.6, 'rgba(80,130,240,0.06)');
        g.addColorStop(1,   'rgba(60,100,220,0)');
        ctx.beginPath();
        ctx.moveTo(cx, y0);
        ctx.lineTo(cx - spread, y1);
        ctx.lineTo(cx + spread, y1);
        ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
      };
      jetCone(-1); jetCone(1);

      for (const b of blobs) {
        b.offset = (b.offset + b.speed * 0.004) % 1;
        const dist2 = b.offset * H * 0.5;
        const by = cy + b.dir * dist2;
        const bx = cx + Math.sin(t * 0.5 + b.r) * baseR * 0.07;
        const progress = b.offset;
        const aFade = b.alpha * (1 - progress * 0.85);
        const sr = b.r * (1 + progress * 1.8);
        const bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, sr * 3.5);
        bg2.addColorStop(0, `rgba(180,220,255,${(aFade * 0.65).toFixed(3)})`);
        bg2.addColorStop(0.45, `rgba(120,160,255,${(aFade * 0.25).toFixed(3)})`);
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(bx, by, sr * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = bg2; ctx.fill();
      }

      // ── Accretion disk back half (top — behind hole, dimmer) ──
      ctx.save();
      for (let r = diskOuter; r >= diskInner; r -= 2) {
        const frac = (r - diskInner) / (diskOuter - diskInner);
        const hue = 26 - frac * 16;
        const sat = 95 - frac * 12;
        const lum = 68 - frac * 26;
        const a = (0.025 + (1 - frac) * 0.11) * 0.52;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * tilt, 0, Math.PI, 0, true);
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lum}%,${a.toFixed(3)})`;
        ctx.lineWidth = 3.5 - frac * 1.8;
        ctx.stroke();
      }
      ctx.restore();

      // ── Gravitational shadow ──
      const shadowR = baseR * 1.28;
      const shadow = ctx.createRadialGradient(cx, cy, baseR * 0.52, cx, cy, shadowR * 1.22);
      shadow.addColorStop(0,    'rgba(0,0,0,1)');
      shadow.addColorStop(0.78, 'rgba(0,0,0,0.97)');
      shadow.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(cx, cy, shadowR * 1.22, 0, Math.PI * 2);
      ctx.fillStyle = shadow; ctx.fill();

      // ── Einstein / photon rings (glowing, with shadow blur) ──
      ctx.save();
      ctx.shadowColor = 'rgba(255,205,70,1)';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.09, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,220,100,0.80)';
      ctx.lineWidth = 2.2; ctx.stroke();
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255,240,150,0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.17, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,230,110,0.36)';
      ctx.lineWidth = 1.4; ctx.stroke();
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(255,180,60,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.26, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,190,70,0.15)';
      ctx.lineWidth = 1.0; ctx.stroke();
      ctx.restore();

      // ── Accretion disk front half (much brighter — relativistic beaming) ──
      ctx.save();
      for (let r = diskOuter; r >= diskInner; r -= 2) {
        const frac = (r - diskInner) / (diskOuter - diskInner);
        const hue = 26 - frac * 16;
        const sat = 98 - frac * 8;
        const lum = 80 - frac * 26;
        const a = 0.16 + (1 - frac) * 0.62;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * tilt, 0, 0, Math.PI);
        ctx.strokeStyle = `hsla(${hue},${sat}%,${lum}%,${a.toFixed(3)})`;
        ctx.lineWidth = 3.5 - frac * 1.8;
        ctx.stroke();
      }
      // Blazing inner edge glow
      ctx.shadowBlur = 28;
      ctx.shadowColor = 'rgba(255,150,20,0.9)';
      for (let r = diskInner; r <= diskInner * 1.5; r += 2) {
        const frac = (r - diskInner) / (diskInner * 0.5);
        const a = 0.75 - frac * 0.52;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * tilt, 0, 0, Math.PI);
        ctx.strokeStyle = `rgba(255,200,70,${a.toFixed(2)})`;
        ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();

      // ── Debris particles spiralling inward ──
      for (const d of debris) {
        const rPx = d.radius * Math.min(W, H) * 0.5;
        d.angle += d.speed * (diskInner / Math.max(rPx, 1));
        d.radius -= 0.00014;
        if (d.radius < 0.055) Object.assign(d, makeDebris());
        const x = cx + Math.cos(d.angle) * rPx;
        const y = cy + Math.sin(d.angle) * rPx * tilt;
        const front = y > cy;
        if (!front && Math.sin(d.angle) < -0.38) continue;
        const a = front ? d.alpha : d.alpha * 0.22;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue},96%,82%,${a.toFixed(2)})`;
        ctx.fill();
      }

      // ── Event horizon — pure black ──
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}

/* ─── Main export ───────────────────────────────────────────────── */
export function ThemeLayer() {
  const settings = useSettingsStore(s => s.settings);
  const scheme = settings?.color_scheme ?? '';

  if (scheme === 'space')      return <SpaceLayer />;
  if (scheme === 'ocean')      return <OceanLayer />;
  if (scheme === 'aurora')     return <AuroraLayer />;

  if (scheme === 'matrix')     return <MatrixLayer />;
  if (scheme === 'sakura')     return <SakuraLayer />;
  if (scheme === 'deep_sea')   return <DeepSeaLayer />;
  if (scheme === 'black_hole') return <BlackHoleLayer />;
  return null;
}
