import { useState, useRef, useEffect, useCallback } from "react";

const COLORS = {
  bg: "#0a0e1a",
  surface: "#111827",
  border: "#1e2d45",
  vecA: "#38bdf8",
  vecB: "#f472b6",
  vecC: "#a78bfa",
  vecD: "#34d399",
  accent: "#38bdf8",
  text: "#e2e8f0",
  muted: "#64748b",
  gridLine: "#1a2535",
  axis: "#2d3f55",
};

const W = 480, H = 480, SCALE = 40, OX = W / 2, OY = H / 2;

function toCanvas(x, y) { return [OX + x * SCALE, OY - y * SCALE]; }
function fromCanvas(cx, cy) { return [(cx - OX) / SCALE, (OY - cy) / SCALE]; }

function drawGrid(ctx) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  for (let x = -12; x <= 12; x++) {
    const [cx] = toCanvas(x, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  }
  for (let y = -12; y <= 12; y++) {
    const [, cy] = toCanvas(0, y);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  }
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
  const [ax] = toCanvas(0, 0); ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
  const [, ay] = toCanvas(0, 0); ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();
  ctx.fillStyle = COLORS.muted; ctx.font = "11px monospace"; ctx.textAlign = "center";
  for (let x = -10; x <= 10; x += 2) {
    if (x === 0) continue;
    const [cx, cy] = toCanvas(x, 0);
    ctx.fillText(x, cx, cy + 14);
  }
  ctx.textAlign = "right";
  for (let y = -10; y <= 10; y += 2) {
    if (y === 0) continue;
    const [cx, cy] = toCanvas(0, y);
    ctx.fillText(y, cx - 4, cy + 4);
  }
}

function drawArrow(ctx, x1, y1, x2, y2, color, label, dashed = false) {
  const [cx1, cy1] = toCanvas(x1, y1);
  const [cx2, cy2] = toCanvas(x2, y2);
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  if (dashed) { ctx.setLineDash([6, 4]); } else { ctx.setLineDash([]); }
  ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
  ctx.setLineDash([]);
  const angle = Math.atan2(dy, dx);
  const hw = 10, hl = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 - hl * Math.cos(angle - 0.35), cy2 - hl * Math.sin(angle - 0.35));
  ctx.lineTo(cx2 - hl * Math.cos(angle + 0.35), cy2 - hl * Math.sin(angle + 0.35));
  ctx.closePath(); ctx.fill();
  if (label) {
    ctx.fillStyle = color; ctx.font = "bold 14px monospace"; ctx.textAlign = "left";
    ctx.fillText(label, cx2 + 8, cy2 - 8);
  }
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function norm(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1]); }
function angle(a, b) {
  const d = dot(a, b), na = norm(a), nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, d / (na * nb)))) * 180 / Math.PI;
}
function proj(a, b) {
  const nb2 = dot(b, b);
  if (nb2 === 0) return [0, 0];
  const s = dot(a, b) / nb2;
  return [s * b[0], s * b[1]];
}

function eigenvalues2x2(m) {
  const [a, b, c, d] = m;
  const tr = a + d, det = a * d - b * c;
  const disc = tr * tr - 4 * det;
  if (disc < 0) return null;
  const sd = Math.sqrt(disc);
  return [(tr + sd) / 2, (tr - sd) / 2];
}
function eigenvector2x2(m, lam) {
  const [a, b, c, d] = m;
  if (Math.abs(b) > 1e-9) return [b, lam - a];
  if (Math.abs(c) > 1e-9) return [lam - d, c];
  return [1, 0];
}

function gramSchmidt(vecs) {
  const result = [];
  for (let v of vecs) {
    let u = [...v];
    for (let e of result) {
      const s = dot(u, e) / dot(e, e);
      u = [u[0] - s * e[0], u[1] - s * e[1]];
    }
    const n = norm(u);
    if (n > 1e-9) result.push([u[0] / n, u[1] / n]);
  }
  return result;
}

function NumInput({ label, value, onChange, color }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>{label}</span>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: 70, padding: "6px 8px", background: COLORS.bg, border: `1.5px solid ${color || COLORS.border}`,
          borderRadius: 6, color: color || COLORS.text, fontFamily: "monospace", fontSize: 14, outline: "none"
        }}
      />
    </label>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: color || COLORS.text, fontFamily: "monospace", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// ---- MODULE 1: Basic Vectors ----
function ModuleVetores() {
  const [ax, setAx] = useState(3); const [ay, setAy] = useState(2);
  const [bx, setBx] = useState(-1); const [by, setBy] = useState(3);
  const canvasRef = useRef();
  const A = [ax, ay], B = [bx, by];
  const p = proj(A, B);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawGrid(ctx);
    drawArrow(ctx, 0, 0, p[0], p[1], COLORS.vecC, "", true);
    ctx.strokeStyle = COLORS.vecC + "66"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    const [cx1, cy1] = toCanvas(ax, ay); const [cx2, cy2] = toCanvas(p[0], p[1]);
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke(); ctx.setLineDash([]);
    drawArrow(ctx, 0, 0, ax, ay, COLORS.vecA, "A");
    drawArrow(ctx, 0, 0, bx, by, COLORS.vecB, "B");
    const ang = angle(A, B);
    if (norm(A) > 0.1 && norm(B) > 0.1) {
      const r = 28;
      const a1 = Math.atan2(-ay, ax), a2 = Math.atan2(-by, bx);
      const [ox, oy] = toCanvas(0, 0);
      ctx.strokeStyle = COLORS.vecD + "99"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ox, oy, r, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke();
    }
  }, [ax, ay, bx, by]);

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, maxWidth: "100%" }} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecA, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor A</div>
          <div style={{ display: "flex", gap: 10 }}>
            <NumInput label="x" value={ax} onChange={setAx} color={COLORS.vecA} />
            <NumInput label="y" value={ay} onChange={setAy} color={COLORS.vecA} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecB, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor B</div>
          <div style={{ display: "flex", gap: 10 }}>
            <NumInput label="x" value={bx} onChange={setBx} color={COLORS.vecB} />
            <NumInput label="y" value={by} onChange={setBy} color={COLORS.vecB} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="‖A‖ norma" value={norm(A).toFixed(3)} color={COLORS.vecA} />
          <Stat label="‖B‖ norma" value={norm(B).toFixed(3)} color={COLORS.vecB} />
          <Stat label="A · B produto interno" value={dot(A, B).toFixed(3)} color={COLORS.vecC} />
          <Stat label="∠ ângulo (graus)" value={angle(A, B).toFixed(2) + "°"} color={COLORS.vecD} />
          <Stat label="distância ‖A−B‖" value={norm([ax - bx, ay - by]).toFixed(3)} color={COLORS.muted} />
          <Stat label="proj_B(A)" value={`(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`} color={COLORS.vecC} />
        </div>
      </div>
    </div>
  );
}

// ---- MODULE 2: Combination Linear ----
function ModuleCombinacao() {
  const [ax, setAx] = useState(2); const [ay, setAy] = useState(0);
  const [bx, setBx] = useState(0); const [by, setBy] = useState(2);
  const [alpha, setAlpha] = useState(1.5); const [beta, setBeta] = useState(1);
  const canvasRef = useRef();
  const A = [ax, ay], B = [bx, by];
  const C = [alpha * ax + beta * bx, alpha * ay + beta * by];
  const det = ax * by - ay * bx;
  const indep = Math.abs(det) > 1e-9;

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawGrid(ctx);
    drawArrow(ctx, 0, 0, alpha * ax, alpha * ay, COLORS.vecA + "88", "", true);
    drawArrow(ctx, alpha * ax, alpha * ay, alpha * ax + beta * bx, alpha * ay + beta * by, COLORS.vecB + "88", "", true);
    drawArrow(ctx, 0, 0, ax, ay, COLORS.vecA, "A");
    drawArrow(ctx, 0, 0, bx, by, COLORS.vecB, "B");
    drawArrow(ctx, 0, 0, C[0], C[1], COLORS.vecC, "αA+βB");
    if (!indep) {
      const ctx2 = ctx;
      const nn = norm(A);
      if (nn > 0) {
        ctx2.strokeStyle = COLORS.vecD + "44"; ctx2.lineWidth = 1; ctx2.setLineDash([3, 3]);
        const dir = [ax / nn * 20, ay / nn * 20];
        const [x1, y1] = toCanvas(-dir[0], -dir[1]);
        const [x2, y2] = toCanvas(dir[0], dir[1]);
        ctx2.beginPath(); ctx2.moveTo(x1, y1); ctx2.lineTo(x2, y2); ctx2.stroke(); ctx2.setLineDash([]);
      }
    }
  }, [ax, ay, bx, by, alpha, beta]);

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, maxWidth: "100%" }} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecA, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor A</div>
          <div style={{ display: "flex", gap: 10 }}>
            <NumInput label="x" value={ax} onChange={setAx} color={COLORS.vecA} />
            <NumInput label="y" value={ay} onChange={setAy} color={COLORS.vecA} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecB, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor B</div>
          <div style={{ display: "flex", gap: 10 }}>
            <NumInput label="x" value={bx} onChange={setBx} color={COLORS.vecB} />
            <NumInput label="y" value={by} onChange={setBy} color={COLORS.vecB} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecC, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Escalares</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
                <span>α = {alpha.toFixed(2)}</span>
              </div>
              <input type="range" min="-3" max="3" step="0.1" value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: COLORS.vecA }} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
                <span>β = {beta.toFixed(2)}</span>
              </div>
              <input type="range" min="-3" max="3" step="0.1" value={beta} onChange={e => setBeta(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: COLORS.vecB }} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="αA + βB" value={`(${C[0].toFixed(2)}, ${C[1].toFixed(2)})`} color={COLORS.vecC} />
          <Stat label="det(A,B)" value={det.toFixed(3)} color={indep ? COLORS.vecD : "#f87171"} />
        </div>
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: indep ? "#0f2920" : "#2a0f0f",
          border: `1px solid ${indep ? COLORS.vecD + "66" : "#f8717166"}`,
          fontSize: 13, color: indep ? COLORS.vecD : "#f87171", fontFamily: "monospace"
        }}>
          {indep ? "✓ Linearmente independentes" : "✗ Linearmente dependentes"}
        </div>
      </div>
    </div>
  );
}

// ---- MODULE 3: Transformações Lineares ----
function ModuleTransformacoes() {
  const [m, setM] = useState([1, 0, 0, 1]);
  const [vx, setVx] = useState(2); const [vy, setVy] = useState(1);
  const canvasRef = useRef();

  const apply = (mat, v) => [mat[0] * v[0] + mat[1] * v[1], mat[2] * v[0] + mat[3] * v[1]];
  const V = [vx, vy];
  const TV = apply(m, V);
  const det = m[0] * m[3] - m[1] * m[2];
  const e1 = [1, 0], e2 = [0, 1];
  const Te1 = apply(m, e1), Te2 = apply(m, e2);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawGrid(ctx);
    ctx.strokeStyle = COLORS.vecA + "33"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    const corners = [[0,0],[1,0],[1,1],[0,1]].map(p => apply(m, p));
    const [cx0,cy0] = toCanvas(corners[0][0], corners[0][1]);
    ctx.moveTo(cx0,cy0);
    for (let i=1;i<4;i++) { const [cx,cy] = toCanvas(corners[i][0], corners[i][1]); ctx.lineTo(cx,cy); }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    drawArrow(ctx, 0, 0, Te1[0], Te1[1], COLORS.vecA + "88", "T(e₁)", true);
    drawArrow(ctx, 0, 0, Te2[0], Te2[1], COLORS.vecB + "88", "T(e₂)", true);
    drawArrow(ctx, 0, 0, vx, vy, COLORS.vecB, "v");
    drawArrow(ctx, 0, 0, TV[0], TV[1], COLORS.vecC, "T(v)");
  }, [m, vx, vy]);

  const setMi = (i, val) => { const nm = [...m]; nm[i] = val; setM(nm); };
  const presets = [
    { label: "Identidade", m: [1,0,0,1] },
    { label: "Rot 90°", m: [0,-1,1,0] },
    { label: "Reflexão X", m: [1,0,0,-1] },
    { label: "Escala 2×", m: [2,0,0,2] },
    { label: "Cisalh.", m: [1,1,0,1] },
  ];

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, maxWidth: "100%" }} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace", marginBottom: 8 }}>Matriz 2×2</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["a","b","c","d"]].flat().map((label, i) => (
              <NumInput key={i} label={label} value={m[i]} onChange={v => setMi(i, v)} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => setM(p.m)} style={{
              padding: "5px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              borderRadius: 6, color: COLORS.muted, fontSize: 11, cursor: "pointer", fontFamily: "monospace"
            }}>{p.label}</button>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.vecB, fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor v</div>
          <div style={{ display: "flex", gap: 10 }}>
            <NumInput label="x" value={vx} onChange={setVx} color={COLORS.vecB} />
            <NumInput label="y" value={vy} onChange={setVy} color={COLORS.vecB} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="T(v)" value={`(${TV[0].toFixed(2)}, ${TV[1].toFixed(2)})`} color={COLORS.vecC} />
          <Stat label="det(M)" value={det.toFixed(3)} color={Math.abs(det) > 1e-9 ? COLORS.vecD : "#f87171"} />
          <Stat label="T(e₁)" value={`(${Te1[0].toFixed(2)}, ${Te1[1].toFixed(2)})`} color={COLORS.vecA} />
          <Stat label="T(e₂)" value={`(${Te2[0].toFixed(2)}, ${Te2[1].toFixed(2)})`} color={COLORS.vecB} />
        </div>
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: Math.abs(det) > 1e-9 ? "#0f2920" : "#2a0f0f",
          border: `1px solid ${Math.abs(det) > 1e-9 ? COLORS.vecD + "66" : "#f8717166"}`,
          fontSize: 12, color: Math.abs(det) > 1e-9 ? COLORS.vecD : "#f87171", fontFamily: "monospace"
        }}>
          {Math.abs(det) > 1e-9 ? "✓ Invertível — núcleo trivial {0}" : "✗ Singular — núcleo não-trivial"}
        </div>
      </div>
    </div>
  );
}

// ---- MODULE 4: Operadores e Invariância ----
function ModuleOperadores() {
  const [m, setM] = useState([2, 1, 0, 3]);
  const canvasRef = useRef();

  const eigs = eigenvalues2x2(m);
  const evecs = eigs ? eigs.map(l => {
    const v = eigenvector2x2(m, l);
    const n = norm(v); return n > 1e-9 ? [v[0]/n, v[1]/n] : v;
  }) : [];

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawGrid(ctx);
    if (evecs.length > 0) {
      const eigColors = [COLORS.vecD, COLORS.vecC];
      evecs.forEach((ev, i) => {
        ctx.strokeStyle = eigColors[i] + "33"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        const s = 15;
        const [x1, y1] = toCanvas(-ev[0]*s, -ev[1]*s);
        const [x2, y2] = toCanvas(ev[0]*s, ev[1]*s);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.setLineDash([]);
        drawArrow(ctx, 0, 0, ev[0]*3, ev[1]*3, eigColors[i], `v${i+1}`);
      });
    }
    const apply = (mat, v) => [mat[0]*v[0]+mat[1]*v[1], mat[2]*v[0]+mat[3]*v[1]];
    for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 6) {
      const v = [Math.cos(ang)*2, Math.sin(ang)*2];
      const tv = apply(m, v);
      drawArrow(ctx, v[0], v[1], tv[0], tv[1], COLORS.muted + "55", "", true);
    }
    if (evecs.length > 0) {
      const eigColors = [COLORS.vecD, COLORS.vecC];
      evecs.forEach((ev, i) => {
        const tv = [m[0]*ev[0]+m[1]*ev[1], m[2]*ev[0]+m[3]*ev[1]];
        drawArrow(ctx, 0, 0, tv[0], tv[1], eigColors[i] + "66", "", true);
      });
    }
  }, [m]);

  const setMi = (i, val) => { const nm = [...m]; nm[i] = val; setM(nm); };

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, maxWidth: "100%" }} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace", marginBottom: 8 }}>Operador (Matriz 2×2)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["a","b","c","d"].map((label, i) => (
              <NumInput key={i} label={label} value={m[i]} onChange={v => setMi(i, v)} />
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="tr(M) traço" value={(m[0]+m[3]).toFixed(3)} color={COLORS.text} />
          <Stat label="det(M)" value={(m[0]*m[3]-m[1]*m[2]).toFixed(3)} color={COLORS.text} />
        </div>
        {eigs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace" }}>Autovalores e Autovetores</div>
            {eigs.map((lam, i) => (
              <div key={i} style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${[COLORS.vecD, COLORS.vecC][i]}44` }}>
                <div style={{ fontSize: 12, color: [COLORS.vecD, COLORS.vecC][i], fontFamily: "monospace", fontWeight: 600, marginBottom: 4 }}>
                  λ{i+1} = {lam.toFixed(3)}
                </div>
                {evecs[i] && (
                  <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace" }}>
                    v{i+1} = ({evecs[i][0].toFixed(3)}, {evecs[i][1].toFixed(3)})
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#2a0f0f", border: "1px solid #f8717166", fontSize: 13, color: "#f87171", fontFamily: "monospace" }}>
            Autovalores complexos — sem subespaço invariante real
          </div>
        )}
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace", lineHeight: 1.6 }}>
          As linhas tracejadas são os subespaços invariantes (autoespaços). Vetores nesses subespaços só escalam sob T.
        </div>
      </div>
    </div>
  );
}

// ---- MODULE 5: Produto Interno e Gram-Schmidt ----
function ModuleProdutoInterno() {
  const [vecs, setVecs] = useState([[3, 1], [1, 2]]);
  const canvasRef = useRef();

  const orth = gramSchmidt(vecs);
  const isOrth = vecs.length >= 2 ? Math.abs(dot(vecs[0], vecs[1])) < 1e-9 : false;

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawGrid(ctx);
    const vc = [COLORS.vecA, COLORS.vecB];
    const oc = [COLORS.vecD, COLORS.vecC];
    vecs.forEach((v, i) => drawArrow(ctx, 0, 0, v[0], v[1], vc[i], `v${i+1}`));
    orth.forEach((e, i) => {
      const scale = 3;
      drawArrow(ctx, 0, 0, e[0]*scale, e[1]*scale, oc[i], `e${i+1}`, true);
      ctx.beginPath();
      const [cx,cy] = toCanvas(e[0]*scale, e[1]*scale);
      ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fillStyle = oc[i]; ctx.fill();
    });
    if (orth.length >= 2) {
      const [ox, oy] = toCanvas(0, 0);
      ctx.strokeStyle = COLORS.vecD + "44"; ctx.lineWidth = 1; ctx.setLineDash([]);
      const s = 8;
      const [e1x, e1y] = [orth[0][0]*s, orth[0][1]*s];
      const [e2x, e2y] = [orth[1][0]*s, orth[1][1]*s];
      const [cx1,cy1] = toCanvas(e1x, e1y);
      const [cx2,cy2] = toCanvas(e2x, e2y);
      const [cx3,cy3] = toCanvas(e1x+e2x, e1y+e2y);
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(cx1,cy1); ctx.lineTo(cx3,cy3); ctx.lineTo(cx2,cy2); ctx.closePath();
      ctx.strokeStyle = COLORS.vecD+"22"; ctx.stroke();
    }
  }, [vecs, orth]);

  const setV = (i, j, val) => {
    const nv = vecs.map(v => [...v]);
    nv[i][j] = val;
    setVecs(nv);
  };

  const vcols = [COLORS.vecA, COLORS.vecB];
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, maxWidth: "100%" }} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        {vecs.map((v, i) => (
          <div key={i}>
            <div style={{ fontSize: 12, color: vcols[i], fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>Vetor v{i+1}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <NumInput label="x" value={v[0]} onChange={val => setV(i, 0, val)} color={vcols[i]} />
              <NumInput label="y" value={v[1]} onChange={val => setV(i, 1, val)} color={vcols[i]} />
            </div>
          </div>
        ))}
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: isOrth ? "#0f2920" : "#1a1a0f",
          border: `1px solid ${isOrth ? COLORS.vecD+"66" : COLORS.muted+"44"}`,
          fontSize: 13, color: isOrth ? COLORS.vecD : COLORS.muted, fontFamily: "monospace"
        }}>
          {isOrth ? "✓ Vetores já ortogonais" : `⟨v₁,v₂⟩ = ${dot(vecs[0],vecs[1]).toFixed(3)}`}
        </div>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace", marginBottom: 8 }}>Base Ortonormal (Gram-Schmidt)</div>
          {orth.map((e, i) => (
            <div key={i} style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${[COLORS.vecD, COLORS.vecC][i]}44`, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: [COLORS.vecD, COLORS.vecC][i], fontFamily: "monospace", fontWeight: 600 }}>
                e{i+1} = ({e[0].toFixed(4)}, {e[1].toFixed(4)})
              </span>
              <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace", marginTop: 4 }}>‖e{i+1}‖ = {norm(e).toFixed(4)}</div>
            </div>
          ))}
          {orth.length >= 2 && (
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>
              ⟨e₁,e₂⟩ = {dot(orth[0],orth[1]).toFixed(6)} ≈ 0 ✓
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "vetores", label: "01 Vetores", sub: "norma · ângulo · projeção" },
  { id: "combinacao", label: "02 Combinação Linear", sub: "sliders · dep/indep" },
  { id: "transformacoes", label: "03 Transformações", sub: "matriz · núcleo · imagem" },
  { id: "operadores", label: "04 Operadores", sub: "autovalores · invariância" },
  { id: "produto", label: "05 Produto Interno", sub: "ortogonalidade · Gram-Schmidt" },
];

export default function App() {
  const [active, setActive] = useState("vetores");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ padding: "32px 0 24px" }}>
          <div style={{ fontSize: 11, color: COLORS.vecA, fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: 8, textTransform: "uppercase" }}>
            Visualizador Interativo
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em" }}>
            Álgebra Linear
          </h1>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6, fontFamily: "monospace" }}>
            2D · Vetores · Transformações · Operadores · Produto Interno
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, marginBottom: 24, scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              padding: "10px 16px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              background: active === t.id ? COLORS.vecA + "18" : "transparent",
              border: `1.5px solid ${active === t.id ? COLORS.vecA : COLORS.border}`,
              color: active === t.id ? COLORS.vecA : COLORS.muted,
              fontSize: 12, fontFamily: "monospace", transition: "all 0.15s",
            }}>
              <div style={{ fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{t.sub}</div>
            </button>
          ))}
        </div>

        <div style={{ background: COLORS.surface, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: "24px", marginBottom: 32 }}>
          {active === "vetores" && <ModuleVetores />}
          {active === "combinacao" && <ModuleCombinacao />}
          {active === "transformacoes" && <ModuleTransformacoes />}
          {active === "operadores" && <ModuleOperadores />}
          {active === "produto" && <ModuleProdutoInterno />}
        </div>
      </div>
    </div>
  );
}
