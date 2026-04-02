import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/* â”€â”€â”€ Space: merged star field + volumetric nebula â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    // Perlin noise for volumetric nebula clouds
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (tt: number) => tt * tt * tt * (tt * (tt * 6 - 15) + 10);
    const nlerp = (a: number, b: number, tt: number) => a + tt * (b - a);
    const grad2 = (hash: number, x: number, y: number) => {
      const h = hash & 3;
      return (h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y);
    };
    const noise2D = (x: number, y: number) => {
      const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
      const ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
      return nlerp(nlerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u), nlerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u), v);
    };
    const fbm = (x: number, y: number, octaves: number) => {
      let val = 0, amp = 0.5, freq = 1;
      for (let i = 0; i < octaves; i++) { val += amp * noise2D(x * freq, y * freq); amp *= 0.5; freq *= 2; }
      return val;
    };

    // Stars with color variety
    const STAR_COUNT = 320;
    type Star = { x: number; y: number; r: number; speed: number; phase: number; color: string };
    const COLORS = ['#ffffff', '#ccd6f6', '#aac4ff', '#ffd6d6', '#ffe9b3', '#d6ffe8'];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.3,
      speed: Math.random() * 0.008 + 0.002,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    // Volumetric nebula regions (from Nebula theme â€” fbm-based clouds)
    type NebulaRegion = { cx: number; cy: number; r: number; hue1: number; hue2: number; drift: number; phase: number };
    const regions: NebulaRegion[] = Array.from({ length: 5 }, (_, i) => ({
      cx: (0.15 + Math.random() * 0.7) * window.innerWidth,
      cy: (0.15 + Math.random() * 0.7) * window.innerHeight,
      r: 0.2 + Math.random() * 0.25,
      hue1: [270, 195, 315, 240, 200][i],
      hue2: [310, 230, 280, 290, 260][i],
      drift: 0.02 + Math.random() * 0.04,
      phase: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
    type Shoot = { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number };
    const shoots: Shoot[] = [];
    let lastShoot = 0;

    // Distant galaxies
    type Galaxy = { cx: number; cy: number; r: number; angle: number; rotSpeed: number; hue: number; alpha: number };
    const galaxies: Galaxy[] = Array.from({ length: 3 }, () => ({
      cx: Math.random() * window.innerWidth,
      cy: Math.random() * window.innerHeight,
      r: 40 + Math.random() * 60,
      angle: Math.random() * Math.PI * 2,
      rotSpeed: 0.0005 + Math.random() * 0.001,
      hue: [220, 280, 330][Math.floor(Math.random() * 3)],
      alpha: 0.06 + Math.random() * 0.05,
    }));

    // Cosmic dust particles
    type Dust = { x: number; y: number; r: number; vx: number; vy: number; alpha: number; hue: number };
    const dustCount = 60;
    const dust: Dust[] = Array.from({ length: dustCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.5 + Math.random() * 1.2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1,
      alpha: 0.15 + Math.random() * 0.25,
      hue: 200 + Math.random() * 60,
    }));

    // Constellation lines between nearby stars
    const constellations: [number, number][] = [];
    for (let i = 0; i < Math.min(stars.length, 80); i++) {
      for (let j = i + 1; j < Math.min(stars.length, 80); j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && constellations.length < 30) {
          constellations.push([i, j]);
        }
      }
    }

    let t = 0;
    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.004;
      const w = canvas.width, h = canvas.height;
      const scale = Math.min(w, h);

      // Volumetric nebula clouds (fbm noise-based, drawn first as background)
      for (const reg of regions) {
        const cx = reg.cx + Math.sin(t * reg.drift + reg.phase) * scale * 0.03;
        const cy = reg.cy + Math.cos(t * reg.drift * 0.7 + reg.phase) * scale * 0.02;
        const cloudR = reg.r * scale;

        for (let layer = 0; layer < 4; layer++) {
          const layerOffset = layer * 0.3;
          const layerScale = 1 - layer * 0.08;
          const layerAlpha = (0.035 - layer * 0.006);
          const noiseScale = 0.003 + layer * 0.001;
          const step = 8;

          for (let py = cy - cloudR; py < cy + cloudR; py += step) {
            for (let px = cx - cloudR; px < cx + cloudR; px += step) {
              const dx = px - cx, dy = py - cy;
              const dist = Math.sqrt(dx * dx + dy * dy) / (cloudR * layerScale);
              if (dist > 1) continue;

              const n = fbm(px * noiseScale + t * 0.5 + layerOffset, py * noiseScale + t * 0.3, 4);
              const density = Math.max(0, (1 - dist * dist) * (0.5 + n * 0.6));
              if (density < 0.01) continue;

              const hueBlend = (n + 1) * 0.5;
              const hue = reg.hue1 + (reg.hue2 - reg.hue1) * hueBlend + t * 3;
              const sat = 60 + density * 30;
              const lum = 35 + density * 25;
              const a = density * layerAlpha;

              ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${a})`;
              ctx.fillRect(px - step / 2, py - step / 2, step, step);
            }
          }
        }

        // Nebula core glow
        const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloudR * 0.4);
        coreGlow.addColorStop(0, `hsla(${reg.hue1 + t * 5}, 80%, 65%, 0.04)`);
        coreGlow.addColorStop(0.5, `hsla(${reg.hue2 + t * 3}, 60%, 50%, 0.015)`);
        coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, cloudR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twinkling stars
      for (const s of stars) {
        const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed * 250));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }

      // Shooting stars
      if (ts - lastShoot > 2800 + Math.random() * 2000) {
        lastShoot = ts;
        shoots.push({
          x: Math.random() * w * 1.5,
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

      // Distant galaxies - spiral shapes
      for (const g of galaxies) {
        g.angle += g.rotSpeed;
        ctx.save();
        ctx.translate(g.cx, g.cy);
        ctx.rotate(g.angle);
        for (let arm = 0; arm < 3; arm++) {
          const armAngle = (arm * Math.PI * 2) / 3;
          ctx.beginPath();
          for (let pp = 0; pp < 40; pp++) {
            const dist = (pp / 40) * g.r;
            const spiral = armAngle + (pp / 40) * Math.PI * 1.5;
            const px = Math.cos(spiral) * dist;
            const py = Math.sin(spiral) * dist;
            if (pp === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = `hsla(${g.hue},60%,70%,${(g.alpha * (0.7 + 0.3 * Math.sin(t * 2))).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        // Galaxy core glow
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, g.r * 0.3);
        coreGrad.addColorStop(0, `hsla(${g.hue},50%,80%,${(g.alpha * 1.5).toFixed(3)})`);
        coreGrad.addColorStop(1, `hsla(${g.hue},50%,60%,0)`);
        ctx.beginPath();
        ctx.arc(0, 0, g.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
        ctx.restore();
      }

      // Cosmic dust
      for (const d of dust) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = w;
        if (d.x > w) d.x = 0;
        if (d.y < 0) d.y = h;
        if (d.y > h) d.y = 0;
        const da = d.alpha * (0.6 + 0.4 * Math.sin(t * 3 + d.x));
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue},40%,75%,${da.toFixed(3)})`;
        ctx.fill();
      }

      // Constellation lines
      const constAlpha = 0.06 + 0.04 * Math.sin(t * 1.5);
      ctx.strokeStyle = `rgba(180,200,255,${constAlpha.toFixed(3)})`;
      ctx.lineWidth = 0.5;
      for (const [i, j] of constellations) {
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
        ctx.stroke();
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

/* â”€â”€â”€ Ocean â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    type Bloom  = { x: number; y: number; rx: number; ry: number; phase: number; alpha: number; hue: number };

    /* ---- Caustic rays ---- */
    const rays: Ray[] = Array.from({ length: 7 }, (_, i) => ({
      x: (canvas.width / 7) * i + canvas.width / 14,
      angle: -0.15 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      width: 90 + Math.random() * 120,
    }));

    const blooms: Bloom[] = Array.from({ length: 6 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * (window.innerHeight * 0.6),
      rx: 140 + Math.random() * 220,
      ry: 70 + Math.random() * 160,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.05 + Math.random() * 0.06,
      hue: 188 + Math.random() * 28,
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
        const drift = Math.sin(r.phase + t * 0.1) * 120;
        const rx = r.x + drift;
        ctx.save();
        ctx.translate(rx, 0);
        const sway = Math.sin(r.phase + t * 0.07) * 0.12;
        ctx.rotate(r.angle + sway);
        ctx.filter = 'blur(22px)';
        // Multi-stop gradient for realistic volumetric feel
        const grad = ctx.createLinearGradient(0, -20, 0, canvas.height * 0.85);
        const pulse = 0.8 + 0.2 * Math.sin(r.phase + t * 0.12);
        grad.addColorStop(0, `rgba(200,245,255,${(0.22 * pulse).toFixed(3)})`);
        grad.addColorStop(0.08, `rgba(180,240,255,${(0.18 * pulse).toFixed(3)})`);
        grad.addColorStop(0.3, `rgba(140,225,255,${(0.12 * pulse).toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(80,195,240,${(0.06 * pulse).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(50,160,220,0)');
        ctx.beginPath();
        // Wider at the bottom, tapered at top for natural light cone
        const topW = r.width * 0.3;
        const botW = r.width * 1.6;
        ctx.moveTo(-topW / 2, -20);
        ctx.lineTo(-botW / 2, canvas.height * 0.85);
        ctx.lineTo(botW / 2, canvas.height * 0.85);
        ctx.lineTo(topW / 2, -20);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    };

    const drawBlooms = () => {
      for (const bloom of blooms) {
        const bx = bloom.x + Math.sin(bloom.phase + t * 0.22) * 45;
        const by = bloom.y + Math.cos(bloom.phase + t * 0.18) * 18;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(1, bloom.ry / bloom.rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bloom.rx);
        grad.addColorStop(0, `hsla(${bloom.hue}, 92%, 78%, ${bloom.alpha.toFixed(3)})`);
        grad.addColorStop(0.45, `hsla(${bloom.hue + 8}, 88%, 68%, ${(bloom.alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1, `hsla(${bloom.hue + 18}, 80%, 60%, 0)`);
        ctx.filter = 'blur(36px)';
        ctx.beginPath();
        ctx.arc(0, 0, bloom.rx, 0, Math.PI * 2);
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
      t += 0.022;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBlooms();
      drawRays();
      ctx.filter = 'blur(1.5px)';
      for (const w of weeds) drawWeed(w);
      ctx.filter = 'none';
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

/* â”€â”€â”€ Aurora â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    // wavelength and vertical extent â€” producing the characteristic rippling
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
        // Gaussian envelope â€” band fades to 0 at its edges
        const dx = xFrac - b.baseX;
        const envelope = Math.exp(-(dx * dx) / (b.width * b.width * 0.5));

        // Horizontal wave distortion â€” each column's top shifts sinusoidally
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

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Lava â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      hue: 4 + Math.random() * 28,           // deep red â†’ orange-red
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
            // Map hue + intensity to RGB: dark red â†’ orange â†’ bright yellow-white at core
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

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Matrix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    const CHARS = 'ï½¦ï½§ï½¨ï½©ï½ªï½«ï½¬ï½­ï½®ï½¯ï½°ï½±ï½²ï½³ï½´ï½µï½¶ï½·ï½¸ï½¹ï½ºï½»ï½¼ï½½ï½¾ï½¿ï¾€ï¾ï¾‚ï¾ƒï¾„ï¾…ï¾†ï¾‡ï¾ˆï¾‰ï¾Šï¾‹ï¾Œï¾ï¾Žï¾ï¾ï¾‘ï¾’ï¾“ï¾”ï¾•ï¾–ï¾—ï¾˜ï¾™ï¾šï¾›ï¾œï¾0123456789ABCDEFZ:<>=|_-';
    const FONT_SIZE = 32;

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
            // Head glyph â€” bright white/light-green
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

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Sakura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    // Single realistic petal â€” an almond/teardrop with a faint centre vein
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

      // Subtle vein â€” only visible when petal faces us
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
        // Pendulum sway: velocity = derivative of AÂ·sin(Ï‰t+Ï†) = AÂ·Ï‰Â·cos(Ï‰t+Ï†)
        const swayVx = p.swayAmp * p.swayFreq * Math.cos(p.phase + t * p.swayFreq);
        p.x += p.vx + swayVx;
        p.y += p.vy;

        // Tilt follows the sway direction â€” leading edge dips as petal swings
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

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}


/* â”€â”€â”€ Deep Sea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    /* â”€â”€ types â”€â”€ */
    type Particle = { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number };
    type Weed  = { x: number; height: number; segs: number; phase: number; hue: number; thickness: number };
    type Ray   = { x: number; angle: number; phase: number; width: number };

    /* â”€â”€ Bioluminescent drifting particles â”€â”€ */
    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.8 + Math.random() * 2.8,
      speed: 0.08 + Math.random() * 0.22,
      drift: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    /* â”€â”€ Sparse deep-sea seaweed / coral stalks â”€â”€ */
    const weeds: Weed[] = Array.from({ length: 12 }, () => ({
      x: 20 + Math.random() * (window.innerWidth - 40),
      height: 40 + Math.random() * 100,
      segs: 6 + Math.floor(Math.random() * 5),
      phase: Math.random() * Math.PI * 2,
      hue: 175 + Math.random() * 60,   // teal â†’ indigo
      thickness: 1.5 + Math.random() * 2.5,
    }));

    /* â”€â”€ Very faint downward light rays from far above â”€â”€ */
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
      // Bioluminescent plankton â€” faint cyan/blue glow that pulses
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

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

function CustomSpecialLayer() {
  const [config, setConfig] = React.useState<{ backgroundUrl?: string; backgroundType?: 'image' | 'video' } | null>(null);

  useEffect(() => {
    const readConfig = () => {
      try {
        const raw = localStorage.getItem('raider_custom_theme');
        setConfig(raw ? JSON.parse(raw) : null);
      } catch {
        setConfig(null);
      }
    };

    readConfig();
    window.addEventListener('storage', readConfig);
    window.addEventListener('raider-custom-theme-updated', readConfig as EventListener);
    return () => {
      window.removeEventListener('storage', readConfig);
      window.removeEventListener('raider-custom-theme-updated', readConfig as EventListener);
    };
  }, []);

  if (!config?.backgroundUrl) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(15,18,36,0.96), rgba(24,33,58,0.92), rgba(12,16,28,0.98))',
        }}
      />
    );
  }

  if (config.backgroundType === 'video') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <video src={config.backgroundUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        <div style={{ position: 'absolute', inset: 0, background: `rgba(8, 10, 20, var(--custom-theme-overlay, 0.26))` }} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(8, 10, 20, var(--custom-theme-overlay, 0.26)), rgba(8, 10, 20, var(--custom-theme-overlay, 0.26))), url(${config.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}

/* â”€â”€â”€ Firefly: dark night with orange fireflies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FireflyLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Dense starfield for beautiful night sky
    const STAR_COUNT = 200;
    type Star = { x: number; y: number; r: number; phase: number; brightness: number };
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.78,
      r: Math.random() * 1.2 + 0.15,
      phase: Math.random() * Math.PI * 2,
      brightness: Math.random() * 0.35 + 0.08,
    }));

    // Fireflies â€” warm orange/amber
    const FLY_COUNT = 60;
    type Fly = { x: number; y: number; vx: number; vy: number; r: number; phase: number; speed: number; hue: number; glowState: number; glowTarget: number; glowDelay: number };
    const flies: Fly[] = Array.from({ length: FLY_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight * (0.45 + Math.random() * 0.55), // mostly below treeline
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 2.8 + 0.8,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.003,
      hue: Math.random() * 30 + 18, // 18-48: warm orange/amber
      glowState: Math.random() * 0.3,
      glowTarget: Math.random() > 0.6 ? 0.8 + Math.random() * 0.2 : 0,
      glowDelay: Math.random() * 4 + 1,
    }));

    // Ground terrain â€” rolling hills baseline
    const HILL_SEGS = 150;
    const hillPoints: number[] = [];
    for (let i = 0; i <= HILL_SEGS; i++) {
      const x = i / HILL_SEGS;
      hillPoints.push(
        0.80 + Math.sin(x * 2.8 + 0.5) * 0.035 + Math.sin(x * 6.5 + 1.2) * 0.02 + Math.sin(x * 14 + 2.8) * 0.01
      );
    }

    // Pine tree silhouettes (varied sizes & positions along hill)
    type Tree = { xFrac: number; height: number; width: number; layers: number };
    const trees: Tree[] = [];
    for (let i = 0; i < 45; i++) {
      trees.push({
        xFrac: Math.random(),
        height: 25 + Math.random() * 55,
        width: 8 + Math.random() * 16,
        layers: 3 + Math.floor(Math.random() * 4),
      });
    }
    trees.sort((a, b) => a.height - b.height); // smaller trees drawn first (further away)

    let t = 0;
    const draw = () => {
      t += 0.016;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Very dark desaturated night sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, 'rgba(2, 3, 8, 0.85)');
      skyGrad.addColorStop(0.3, 'rgba(4, 5, 14, 0.7)');
      skyGrad.addColorStop(0.65, 'rgba(6, 8, 16, 0.45)');
      skyGrad.addColorStop(1, 'rgba(4, 5, 10, 0.2)');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Faint Milky Way band (very subtle diagonal wash)
      ctx.save();
      ctx.translate(w * 0.3, 0);
      ctx.rotate(0.4);
      const milkyWay = ctx.createLinearGradient(0, -h * 0.1, w * 0.25, h * 0.6);
      milkyWay.addColorStop(0, 'rgba(60, 50, 70, 0)');
      milkyWay.addColorStop(0.3, 'rgba(50, 45, 65, 0.025)');
      milkyWay.addColorStop(0.5, 'rgba(60, 55, 75, 0.035)');
      milkyWay.addColorStop(0.7, 'rgba(50, 45, 65, 0.025)');
      milkyWay.addColorStop(1, 'rgba(60, 50, 70, 0)');
      ctx.fillStyle = milkyWay;
      ctx.fillRect(-w * 0.2, -h * 0.1, w * 0.5, h * 1.2);
      ctx.restore();

      // Stars â€” beautiful twinkling night sky
      const groundLine = 0.78;
      for (const s of stars) {
        if (s.y > groundLine) continue;
        const twinkle = s.brightness + Math.sin(t * (1 + s.phase * 0.3) + s.phase) * s.brightness * 0.5;
        const a = Math.max(0, twinkle);
        // Color variation: mostly white/blue, some warm
        const temp = s.phase > 4 ? 220 : s.phase > 2 ? 200 : 180;
        const sat = s.phase > 4 ? 30 : 10;
        ctx.fillStyle = `hsla(${temp}, ${sat}%, 90%, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Faint star glow for brighter stars
        if (s.r > 0.7 && a > 0.15) {
          const sg = ctx.createRadialGradient(s.x * w, s.y * h, 0, s.x * w, s.y * h, s.r * 4);
          sg.addColorStop(0, `hsla(${temp}, ${sat}%, 85%, ${a * 0.2})`);
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ground silhouette (dark rolling hills)
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i <= HILL_SEGS; i++) {
        ctx.lineTo((i / HILL_SEGS) * w, hillPoints[i] * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(2, 4, 6, 0.85)';
      ctx.fill();

      // Pine tree silhouettes (layered triangles for pine shape)
      for (const tree of trees) {
        const tx = tree.xFrac * w;
        const idx = Math.min(HILL_SEGS, Math.floor(tree.xFrac * HILL_SEGS));
        const groundY = hillPoints[idx] * h;
        const treeH = tree.height;
        const baseW = tree.width;

        // Trunk
        ctx.fillStyle = 'rgba(1, 2, 3, 0.9)';
        ctx.fillRect(tx - 1.5, groundY - treeH * 0.2, 3, treeH * 0.25);

        // Pine layers (triangle tiers)
        for (let layer = 0; layer < tree.layers; layer++) {
          const layerFrac = layer / tree.layers;
          const tierBottom = groundY - treeH * 0.15 - layerFrac * treeH * 0.7;
          const tierTop = tierBottom - treeH * (0.35 - layerFrac * 0.08);
          const tierWidth = baseW * (1 - layerFrac * 0.3);
          ctx.fillStyle = `rgba(1, 3, 4, ${0.75 + layerFrac * 0.15})`;
          ctx.beginPath();
          ctx.moveTo(tx - tierWidth * 0.5, tierBottom);
          ctx.lineTo(tx, tierTop);
          ctx.lineTo(tx + tierWidth * 0.5, tierBottom);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Ambient orange glow along ground (firefly collective light)
      const activeGlow = flies.reduce((sum, f) => sum + f.glowState, 0) / flies.length;
      const ambientAlpha = 0.02 + activeGlow * 0.04;
      const ambGrad = ctx.createRadialGradient(w * 0.5, h * 0.82, 0, w * 0.5, h * 0.82, w * 0.6);
      ambGrad.addColorStop(0, `rgba(255, 140, 30, ${ambientAlpha})`);
      ambGrad.addColorStop(0.5, `rgba(255, 100, 20, ${ambientAlpha * 0.4})`);
      ambGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ambGrad;
      ctx.fillRect(0, 0, w, h);

      // Fireflies with dynamic lighting
      for (const f of flies) {
        // Organic wandering
        f.vx += (Math.sin(t * 0.6 + f.phase * 3) * 0.008 - f.vx * 0.004);
        f.vy += (Math.cos(t * 0.4 + f.phase * 2) * 0.008 - f.vy * 0.004);
        f.x += f.vx + Math.sin(t * 0.35 + f.phase) * 0.12;
        f.y += f.vy + Math.cos(t * 0.2 + f.phase) * 0.1;

        // Keep mostly in lower portion but allow some drift
        if (f.x < -40) f.x = w + 40;
        if (f.x > w + 40) f.x = -40;
        if (f.y < h * 0.35) f.y = h * 0.35 + Math.random() * 20;
        if (f.y > h + 20) f.y = h * 0.5;

        // Organic glow pulsing â€” slow fade in/out with random timing
        f.glowDelay -= 0.016;
        if (f.glowDelay <= 0) {
          f.glowTarget = f.glowTarget > 0.4 ? 0 : 0.6 + Math.random() * 0.4;
          f.glowDelay = 2 + Math.random() * 5;
        }
        f.glowState += (f.glowTarget - f.glowState) * 0.025;

        const alpha = f.glowState;
        if (alpha < 0.015) continue;

        // Large dynamic glow (lights up surroundings)
        const dynamicR = f.r * (8 + alpha * 14);
        const dynGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, dynamicR);
        dynGrad.addColorStop(0, `hsla(${f.hue}, 100%, 65%, ${alpha * 0.5})`);
        dynGrad.addColorStop(0.15, `hsla(${f.hue}, 95%, 50%, ${alpha * 0.25})`);
        dynGrad.addColorStop(0.4, `hsla(${f.hue}, 90%, 40%, ${alpha * 0.06})`);
        dynGrad.addColorStop(0.7, `hsla(${f.hue}, 85%, 35%, ${alpha * 0.015})`);
        dynGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = dynGrad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, dynamicR, 0, Math.PI * 2);
        ctx.fill();

        // Inner warm glow
        const innerR = f.r * (3 + alpha * 4);
        const innerGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, innerR);
        innerGrad.addColorStop(0, `hsla(${f.hue + 10}, 100%, 80%, ${alpha * 0.8})`);
        innerGrad.addColorStop(0.4, `hsla(${f.hue}, 100%, 60%, ${alpha * 0.35})`);
        innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, innerR, 0, Math.PI * 2);
        ctx.fill();

        // Bright hot core
        ctx.fillStyle = `hsla(${f.hue + 15}, 100%, 90%, ${alpha * 0.95})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Cyberpunk: CPU trace routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CyberpunkLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Trace routes â€” signals travelling along circuit paths
    type Trace = {
      points: { x: number; y: number }[];
      progress: number;
      speed: number;
      hue: number;
      width: number;
      len: number;
      alpha: number;
      inlaid: boolean; // permanent etched trace
    };

    const buildTrace = (forceInlaid?: boolean): Trace => {
      const w = canvas.width, h = canvas.height;
      const pts: { x: number; y: number }[] = [];
      let x = Math.random() * w;
      let y = Math.random() * h;
      pts.push({ x, y });
      const segments = 8 + Math.floor(Math.random() * 16); // More segments (8-24)
      for (let i = 0; i < segments; i++) {
        const horizontal = Math.random() > 0.5;
        if (horizontal) {
          x += (Math.random() - 0.5) * 400;
          x = Math.max(20, Math.min(w - 20, x));
        } else {
          y += (Math.random() - 0.5) * 400;
          y = Math.max(20, Math.min(h - 20, y));
        }
        pts.push({ x, y });
      }
      const isInlaid = forceInlaid || Math.random() < 0.35;
      return {
        points: pts,
        progress: 0,
        speed: isInlaid ? 0 : (0.001 + Math.random() * 0.004), // Slower = longer life
        hue: Math.random() < 0.6 ? 175 + Math.random() * 10 : Math.random() < 0.8 ? 280 + Math.random() * 20 : 50 + Math.random() * 10,
        width: Math.random() * 1.2 + 0.5,
        len: 0.08 + Math.random() * 0.18, // Longer trace tails
        alpha: isInlaid ? 0.08 + Math.random() * 0.06 : 0.3 + Math.random() * 0.4,
        inlaid: isInlaid,
      };
    };

    // Much more traces: 50 animated + 30 inlaid
    const TRACE_COUNT = 50;
    const INLAID_COUNT = 30;
    const traces: Trace[] = [
      ...Array.from({ length: TRACE_COUNT }, () => buildTrace(false)),
      ...Array.from({ length: INLAID_COUNT }, () => buildTrace(true)),
    ];

    // Static circuit nodes (junction dots)
    type Node = { x: number; y: number; r: number; pulse: number; hue: number };
    const nodes: Node[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1,
      pulse: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.7 ? 180 : 285,
    }));

    // Static trace lines (dim background circuit pattern)
    type StaticLine = { x1: number; y1: number; x2: number; y2: number };
    const statics: StaticLine[] = [];
    for (let i = 0; i < 80; i++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const horizontal = Math.random() > 0.5;
      const len = 30 + Math.random() * 180;
      statics.push({
        x1: n.x,
        y1: n.y,
        x2: horizontal ? n.x + (Math.random() > 0.5 ? len : -len) : n.x,
        y2: horizontal ? n.y : n.y + (Math.random() > 0.5 ? len : -len),
      });
    }

    let t = 0;
    const draw = () => {
      t += 0.016;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Static background circuit lines
      ctx.lineWidth = 0.5;
      for (const sl of statics) {
        ctx.strokeStyle = 'rgba(0, 255, 230, 0.025)';
        ctx.beginPath();
        ctx.moveTo(sl.x1, sl.y1);
        ctx.lineTo(sl.x2, sl.y2);
        ctx.stroke();
      }

      // Circuit junction nodes
      for (const n of nodes) {
        const pulse = 0.15 + Math.sin(t * 1.5 + n.pulse) * 0.1;
        ctx.fillStyle = `hsla(${n.hue}, 100%, 70%, ${pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        // Tiny glow
        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
        ng.addColorStop(0, `hsla(${n.hue}, 100%, 70%, ${pulse * 0.3})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw traces (both animated and inlaid)
      for (const tr of traces) {
        const pts = tr.points;
        // Compute total path length
        let totalLen = 0;
        const segLens: number[] = [];
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i - 1].x;
          const dy = pts[i].y - pts[i - 1].y;
          const sl = Math.sqrt(dx * dx + dy * dy);
          segLens.push(sl);
          totalLen += sl;
        }

        if (tr.inlaid) {
          // INLAID ETCHED TRACES â€” permanent recessed circuit lines
          // Dark inner shadow (recessed groove)
          ctx.strokeStyle = `hsla(${tr.hue}, 60%, 15%, ${0.12 + Math.sin(t * 0.5 + tr.alpha * 40) * 0.03})`;
          ctx.lineWidth = tr.width + 2;
          ctx.beginPath();
          ctx.moveTo(pts[0].x + 0.5, pts[0].y + 0.5);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + 0.5, pts[i].y + 0.5);
          ctx.stroke();

          // Main trace line (dim, etched look)
          ctx.strokeStyle = `hsla(${tr.hue}, 80%, 40%, ${tr.alpha + Math.sin(t * 0.3 + tr.alpha * 30) * 0.02})`;
          ctx.lineWidth = tr.width;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();

          // Top-edge highlight (raised light edge for inlay effect)
          ctx.strokeStyle = `hsla(${tr.hue}, 90%, 65%, ${0.04 + Math.sin(t * 0.4 + tr.alpha * 20) * 0.015})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(pts[0].x - 0.5, pts[0].y - 0.5);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - 0.5, pts[i].y - 0.5);
          ctx.stroke();

          // Junction dots at corners
          for (let i = 1; i < pts.length - 1; i++) {
            ctx.fillStyle = `hsla(${tr.hue}, 80%, 50%, ${0.08 + Math.sin(t * 0.6 + i * 1.5) * 0.03})`;
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          continue;
        }

        // ANIMATED TRACES
        tr.progress += tr.speed;
        if (tr.progress > 1 + tr.len) {
          Object.assign(tr, buildTrace(false));
          continue;
        }

        // Draw the trace path (dim)
        ctx.strokeStyle = `hsla(${tr.hue}, 80%, 60%, 0.035)`;
        ctx.lineWidth = tr.width;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        // Draw the glowing signal head
        const headDist = tr.progress * totalLen;
        const tailDist = Math.max(0, (tr.progress - tr.len) * totalLen);

        // Find position along path at a given distance
        const posAt = (d: number) => {
          let acc = 0;
          for (let i = 0; i < segLens.length; i++) {
            if (acc + segLens[i] >= d) {
              const frac = (d - acc) / segLens[i];
              return {
                x: pts[i].x + (pts[i + 1].x - pts[i].x) * frac,
                y: pts[i].y + (pts[i + 1].y - pts[i].y) * frac,
                seg: i,
              };
            }
            acc += segLens[i];
          }
          return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, seg: segLens.length - 1 };
        };

        // Draw glowing segment
        const steps = 16;
        for (let s = 0; s <= steps; s++) {
          const d = tailDist + (headDist - tailDist) * (s / steps);
          if (d < 0 || d > totalLen) continue;
          const p = posAt(d);
          const frac = s / steps; // 0=tail, 1=head
          const a = tr.alpha * frac;
          const glowR = (tr.width + 2) * (1 + frac * 2);
          const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          sg.addColorStop(0, `hsla(${tr.hue}, 100%, 80%, ${a})`);
          sg.addColorStop(0.5, `hsla(${tr.hue}, 90%, 60%, ${a * 0.3})`);
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bright dot at head
        const head = posAt(Math.min(headDist, totalLen));
        ctx.fillStyle = `hsla(${tr.hue}, 100%, 90%, ${tr.alpha})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, tr.width + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Scanline overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Snowfall: gentle snowflakes with wavy snow ground â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SnowfallLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const COUNT = 150;
    type Flake = { x: number; y: number; r: number; speed: number; drift: number; phase: number; opacity: number };
    const flakes: Flake[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 3 + 0.8,
      speed: Math.random() * 1.0 + 0.3,
      drift: Math.random() * 0.5 - 0.25,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.5 + 0.3,
    }));

    let t = 0;
    const draw = () => {
      t += 0.016;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Snowflakes
      for (const f of flakes) {
        f.y += f.speed;
        f.x += f.drift + Math.sin(t * 0.5 + f.phase) * 0.3;
        // Stop flakes at the snow ground level instead of wrapping
        const groundY = h * 0.88 + Math.sin((f.x / w) * Math.PI * 3) * h * 0.025;
        if (f.y > groundY) {
          f.y = -10;
          f.x = Math.random() * w;
        }
        if (f.x < -10) f.x = w + 10;
        if (f.x > w + 10) f.x = -10;

        const alpha = f.opacity * (0.7 + Math.sin(t * 0.8 + f.phase) * 0.3);
        ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wavy snow ground
      const groundBase = h * 0.88;
      // Back snow drift (slightly higher, dimmer)
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const frac = x / w;
        const y = groundBase - h * 0.02
          + Math.sin(frac * Math.PI * 2.5 + 0.5) * h * 0.02
          + Math.sin(frac * Math.PI * 6 + 1.2) * h * 0.008
          + Math.sin(frac * Math.PI * 13) * h * 0.003;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const backSnow = ctx.createLinearGradient(0, groundBase - h * 0.04, 0, h);
      backSnow.addColorStop(0, 'rgba(180, 200, 220, 0.15)');
      backSnow.addColorStop(0.3, 'rgba(160, 180, 210, 0.12)');
      backSnow.addColorStop(1, 'rgba(140, 160, 190, 0.08)');
      ctx.fillStyle = backSnow;
      ctx.fill();

      // Main snow drift (front)
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) {
        const frac = x / w;
        const y = groundBase
          + Math.sin(frac * Math.PI * 3) * h * 0.025
          + Math.sin(frac * Math.PI * 7 + 0.8) * h * 0.01
          + Math.sin(frac * Math.PI * 16 + t * 0.1) * h * 0.003;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const snowGrad = ctx.createLinearGradient(0, groundBase - h * 0.01, 0, h);
      snowGrad.addColorStop(0, 'rgba(210, 225, 245, 0.28)');
      snowGrad.addColorStop(0.15, 'rgba(200, 215, 240, 0.22)');
      snowGrad.addColorStop(0.5, 'rgba(185, 200, 230, 0.15)');
      snowGrad.addColorStop(1, 'rgba(170, 190, 220, 0.08)');
      ctx.fillStyle = snowGrad;
      ctx.fill();

      // Snow surface highlight
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const frac = x / w;
        const y = groundBase
          + Math.sin(frac * Math.PI * 3) * h * 0.025
          + Math.sin(frac * Math.PI * 7 + 0.8) * h * 0.01
          + Math.sin(frac * Math.PI * 16 + t * 0.1) * h * 0.003;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(230, 240, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Retrowave: synthwave sun + mountain grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RetrowaveLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Generate mountain silhouette (2 layers)
    const genMountain = (segments: number, amplitude: number, baseY: number, seed: number) => {
      const pts: number[] = [];
      for (let i = 0; i <= segments; i++) {
        const x = i / segments;
        pts.push(baseY
          - amplitude * Math.sin(x * Math.PI * 1.3 + seed) * 0.6
          - amplitude * Math.sin(x * Math.PI * 2.7 + seed * 2) * 0.3
          - amplitude * Math.sin(x * Math.PI * 5.1 + seed * 3) * 0.15
          - amplitude * Math.max(0, Math.sin(x * Math.PI * 0.8 + seed * 0.5)) * 0.4
        );
      }
      return pts;
    };

    const MTN_SEGS = 200;
    const backMtn = genMountain(MTN_SEGS, 0.14, 0.55, 1.7);
    const frontMtn = genMountain(MTN_SEGS, 0.10, 0.55, 4.2);

    let t = 0;
    const draw = () => {
      t += 0.035; // Faster animation speed
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const horizon = h * 0.55;

      // Stars above horizon (twinkling)
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 97.3) % (horizon * 0.85));
        const sr = 0.3 + (i % 5) * 0.22;
        const twinkle = 0.08 + Math.sin(t * 1.2 + i * 2.1) * 0.06;
        ctx.fillStyle = `rgba(255, 200, 255, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sun glow
      const sunR = Math.min(w, h) * 0.12;
      const sunX = w * 0.5;
      const sunY = horizon - sunR * 0.15;
      const sunPulse = 1 + Math.sin(t * 0.8) * 0.04;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.5 * sunPulse);
      sunGrad.addColorStop(0, 'rgba(255, 60, 120, 0.35)');
      sunGrad.addColorStop(0.3, 'rgba(255, 100, 50, 0.15)');
      sunGrad.addColorStop(1, 'rgba(255, 60, 120, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);

      // Sun body
      const sunGrad2 = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
      sunGrad2.addColorStop(0, 'rgba(255, 230, 50, 0.65)');
      sunGrad2.addColorStop(0.5, 'rgba(255, 120, 50, 0.55)');
      sunGrad2.addColorStop(1, 'rgba(255, 40, 100, 0.45)');
      ctx.fillStyle = sunGrad2;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();

      // Stripe cutouts on sun
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const ly = sunY + sunR * 0.15 + i * sunR * 0.13;
        const lh = 1.5 + i * 0.7;
        ctx.fillStyle = `rgba(0,0,0,${0.5 + i * 0.07})`;
        ctx.fillRect(sunX - sunR, ly, sunR * 2, lh);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Back mountain silhouette (darker, taller)
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i <= MTN_SEGS; i++) {
        ctx.lineTo((i / MTN_SEGS) * w, backMtn[i] * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30, 10, 50, 0.5)';
      ctx.fill();

      // Front mountain silhouette (purple tint)
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i <= MTN_SEGS; i++) {
        ctx.lineTo((i / MTN_SEGS) * w, frontMtn[i] * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(50, 15, 70, 0.6)';
      ctx.fill();

      // Mountain grid lines (wireframe on front mountain)
      ctx.strokeStyle = 'rgba(180, 50, 255, 0.1)';
      ctx.lineWidth = 0.7;
      // Vertical grid on mountain
      for (let i = 0; i <= 30; i++) {
        const frac = i / 30;
        const x = frac * w;
        const idx = Math.floor(frac * MTN_SEGS);
        const mtnY = frontMtn[Math.min(idx, MTN_SEGS)] * h;
        if (mtnY < horizon) {
          ctx.beginPath();
          ctx.moveTo(x, mtnY);
          ctx.lineTo(x, horizon);
          ctx.stroke();
        }
      }
      // Horizontal contour lines on mountain
      for (let y = horizon - 10; y > horizon - h * 0.15; y -= 12) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= MTN_SEGS; i++) {
          const x = (i / MTN_SEGS) * w;
          const mtnY = frontMtn[i] * h;
          if (mtnY < y) {
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          }
        }
        if (started) ctx.stroke();
      }

      // Floor below horizon â€” perspective grid flowing away from viewer
      // Vertical perspective lines converging to vanishing point
      ctx.strokeStyle = 'rgba(180, 50, 255, 0.12)';
      ctx.lineWidth = 1;
      const vanishX = w * 0.5;
      const gridLines = 20;
      for (let i = 0; i <= gridLines; i++) {
        const frac = i / gridLines;
        const bottomX = frac * w;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bottomX, h);
        ctx.stroke();
      }

      // Horizontal grid lines â€” seamless infinite loop
      const hLines = 28;
      const floorH = h - horizon;
      const scrollSpeed = 55; // Much faster scroll
      const loopPeriod = 1.0; // Normalized loop cycle
      const phase = ((t * scrollSpeed / floorH) % loopPeriod);
      for (let i = 0; i < hLines; i++) {
        const baseFrac = i / hLines;
        const shifted = (baseFrac + phase) % 1.0;
        // Perspective compression: squared mapping
        const perspY = horizon + shifted * shifted * floorH;
        if (perspY < horizon || perspY > h) continue;
        // Fade lines near edges for seamless feel
        const fadeNear = Math.min(1, (perspY - horizon) / 20);
        const fadeFar = Math.min(1, (h - perspY) / 20);
        ctx.globalAlpha = fadeNear * fadeFar;
        ctx.beginPath();
        ctx.moveTo(0, perspY);
        ctx.lineTo(w, perspY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Horizon glow line (pulsing)
      const horizPulse = 0.12 + Math.sin(t * 1.5) * 0.03;
      const horizGrad = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 8);
      horizGrad.addColorStop(0, 'rgba(255, 80, 200, 0)');
      horizGrad.addColorStop(0.3, `rgba(255, 80, 200, ${horizPulse})`);
      horizGrad.addColorStop(1, 'rgba(255, 80, 200, 0)');
      ctx.fillStyle = horizGrad;
      ctx.fillRect(0, horizon - 2, w, 10);

      // Scanline overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1.5);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Thunderstorm: lightning and rain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ThunderstormLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    type Drop = { x: number; y: number; len: number; speed: number; alpha: number };
    const drops: Drop[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      len: 8 + Math.random() * 20,
      speed: 6 + Math.random() * 8,
      alpha: 0.08 + Math.random() * 0.15,
    }));

    type BoltData = { points: { x: number; y: number }[]; life: number; maxLife: number; branches: { x: number; y: number }[][] };
    let bolt: BoltData | null = null;
    let flashAlpha = 0;
    let nextBolt = 2 + Math.random() * 4;

    const generateBolt = (sx: number, sy: number, ey: number): BoltData => {
      const segs = 12 + Math.floor(Math.random() * 10);
      const pts: { x: number; y: number }[] = [{ x: sx, y: sy }];
      const dy = (ey - sy) / segs;
      let x = sx;
      for (let i = 1; i <= segs; i++) {
        x += (Math.random() - 0.5) * 80;
        pts.push({ x, y: sy + dy * i });
      }
      const branches: { x: number; y: number }[][] = [];
      for (let b = 0; b < 3; b++) {
        const bi = 2 + Math.floor(Math.random() * (segs - 3));
        const bp = pts[bi];
        const bLen = 3 + Math.floor(Math.random() * 5);
        const bPts = [{ x: bp.x, y: bp.y }];
        let bx = bp.x;
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (let j = 1; j <= bLen; j++) {
          bx += dir * (10 + Math.random() * 25);
          bPts.push({ x: bx, y: bp.y + j * (dy * 0.8) });
        }
        branches.push(bPts);
      }
      return { points: pts, life: 0, maxLife: 12, branches };
    };

    const clouds = Array.from({ length: 8 }, () => ({
      x: Math.random(), y: Math.random() * 0.18,
      rx: 0.1 + Math.random() * 0.15,
      ry: 0.025 + Math.random() * 0.035,
      speed: 0.0003 + Math.random() * 0.0005,
      alpha: 0.15 + Math.random() * 0.2,
    }));

    let t = 0;
    const draw = () => {
      t += 0.016;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, 'rgba(5, 5, 15, 0.92)');
      sky.addColorStop(0.3, 'rgba(10, 12, 25, 0.8)');
      sky.addColorStop(0.7, 'rgba(15, 18, 30, 0.6)');
      sky.addColorStop(1, 'rgba(12, 15, 25, 0.35)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Flash overlay
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(180, 190, 220, ${flashAlpha * 0.12})`;
        ctx.fillRect(0, 0, w, h);
        flashAlpha *= 0.85;
      }

      // Clouds
      for (const c of clouds) {
        c.x = (c.x + c.speed) % 1.2;
        const cx = (c.x - 0.1) * w, cy = c.y * h;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.rx * w);
        const ca = c.alpha + flashAlpha * 0.15;
        grad.addColorStop(0, `rgba(40, 45, 60, ${ca})`);
        grad.addColorStop(0.6, `rgba(25, 28, 40, ${ca * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.scale(1, c.ry / c.rx);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy * (c.rx / c.ry), c.rx * w, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Rain
      const windAngle = Math.sin(t * 0.3) * 0.15;
      ctx.strokeStyle = 'rgba(150, 170, 200, 0.12)';
      ctx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.speed;
        d.x += windAngle * d.speed;
        if (d.y > h) { d.y = -d.len; d.x = Math.random() * w; }
        if (d.x > w) d.x -= w;
        if (d.x < 0) d.x += w;
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windAngle * d.len, d.y + d.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Lightning
      nextBolt -= 0.016;
      if (nextBolt <= 0 && !bolt) {
        bolt = generateBolt(w * (0.2 + Math.random() * 0.6), 0, h * (0.5 + Math.random() * 0.3));
        flashAlpha = 1;
        nextBolt = 3 + Math.random() * 6;
      }
      if (bolt) {
        bolt.life++;
        const ba = Math.max(0, 1 - bolt.life / bolt.maxLife);
        ctx.strokeStyle = `rgba(200, 210, 255, ${ba * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = `rgba(150, 180, 255, ${ba})`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        for (let i = 0; i < bolt.points.length; i++) {
          if (i === 0) ctx.moveTo(bolt.points[i].x, bolt.points[i].y);
          else ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
        }
        ctx.stroke();
        ctx.lineWidth = 1.2;
        for (const br of bolt.branches) {
          ctx.beginPath();
          for (let i = 0; i < br.length; i++) {
            if (i === 0) ctx.moveTo(br[i].x, br[i].y);
            else ctx.lineTo(br[i].x, br[i].y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        if (bolt.life >= bolt.maxLife) bolt = null;
      }

      // Horizon storm glow
      const hg = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, w * 0.5);
      hg.addColorStop(0, `rgba(80, 100, 140, ${0.04 + flashAlpha * 0.06})`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Enchanted: magical forest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function EnchantedLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    type Orb = { x: number; y: number; vx: number; vy: number; r: number; hue: number; phase: number; brightness: number };
    const orbs: Orb[] = Array.from({ length: 35 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.75,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2 - 0.1,
      r: 2 + Math.random() * 4,
      hue: [180, 260, 300, 120, 40][Math.floor(Math.random() * 5)],
      phase: Math.random() * Math.PI * 2,
      brightness: 0.3 + Math.random() * 0.5,
    }));

    type Sparkle = { x: number; y: number; life: number; maxLife: number; r: number; hue: number };
    const sparkles: Sparkle[] = [];

    const mushrooms = Array.from({ length: 12 }, () => ({
      x: Math.random(),
      h: 8 + Math.random() * 16,
      w: 6 + Math.random() * 10,
      hue: [120, 180, 280, 320][Math.floor(Math.random() * 4)],
      phase: Math.random() * Math.PI * 2,
    }));

    const mistLayers = Array.from({ length: 5 }, () => ({
      y: 0.6 + Math.random() * 0.25,
      speed: 0.0002 + Math.random() * 0.0004,
      offset: Math.random(),
      alpha: 0.02 + Math.random() * 0.03,
    }));

    let t = 0;
    const draw = () => {
      t += 0.012;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, 'rgba(4, 2, 18, 0.92)');
      sky.addColorStop(0.3, 'rgba(8, 5, 30, 0.75)');
      sky.addColorStop(0.6, 'rgba(5, 15, 20, 0.55)');
      sky.addColorStop(1, 'rgba(3, 10, 8, 0.3)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Mist
      for (const m of mistLayers) {
        m.offset = (m.offset + m.speed) % 2;
        for (let i = 0; i < 3; i++) {
          const mx = ((m.offset + i * 0.7) % 2 - 0.3) * w;
          const my = m.y * h;
          const mg = ctx.createRadialGradient(mx, my, 0, mx, my, w * 0.3);
          mg.addColorStop(0, `rgba(100, 140, 120, ${m.alpha})`);
          mg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(mx, my, w * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Orbs
      for (const o of orbs) {
        o.x += o.vx + Math.sin(t * 0.5 + o.phase) * 0.2;
        o.y += o.vy + Math.cos(t * 0.3 + o.phase) * 0.15;
        if (o.x < -30) o.x = w + 30;
        if (o.x > w + 30) o.x = -30;
        if (o.y < -30) o.y = h * 0.7;
        if (o.y > h * 0.85) o.y = -30;
        const pulse = o.brightness + Math.sin(t * 1.5 + o.phase) * 0.15;
        const gr = o.r * (5 + pulse * 6);
        const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, gr);
        og.addColorStop(0, `hsla(${o.hue}, 80%, 65%, ${pulse * 0.4})`);
        og.addColorStop(0.3, `hsla(${o.hue}, 70%, 50%, ${pulse * 0.15})`);
        og.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(o.x, o.y, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${o.hue}, 90%, 85%, ${pulse * 0.7})`;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.08) {
          sparkles.push({
            x: o.x + (Math.random() - 0.5) * 6,
            y: o.y + (Math.random() - 0.5) * 6,
            life: 0, maxLife: 30 + Math.random() * 30,
            r: 0.3 + Math.random() * 0.8, hue: o.hue,
          });
        }
      }

      // Sparkles
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.life++;
        const prog = sp.life / sp.maxLife;
        if (prog >= 1) { sparkles.splice(i, 1); continue; }
        const a = (1 - prog) * 0.6;
        ctx.fillStyle = `hsla(${sp.hue}, 100%, 85%, ${a})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * (1 - prog * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      if (sparkles.length > 150) sparkles.splice(0, 30);

      // Ground
      ctx.fillStyle = 'rgba(2, 5, 3, 0.7)';
      ctx.fillRect(0, h * 0.88, w, h * 0.12);

      // Glowing mushrooms
      for (const m of mushrooms) {
        const mx = m.x * w, my = h * 0.88;
        const glow = 0.3 + Math.sin(t * 0.8 + m.phase) * 0.15;
        ctx.fillStyle = 'rgba(30, 40, 35, 0.7)';
        ctx.fillRect(mx - 1.5, my - m.h * 0.5, 3, m.h * 0.5);
        ctx.beginPath();
        ctx.ellipse(mx, my - m.h * 0.5, m.w * 0.5, m.h * 0.4, 0, Math.PI, 0);
        ctx.fillStyle = `hsla(${m.hue}, 60%, 30%, 0.6)`;
        ctx.fill();
        const mg = ctx.createRadialGradient(mx, my - m.h * 0.5, 0, mx, my - m.h * 0.5, m.w * 2);
        mg.addColorStop(0, `hsla(${m.hue}, 90%, 60%, ${glow * 0.2})`);
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my - m.h * 0.5, m.w * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* â”€â”€â”€ Main export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export function ThemeLayer() {
  const settings = useSettingsStore(s => s.settings);
  const scheme = settings?.color_scheme ?? '';

  if (scheme === 'space')      return <SpaceLayer />;
  if (scheme === 'ocean')      return <OceanLayer />;
  if (scheme === 'aurora')     return <AuroraLayer />;

  if (scheme === 'matrix')     return <MatrixLayer />;
  if (scheme === 'sakura')     return <SakuraLayer />;
  if (scheme === 'deep_sea')   return <DeepSeaLayer />;
  if (scheme === 'firefly')    return <FireflyLayer />;
  if (scheme === 'cyberpunk')  return <CyberpunkLayer />;
  if (scheme === 'snowfall')      return <SnowfallLayer />;
  if (scheme === 'retrowave')     return <RetrowaveLayer />;
  if (scheme === 'thunderstorm')  return <ThunderstormLayer />;
  if (scheme === 'enchanted')     return <EnchantedLayer />;
  if (scheme === 'custom_special') return <CustomSpecialLayer />;
  return null;
}
