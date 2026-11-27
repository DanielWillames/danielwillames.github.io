// Willames Store: a camada visual própria do site. Formas 3D flutuantes (SVG), partículas ligadas
// por linhas (canvas 2D), painel de vidro que inclina com o mouse, luz que segue o mouse nas seções
// e nos cartões, título com palavra que troca e faixa de serviços. Sem bibliotecas.
// Menos movimento pedido: tudo parado numa imagem final. Fora da tela ou aba oculta: nada roda.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const NS = 'http://www.w3.org/2000/svg';
const state = { paused: false, listeners: new Set() };
const onPause = fn => state.listeners.add(fn);

/* ---------- luz que segue o mouse ---------- */
function glow() {
  if (!fine) return;
  // uma luz só para a página inteira: segue o mouse sem ser cortada na troca de seção
  const page = document.createElement('div');
  page.className = 'ws-glow-page'; page.setAttribute('aria-hidden', 'true');
  document.body.append(page);
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;
  const step = () => {
    x += (tx - x) * (reduced ? 1 : 0.18); y += (ty - y) * (reduced ? 1 : 0.18);
    page.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) ? requestAnimationFrame(step) : 0;
  };
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY; page.classList.add('is-on');
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => page.classList.remove('is-on'));
  // os cartões continuam com o brilho interno deles
  const hosts = document.querySelectorAll('article.card');
  hosts.forEach(el => {
    el.classList.add('ws-glow-host');
    const g = document.createElement('span');
    g.className = 'ws-glow'; g.setAttribute('aria-hidden', 'true');
    el.prepend(g);
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--x', `${e.clientX - r.left}px`);
      el.style.setProperty('--y', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

/* ---------- formas orgânicas ---------- */
const GRADS = {
  blue:   [['0', '#d6e9ff'], ['.32', '#5aa2ff'], ['.7', '#2f6fe0'], ['1', '#142c7a']],
  cyan:   [['0', '#ecfeff'], ['.3', '#86f1f4'], ['.66', '#2fb5d6'], ['1', '#1b4a98']],
  indigo: [['0', '#e3e6ff'], ['.34', '#8f9bff'], ['.7', '#5060e2'], ['1', '#202672']],
};
function defs(svg, uid) {
  const d = document.createElementNS(NS, 'defs');
  for (const [k, stops] of Object.entries(GRADS)) {
    const g = document.createElementNS(NS, 'radialGradient');
    g.id = `${uid}-${k}`; g.setAttribute('cx', '.42'); g.setAttribute('cy', '.38'); g.setAttribute('r', '.72');
    g.setAttribute('fx', '.3'); g.setAttribute('fy', '.24');
    for (const [o, c] of stops) { const s = document.createElementNS(NS, 'stop'); s.setAttribute('offset', o); s.setAttribute('stop-color', c); g.append(s); }
    d.append(g);
  }
  const f = document.createElementNS(NS, 'filter');
  f.id = `${uid}-sh`; f.setAttribute('x', '-40%'); f.setAttribute('y', '-40%'); f.setAttribute('width', '180%'); f.setAttribute('height', '190%');
  f.innerHTML = '<feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#020818" flood-opacity=".55"/>';
  d.append(f);
  svg.append(d);
}
function blobPath(cx, cy, r, t, seed, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.16 * Math.sin(t * 0.9 + i * 1.7 + seed) + 0.09 * Math.sin(t * 1.45 + i * 2.9 + seed * 2.3);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.92]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function hero() {
  const h = document.querySelector('.ws-hero');
  if (!h) return;
  const scene = h.querySelector('.ws-scene');
  const back = scene.querySelector('.ws-blobs');
  const front = h.querySelector('.ws-front svg');
  const cv = scene.querySelector('canvas');
  const orb = scene.querySelector('.ws-orb'), rings = scene.querySelector('.ws-rings');
  defs(back, 'wb'); defs(front, 'wf');

  const mk = (svg, uid, b) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', `url(#${uid}-${b.g})`); p.setAttribute('filter', `url(#${uid}-sh)`);
    p.setAttribute('stroke', 'rgb(255 255 255 / .14)'); p.setAttribute('stroke-width', '1');
    if (b.o) p.setAttribute('opacity', b.o);
    svg.append(p); return { ...b, el: p };
  };
  // posições em frações do hero; r em fração do lado de referência; depth = quanto segue o mouse
  const wide = () => innerWidth >= 1024;
  const B = [];  // as formas orgânicas saíram: o topo fica com o painel, a esfera e as telas dos serviços
  const F = [];
  // as imagens dos serviços que flutuam: data-x/y (fração do hero), data-d (profundidade), data-r (giro), data-m="x,y" no celular ou "off"
  const floats = [...h.querySelectorAll('.ws-float')].map((el, i) => ({ el, x: +el.dataset.x, y: +el.dataset.y, d: +(el.dataset.d || .6), r: +(el.dataset.r || 0), m: el.dataset.m, s: i * 1.9 + .7 }));

  let W = 0, H = 0, R = 0, dpr = 1, ctx = cv.getContext('2d'), dots = [];
  const mouse = { x: .5, y: .5, tx: .5, ty: .5, px: -9999, py: -9999, in: false };
  function size() {
    const r = h.getBoundingClientRect();
    W = r.width; H = r.height; R = Math.max(Math.min(W, H), 520);
    for (const s of [back, front]) s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(90, Math.round(W * H / (wide() ? 15000 : 22000)));
    dots = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28, r: Math.random() * 1.4 + .6 }));
    if (wide()) { if (orb) place(orb, .455, .14); place(rings, .43, .9); } else { if (orb) place(orb, -1, -1); place(rings, -1, -1); }
  }
  const place = (el, x, y) => { el.style.left = `calc(${x * 100}% - ${el.offsetWidth / 2}px)`; el.style.top = `calc(${y * 100}% - ${el.offsetHeight / 2}px)`; el.dataset.x = x; el.dataset.y = y; };

  let t = Math.random() * 10;
  function draw(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    const mx = (mouse.x - .5) * 16, my = (mouse.y - .5) * 10;
    for (const b of [...B, ...F]) {
      const fx = Math.sin(t * .35 * b.sp + b.s) * 18, fy = Math.cos(t * .3 * b.sp + b.s * 1.3) * 22;
      const [bx, by, br] = wide() || !b.m ? [b.x, b.y, b.r] : b.m;
      b.el.setAttribute('d', blobPath(bx * W + fx + mx * b.d, by * H + fy + my * b.d, br * R, t * b.sp, b.s));
    }
    for (const f of floats) {
      let x = f.x, y = f.y;
      if (!wide()) { if (!f.m || f.m === 'off') { f.el.style.display = 'none'; continue; } [x, y] = f.m.split(',').map(Number); }
      f.el.style.display = '';
      const fx = Math.sin(t * .4 + f.s) * 10, fy = Math.cos(t * .33 + f.s * 1.4) * 14;
      f.el.style.left = `${x * 100}%`; f.el.style.top = `${y * 100}%`;
      f.el.style.transform = `translate(-50%, -50%) translate(${(mx * f.d + fx).toFixed(1)}px, ${(my * f.d + fy).toFixed(1)}px) rotate(${(f.r + Math.sin(t * .3 + f.s) * 2).toFixed(2)}deg)`;
    }
    if (orb) orb.style.transform = `translate(${mx * 1.2 + Math.sin(t * .5) * 8}px, ${my * 1.2 + Math.cos(t * .45) * 12}px)`;
    rings.style.transform = `translate(${mx * .7}px, ${my * .7}px)`;
    // partículas
    ctx.clearRect(0, 0, W, H);
    const L = 120, ML = 90;
    for (const p of dots) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      if (mouse.in) { const dx = p.x - mouse.px, dy = p.y - mouse.py, d2 = dx * dx + dy * dy; if (d2 < 1600) { const k = (1600 - d2) / 1600 * .15; p.x += dx / 40 * k; p.y += dy / 40 * k; } }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d < L) { ctx.strokeStyle = `rgba(92,225,230,${(1 - d / L) * .22})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      if (mouse.in) { const d = Math.hypot(a.x - mouse.px, a.y - mouse.py); if (d < ML) { ctx.strokeStyle = `rgba(143,196,255,${(1 - d / ML) * .18})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.px, mouse.py); ctx.stroke(); } }
      ctx.fillStyle = `rgba(214,240,255,${.35 + a.r * .25})`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // o painel de vidro inclina com o mouse
  const glass = h.querySelector('.ws-glass');
  if (fine) {
    h.addEventListener('pointermove', e => {
      const r = h.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height;
      mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top; mouse.in = true;
      if (glass && wide()) {
        const g = glass.getBoundingClientRect();
        glass.style.setProperty('--ry', `${-7 + (mouse.tx - .5) * 3}deg`);
        glass.style.setProperty('--rx', `${3 - (mouse.ty - .5) * 2}deg`);
        glass.style.setProperty('--gx', `${e.clientX - g.left}px`); glass.style.setProperty('--gy', `${e.clientY - g.top}px`);
      }
    }, { passive: true });
    h.addEventListener('pointerleave', () => { mouse.tx = .5; mouse.ty = .5; mouse.in = false; glass?.style.removeProperty('--ry'); glass?.style.removeProperty('--rx'); });
  }

  size();
  draw(0);
  // menos movimento pedido: nada se mexe sozinho, mas a cena ainda responde ao mouse
  if (reduced) { if (fine) { let q = 0; h.addEventListener('pointermove', () => { if (!q) q = requestAnimationFrame(() => { q = 0; draw(0); }); }, { passive: true }); } return; }
  let raf = 0, last = 0, visible = true;
  const loop = now => {
    raf = 0;
    if (state.paused || !visible || document.hidden) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    if (now - last >= 30) { draw(dt); last = now; }  // ~30 quadros por segundo
    raf = requestAnimationFrame(loop);
  };
  const go = () => { if (!raf && !state.paused && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; go(); }).observe(h);
  document.addEventListener('visibilitychange', go);
  onPause(go);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw(0); }, 150); });
  go();
}


/* ---------- o fundo em movimento do site inteiro (atrás de todas as seções) ---------- */
function siteBg() {
  const layer = document.createElement('div');
  layer.className = 'ws-bg'; layer.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('preserveAspectRatio', 'none');
  layer.append(cv, svg);
  // mini telas dos serviços nas laterais, ligadas por linhas de fluxo com um pulso de luz
  const ic = n => `<img src="assets/icons/${n}.svg" alt="">`;
  const CARDS = [
    // coluna da esquerda: quem procura no Google chega no site, fala com o agente e marca o horário
    { x: .085, y: .00, d: .5, h: `<div class="ws-card"><div class="ws-card__head">${ic('google-ads')}<span class="ws-card__url">Anúncio · suaempresa.com.br</span></div><b>O que o cliente procura, na hora</b><small>Google Ads</small></div>` },
    { x: .085, y: .27, d: .5, h: `<div class="ws-mini-site"><div class="ws-mini-site__bar"><i></i><i></i><i></i></div><div class="ws-mini-site__body"><b>Seu site no celular</b><span>Rápido e direto ao ponto</span><span class="ws-mini-site__btn">Chamar no WhatsApp</span></div></div>` },
    { x: .085, y: .54, d: .5, h: `<div class="ws-card"><div class="ws-card__head">${ic('ui-bot')}<b>Agente de IA</b></div>Respondeu em segundos<small>online 24 horas</small></div>` },
    { x: .085, y: .81, d: .5, h: `<div class="ws-bubble">${ic('whatsapp')}Horário marcado ✓</div>` },
    // coluna da direita: anúncio no Instagram, Reels e carrossel trazem o contato
    { x: .915, y: .13, d: .7, h: `<div class="ws-card"><div class="ws-card__head">${ic('meta')}<b>Anúncio no Instagram</b></div>Contatos pelo anúncio<div class="ws-bars"><i style="--h:30%"></i><i style="--h:45%"></i><i style="--h:40%"></i><i style="--h:62%"></i><i style="--h:78%"></i><i style="--h:95%"></i></div></div>` },
    { x: .915, y: .40, d: .7, h: `<div class="ws-card ws-card--reels"><div class="ws-card__head">${ic('instagram')}<b>Reels</b></div><div class="ws-reels"><i></i></div><small>Vídeos da sua marca</small></div>` },
    { x: .915, y: .67, d: .7, h: `<div class="ws-card"><div class="ws-card__head">${ic('instagram')}<b>Carrossel</b></div>Conteúdo que gera confiança<div class="ws-dots"><i class="on"></i><i></i><i></i><i></i><i></i></div></div>` },
    { x: .915, y: .94, d: .7, h: `<div class="ws-bubble">${ic('ui-message-circle')}Novo contato pelo Instagram</div>` },
  ];
  const tiles = CARDS.map((c, i) => {
    const el = document.createElement('div'); el.className = 'ws-bg__card'; el.innerHTML = c.h;
    layer.append(el);
    return { ...c, el, s: i * 2.1, px: 0, py: 0 };
  });
  const LINKS = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]].map(([a, b], i) => ({ a: tiles[a], b: tiles[b], s: i * .37 }));
  document.body.prepend(layer);
  // as telas ficam na margem livre ao lado do conteúdo; sem margem suficiente, somem
  let gutter = 0; const CW = 164;
  const measure = () => {
    const w = document.querySelector('main section:not(.ws-hero) .wrap') || document.querySelector('main .wrap');
    gutter = w ? w.getBoundingClientRect().left + parseFloat(getComputedStyle(w).paddingLeft) : 0;
  };
  const showCards = () => gutter >= 110;

  let W = 0, H = 0, dpr = 1, ctx = cv.getContext('2d'), dots = [];
  const mouse = { x: .5, y: .5, tx: .5, ty: .5, px: -9999, py: -9999, in: false };
  function size() {
    measure();
    W = innerWidth; H = innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.round(W * H / (W >= 1024 ? 19000 : 26000)));
    dots = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .24, vy: (Math.random() - .5) * .24, r: Math.random() * 1.3 + .5 }));
  }
  const wrap = (v, span) => ((v % span) + span) % span;
  let t = Math.random() * 10, lastY = scrollY;
  function draw(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    const mx = (mouse.x - .5) * 14, my = (mouse.y - .5) * 9, sy = scrollY, R = Math.max(Math.min(W, H), 520);
    const cards = showCards();
    for (const f of tiles) {
      if (!cards) { f.el.style.display = 'none'; continue; }
      f.el.style.display = '';
      const y = wrap(f.y * H * 1.5 - sy * f.d * .35, H * 1.5) - H * .25;
      f.px = (f.x < .5 ? gutter - 14 - CW / 2 : W - gutter + 14 + CW / 2) + mx * f.d * .6 + Math.sin(t * .4 + f.s) * 5;
      f.py = y + my * f.d * 1.4 + Math.cos(t * .35 + f.s) * 10;
      f.el.style.transform = `translate(${f.px.toFixed(1)}px, ${f.py.toFixed(1)}px) translate(-50%, -50%) rotate(${(Math.sin(t * .25 + f.s) * 2.5).toFixed(2)}deg) scale(.82)`;
    }
    // as partículas acompanham um pouco a rolagem
    const dy = (sy - lastY) * .15; lastY = sy;
    ctx.clearRect(0, 0, W, H);
    for (const p of dots) {
      p.x += p.vx; p.y += p.vy - dy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < -10) p.y += H + 20; else if (p.y > H + 10) p.y -= H + 20;
      if (mouse.in) { const ex = p.x - mouse.px, ey = p.y - mouse.py, d2 = ex * ex + ey * ey; if (d2 < 1600) { const k = (1600 - d2) / 1600 * .15; p.x += ex / 40 * k; p.y += ey / 40 * k; } }
    }
    const L = 120, ML = 90;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < L) { ctx.strokeStyle = `rgba(92,225,230,${(1 - d / L) * .16})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      if (mouse.in) { const d = Math.hypot(a.x - mouse.px, a.y - mouse.py); if (d < ML) { ctx.strokeStyle = `rgba(143,196,255,${(1 - d / ML) * .15})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.px, mouse.py); ctx.stroke(); } }
      ctx.fillStyle = `rgba(214,240,255,${.25 + a.r * .2})`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
    if (cards) flow();
  }
  // linhas de fluxo entre as mini telas, com um pulso de luz descendo
  function flow() {
    ctx.save();
    for (const k of LINKS) {
      const { a, b } = k, d = Math.hypot(b.px - a.px, b.py - a.py);
      if (d > H * .75 || b.py < a.py) continue;  // a tela deu a volta na rolagem: sem linha
      const side = a.x < .5 ? -1 : 1, cx = (a.px + b.px) / 2 + side * 46, cy = (a.py + b.py) / 2;
      const fade = Math.min(1, Math.min(a.py, H - b.py) / 120 + .35);
      ctx.setLineDash([3, 7]); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(92,225,230,${.28 * fade})`;
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.quadraticCurveTo(cx, cy, b.px, b.py); ctx.stroke();
      const u = (t * .22 + k.s) % 1, v = 1 - u;
      const x = v * v * a.px + 2 * v * u * cx + u * u * b.px, y = v * v * a.py + 2 * v * u * cy + u * u * b.py;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, `rgba(214,251,255,${.95 * fade})`); g.addColorStop(.25, `rgba(92,225,230,${.55 * fade})`); g.addColorStop(1, 'rgba(59,139,255,0)');
      ctx.setLineDash([]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  size(); draw(0);
  let q = 0; const once = () => { if (!q) q = requestAnimationFrame(() => { q = 0; draw(0); }); };
  if (fine) addEventListener('pointermove', e => { mouse.tx = e.clientX / W; mouse.ty = e.clientY / H; mouse.px = e.clientX; mouse.py = e.clientY; mouse.in = true; if (reduced) once(); }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.in = false; mouse.tx = .5; mouse.ty = .5; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw(0); }, 150); });
  if (reduced) { addEventListener('scroll', once, { passive: true }); return; }
  let raf = 0, last = 0;
  const loop = now => {
    raf = 0;
    if (state.paused || document.hidden) return;
    if (now - last >= 30) { draw(last ? Math.min(.05, (now - last) / 1000) : 0); last = now; }
    raf = requestAnimationFrame(loop);
  };
  const go = () => { if (!raf && !state.paused && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', go); onPause(go); go();
}

/* ---------- a palavra que troca no título ---------- */
function rotate() {
  document.querySelectorAll('.ws-rotate').forEach(box => {
    const words = (box.dataset.words || '').split(',').map(s => s.trim()).filter(Boolean);
    if (words.length < 2 || reduced) return;
    const chars = w => [...w].map((c, i) => `<span class="ws-ch" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    let i = 0, cur = box.querySelector('span');
    cur.innerHTML = chars(words[0]);
    let timer = 0;
    const next = () => {
      if (state.paused || document.hidden) return;
      i = (i + 1) % words.length;
      const old = cur; old.classList.add('is-out');
      setTimeout(() => old.remove(), 520);
      cur = document.createElement('span'); cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = chars(words[i]);
      box.append(cur);
    };
    timer = setInterval(next, 2800);
  });
}

/* ---------- pausa geral do movimento ---------- */
function pauses() {
  document.querySelectorAll('.ws-pause').forEach(b => {
    const icon = p => p ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2l8 5-8 5z"/></svg>' : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg>';
    b.innerHTML = icon(false);
    b.addEventListener('click', () => {
      state.paused = !state.paused;
      document.documentElement.classList.toggle('is-ws-paused', state.paused);
      document.querySelectorAll('.ws-pause').forEach(x => { x.innerHTML = icon(state.paused); x.setAttribute('aria-pressed', state.paused); x.setAttribute('aria-label', state.paused ? 'Retomar o movimento' : 'Pausar o movimento'); });
      state.listeners.forEach(fn => fn());
    });
  });
}

siteBg(); glow(); hero(); rotate(); pauses();
