import { useEffect, useRef, useState } from "react";

interface Agent {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // facing direction in radians
  attack: number;
  defense: number;
  speed: number;
  adaptability: number;
  hp: number;
  maxHp: number;
  color: string;
  alive: boolean;
  label: string;
  trail: { x: number; y: number; alpha: number }[];
  hitFlash: number; // frames remaining for hit flash
  deathParticles: Particle[] | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

interface HitSpark {
  x: number;
  y: number;
  particles: Particle[];
}

const COLORS = ["#e040fb","#00e5ff","#69f0ae","#ffeb3b","#ff6e40","#40c4ff","#f48fb1","#b9f6ca"];

interface Props {
  agentGenes: { attack: number; defense: number; speed: number; adaptability: number }[];
  running: boolean;
  onWinner?: (idx: number) => void;
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = angle + (Math.PI / 3) * i;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function spawnSparks(x: number, y: number, color: string, count = 8): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      alpha: 1, size: 1.5 + Math.random() * 2, color };
  });
}

function spawnDeathBurst(x: number, y: number, color: string): Particle[] {
  return Array.from({ length: 24 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      alpha: 1, size: 2 + Math.random() * 4, color };
  });
}

export default function BattleCanvas({ agentGenes, running, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    agents: Agent[];
    sparks: HitSpark[];
    shake: number;
    done: boolean;
  }>({ agents: [], sparks: [], shake: 0, done: false });
  const rafRef = useRef<number>(0);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const W = 600, H = 400;
    setWinner(null);

    stateRef.current = {
      done: false,
      shake: 0,
      sparks: [],
      agents: agentGenes.map((g, i) => ({
        id: i,
        x: 80 + (i % 4) * 130,
        y: 100 + Math.floor(i / 4) * 200,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        angle: Math.random() * Math.PI * 2,
        attack: g.attack,
        defense: g.defense,
        speed: g.speed,
        adaptability: g.adaptability,
        hp: 100 + g.defense * 2,
        maxHp: 100 + g.defense * 2,
        color: COLORS[i % COLORS.length],
        alive: true,
        label: `A${i}`,
        trail: [],
        hitFlash: 0,
        deathParticles: null,
      })),
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Procedural arena obstacles from seed
    const obstacles: { x: number; y: number; w: number; h: number }[] = [];
    let seed = agentGenes.reduce((s, g) => s + g.attack + g.defense, 0);
    const lcg = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < 5; i++) {
      obstacles.push({
        x: 80 + lcg() * 420, y: 60 + lcg() * 280,
        w: 20 + lcg() * 50, h: 10 + lcg() * 30,
      });
    }

    const tick = () => {
      const { agents, sparks } = stateRef.current;
      const alive = agents.filter(a => a.alive);

      // ── Update ──────────────────────────────────────────────────────────────

      for (const a of alive) {
        const spd = 0.6 + a.speed * 0.025;

        // Trail
        a.trail.push({ x: a.x, y: a.y, alpha: 0.6 });
        if (a.trail.length > 12) a.trail.shift();
        a.trail.forEach(t => { t.alpha -= 0.05; });

        // Seek nearest enemy
        let nearest: Agent | null = null;
        let minDist = Infinity;
        for (const b of alive) {
          if (b.id === a.id) continue;
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d < minDist) { minDist = d; nearest = b; }
        }
        if (nearest) {
          const dx = nearest.x - a.x, dy = nearest.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          a.vx = a.vx * 0.85 + (dx / len) * spd * 0.15;
          a.vy = a.vy * 0.85 + (dy / len) * spd * 0.15;
          a.angle = Math.atan2(a.vy, a.vx);
        }

        // Move + wall bounce
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 16) { a.x = 16; a.vx *= -1; }
        if (a.x > W - 16) { a.x = W - 16; a.vx *= -1; }
        if (a.y < 16) { a.y = 16; a.vy *= -1; }
        if (a.y > H - 16) { a.y = H - 16; a.vy *= -1; }

        // Obstacle bounce
        for (const ob of obstacles) {
          if (a.x > ob.x && a.x < ob.x + ob.w && a.y > ob.y && a.y < ob.y + ob.h) {
            a.vx *= -1; a.vy *= -1;
            a.x += a.vx * 2; a.y += a.vy * 2;
          }
        }

        // Combat
        for (const b of alive) {
          if (b.id === a.id) continue;
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d < 28) {
            const dmg = Math.max(0.1, (a.attack - b.defense * 0.3) * 0.06 + a.adaptability * 0.01);
            b.hp -= dmg;
            b.hitFlash = 6;
            // Spawn sparks at midpoint
            if (Math.random() < 0.3) {
              sparks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                particles: spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, a.color) });
            }
            if (b.hp <= 0 && b.alive) {
              b.alive = false;
              b.deathParticles = spawnDeathBurst(b.x, b.y, b.color);
              stateRef.current.shake = 12;
            }
          }
        }

        if (a.hitFlash > 0) a.hitFlash--;
      }

      // Update sparks
      for (const spark of sparks) {
        spark.particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.08; // gravity
          p.alpha -= 0.06;
        });
        spark.particles = spark.particles.filter(p => p.alpha > 0);
      }
      stateRef.current.sparks = sparks.filter(s => s.particles.length > 0);

      // Update death particles
      for (const a of agents) {
        if (a.deathParticles) {
          a.deathParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.05;
            p.alpha -= 0.03;
          });
          a.deathParticles = a.deathParticles.filter(p => p.alpha > 0);
          if (a.deathParticles.length === 0) a.deathParticles = null;
        }
      }

      // Screen shake
      const shakeX = stateRef.current.shake > 0 ? (Math.random() - 0.5) * stateRef.current.shake : 0;
      const shakeY = stateRef.current.shake > 0 ? (Math.random() - 0.5) * stateRef.current.shake : 0;
      if (stateRef.current.shake > 0) stateRef.current.shake--;

      // ── Draw ────────────────────────────────────────────────────────────────

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = "#07071a";
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Grid
      ctx.strokeStyle = "#12123a";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Obstacles
      for (const ob of obstacles) {
        ctx.fillStyle = "#1a1a4a";
        ctx.strokeStyle = "#3a3a8a";
        ctx.lineWidth = 1;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
      }

      // Trails
      for (const a of agents) {
        for (let i = 0; i < a.trail.length; i++) {
          const t = a.trail[i];
          if (t.alpha <= 0) continue;
          ctx.globalAlpha = t.alpha * 0.4;
          ctx.fillStyle = a.color;
          const r = 4 * (i / a.trail.length);
          ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Death particles
      for (const a of agents) {
        if (!a.deathParticles) continue;
        for (const p of a.deathParticles) {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Hit sparks
      for (const spark of stateRef.current.sparks) {
        for (const p of spark.particles) {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Agents
      for (const a of alive) {
        const flash = a.hitFlash > 0;

        // Outer glow
        const grd = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 22);
        grd.addColorStop(0, a.color + (flash ? "cc" : "55"));
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(a.x, a.y, 22, 0, Math.PI * 2); ctx.fill();

        // Hexagon body
        ctx.fillStyle = flash ? "#ffffff" : a.color;
        ctx.strokeStyle = flash ? a.color : a.color + "cc";
        ctx.lineWidth = 2;
        hexPath(ctx, a.x, a.y, 11, a.angle);
        ctx.fill();
        ctx.stroke();

        // Direction indicator (nose)
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + Math.cos(a.angle) * 14, a.y + Math.sin(a.angle) * 14);
        ctx.stroke();

        // HP bar background
        const barW = 32, barH = 4, barX = a.x - barW / 2, barY = a.y - 26;
        ctx.fillStyle = "#111";
        ctx.fillRect(barX, barY, barW, barH);

        // HP bar fill
        const pct = Math.max(0, a.hp / a.maxHp);
        ctx.fillStyle = pct > 0.5 ? "#69f0ae" : pct > 0.25 ? "#ffeb3b" : "#ff5252";
        ctx.fillRect(barX, barY, barW * pct, barH);

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(a.label, a.x, a.y + 26);
      }

      ctx.restore();

      // Winner check
      if (alive.length <= 1 && !stateRef.current.done) {
        stateRef.current.done = true;
        const w = alive[0];
        if (w) {
          setWinner(w.label);
          onWinner?.(w.id);
          // Victory flash
          ctx.fillStyle = w.color + "33";
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = w.color;
          ctx.font = "bold 36px monospace";
          ctx.textAlign = "center";
          ctx.shadowColor = w.color;
          ctx.shadowBlur = 20;
          ctx.fillText(`${w.label} WINS`, W / 2, H / 2);
          ctx.shadowBlur = 0;
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, agentGenes, onWinner]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="rounded-xl border border-purple-900/60 w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {winner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-4xl font-mono font-black text-white drop-shadow-[0_0_20px_#e040fb] animate-pulse">
            {winner} WINS
          </span>
        </div>
      )}
    </div>
  );
}
