// PandaFit - estado salvo, utilitarios, calculos e graficos
const CHAVE = 'meu_treino_v1';
const DIAS = [
  { k: 'seg', curto: 'Seg', nome: 'Segunda-feira' },
  { k: 'ter', curto: 'Ter', nome: 'Terça-feira' },
  { k: 'qua', curto: 'Qua', nome: 'Quarta-feira' },
  { k: 'qui', curto: 'Qui', nome: 'Quinta-feira' },
  { k: 'sex', curto: 'Sex', nome: 'Sexta-feira' },
  { k: 'sab', curto: 'Sáb', nome: 'Sábado' },
  { k: 'dom', curto: 'Dom', nome: 'Domingo' },
];
const POR_DATA_JS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const ATIVIDADE = {
  sedentario: ['Sedentário (pouco ou nenhum exercício)', 1.2],
  leve: ['Leve (1 a 3 dias por semana)', 1.375],
  moderado: ['Moderado (3 a 5 dias por semana)', 1.55],
  intenso: ['Intenso (6 a 7 dias por semana)', 1.725],
  atleta: ['Muito intenso (2x por dia / trabalho pesado)', 1.9],
};
const OBJETIVOS = { perder: 'Perder gordura', manter: 'Manter o peso', ganhar: 'Ganhar massa' };

const ACOES = {};
const MUDANCAS = {};
const TELAS = {};

const $ = (id) => document.getElementById(id);
const planoVazio = () => Object.fromEntries(DIAS.map((d) => [d.k, []]));

/* --- Datas (sempre no horario local) --- */
const dois = (n) => String(n).padStart(2, '0');
function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
function somaDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return dataISO(d);
}
const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataBRLonga = (iso) => `${dataBR(iso)}/${iso.slice(0, 4)}`;
const diaDaData = (iso) => POR_DATA_JS[deISO(iso).getDay()];
const horaMin = (ts) => { const d = new Date(ts); return `${dois(d.getHours())}:${dois(d.getMinutes())}`; };

function segundaDaSemana() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dataISO(d);
}

function duracaoTexto(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
}
function horasTexto(h) {
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)}h${dois(min % 60)}`;
}

/* --- Estado --- */
function estadoPadrao() {
  return {
    iniciado: false, biotipo: null, plano: planoVazio(), custom: [], feitos: {},
    perfil: null, medidas: [], log: {}, sessao: null,
    jejum: { protocolo: '16:8', horas: 16, inicio: null, historico: [] },
    dieta: {}, alimentosCustom: [], sono: [],
    cfg: { descanso: 60, som: true },
  };
}

function carregar() {
  const padrao = estadoPadrao();
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo && salvo.plano) {
      return { ...padrao, ...salvo, jejum: { ...padrao.jejum, ...salvo.jejum }, cfg: { ...padrao.cfg, ...salvo.cfg } };
    }
  } catch (e) {}
  return padrao;
}

let estado = carregar();
let avisouEspaco = false;

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    if (!avisouEspaco) { avisouEspaco = true; alert('Não foi possível salvar: o armazenamento do aparelho está cheio.'); }
  }
}

function esc(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const fmt = (n, casas = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/* --- Perfil e indicadores --- */
function idade() {
  const p = estado.perfil;
  if (!p || !p.nasc) return 30;
  const n = deISO(p.nasc), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

function ultimaMedida(campo) {
  for (let i = estado.medidas.length - 1; i >= 0; i--) if (estado.medidas[i][campo]) return estado.medidas[i][campo];
  return null;
}
const pesoAtual = () => ultimaMedida('peso') || (estado.perfil && estado.perfil.peso) || 70;
const alturaCm = () => (estado.perfil && estado.perfil.altura) || 170;

function imc() {
  const m = alturaCm() / 100;
  return pesoAtual() / (m * m);
}
function faixaImc(v) {
  if (v < 18.5) return 'Abaixo do peso';
  if (v < 25) return 'Peso normal';
  if (v < 30) return 'Sobrepeso';
  if (v < 35) return 'Obesidade grau 1';
  if (v < 40) return 'Obesidade grau 2';
  return 'Obesidade grau 3';
}

// Mifflin-St Jeor
function tmb() {
  const masc = !estado.perfil || estado.perfil.sexo !== 'F';
  return 10 * pesoAtual() + 6.25 * alturaCm() - 5 * idade() + (masc ? 5 : -161);
}
function gastoDiario() {
  const nivel = (estado.perfil && estado.perfil.atividade) || 'leve';
  return tmb() * ATIVIDADE[nivel][1];
}
function metaKcal() {
  const obj = (estado.perfil && estado.perfil.objetivo) || 'manter';
  const fator = obj === 'perder' ? 0.8 : obj === 'ganhar' ? 1.1 : 1;
  const minimo = estado.perfil && estado.perfil.sexo === 'F' ? 1200 : 1500;
  return Math.max(minimo, Math.round(gastoDiario() * fator));
}
function metaMacros() {
  const obj = (estado.perfil && estado.perfil.objetivo) || 'manter';
  const kcal = metaKcal();
  const p = Math.round(pesoAtual() * (obj === 'perder' ? 2 : obj === 'ganhar' ? 1.8 : 1.6));
  const f = Math.round((kcal * 0.25) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { p, c, f };
}

// Formula da Marinha dos EUA (medidas em cm)
function gorduraCorporal() {
  const cintura = ultimaMedida('cintura'), pescoco = ultimaMedida('pescoco'), quadril = ultimaMedida('quadril');
  if (!cintura || !pescoco) return null;
  const fem = estado.perfil && estado.perfil.sexo === 'F';
  if (fem && !quadril) return null;
  const circ = fem ? cintura + quadril - pescoco : cintura - pescoco;
  if (circ <= 0) return null;
  const dens = fem
    ? 1.29579 - 0.35004 * Math.log10(circ) + 0.221 * Math.log10(alturaCm())
    : 1.0324 - 0.19077 * Math.log10(circ) + 0.15456 * Math.log10(alturaCm());
  const pct = 495 / dens - 450;
  return pct > 2 && pct < 70 ? pct : null;
}

/* --- Exercicios e calorias --- */
const todosExercicios = () => CATALOGO.concat(estado.custom);
const buscarExercicio = (id) => todosExercicios().find((e) => e.id === id);
const descansoDoItem = (it) => (it.descanso != null ? it.descanso : estado.cfg.descanso);

function minutosDoItem(it, ex) {
  const txt = String(it.reps).toLowerCase();
  const numeros = txt.match(/\d+([.,]\d+)?/g);
  const n = numeros ? num(numeros[numeros.length - 1]) : 0;
  if (/min/.test(txt) || (ex && ex.grupo === 'Cardio' && !/s/.test(txt))) return it.series * (n || 10);
  const execucao = /\d\s*s/.test(txt) ? n : Math.max(n, 1) * 3;
  return (it.series * (execucao + descansoDoItem(it))) / 60;
}

// kcal = MET x peso (kg) x horas
function kcalItem(it, seriesFeitas) {
  const ex = buscarExercicio(it.id);
  const met = (ex && ex.met) || 4.5;
  const total = (met * pesoAtual() * minutosDoItem(it, ex)) / 60;
  const fracao = seriesFeitas == null ? 1 : Math.min(1, seriesFeitas / Math.max(1, it.series));
  return Math.round(total * fracao);
}

function kcalDoDia(iso) {
  const dia = estado.log[iso];
  if (!dia) return 0;
  return Object.values(dia.itens || {}).reduce((s, r) => s + (r.kcal || 0), 0);
}
const treinouEm = (iso) => !!estado.log[iso] && Object.keys(estado.log[iso].itens || {}).length > 0;

// Dia de descanso (sem exercicios no plano) nao quebra a sequencia
function sequenciaTreino() {
  let seq = 0, iso = dataISO();
  for (let i = 0; i < 400; i++, iso = somaDias(iso, -1)) {
    if (treinouEm(iso)) seq++;
    else if (i === 0 || !estado.plano[diaDaData(iso)].length) continue;
    else break;
  }
  return seq;
}

function recordes() {
  const rec = {};
  for (const [iso, dia] of Object.entries(estado.log)) {
    for (const [id, r] of Object.entries(dia.itens || {})) {
      const maior = Math.max(0, ...(r.sets || []).map((s) => s.kg || 0));
      if (maior > 0 && (!rec[id] || maior > rec[id].kg)) rec[id] = { kg: maior, d: iso };
    }
  }
  return rec;
}

/* --- Folha (janela que sobe de baixo) --- */
function abrirFolha(titulo, html) {
  $('folha-titulo').textContent = titulo;
  $('folha-conteudo').innerHTML = html;
  $('folha').hidden = false;
  $('folha').querySelector('.folha-corpo').scrollTop = 0;
}
function fecharFolha() {
  $('folha').hidden = true;
  $('folha-conteudo').innerHTML = '';
}

function aviso(texto) {
  const el = $('aviso-rapido');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, 2600);
}

function apitar() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!estado.cfg.som) return;
  try {
    const ctx = apitar.ctx || (apitar.ctx = new (window.AudioContext || window.webkitAudioContext)());
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) {}
}

/* --- Graficos (SVG, uma serie) --- */
function graficoLinha(pontos, unidade = '') {
  if (pontos.length < 2) return '<p class="vazio">Registre pelo menos 2 datas para ver a evolução.</p>';
  const L = 320, A = 150, e = 38, d = 12, t = 12, b = 22;
  const vs = pontos.map((p) => p.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.15;
  min -= folga; max += folga;
  const x = (i) => e + (i * (L - e - d)) / (pontos.length - 1);
  const y = (v) => t + ((max - v) * (A - t - b)) / (max - min);
  const casas = max - min < 10 ? 1 : 0;
  const grade = [0, 0.5, 1].map((f) => {
    const v = min + (max - min) * f;
    return `<line class="g-grade" x1="${e}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eixo" x="${e - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, casas)}</text>`;
  }).join('');
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const marcas = pontos.map((p, i) => `<circle class="g-ponto" cx="${x(i)}" cy="${y(p.v)}" r="4"/><circle class="g-alvo" cx="${x(i)}" cy="${y(p.v)}" r="13" data-dica="${esc(p.rotulo)}: ${fmt(p.v, 1)} ${esc(unidade)}"/>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img">
    ${grade}<path class="g-linha" d="${caminho}"/>${marcas}
    <text class="g-eixo" x="${e}" y="${A - 5}">${esc(pontos[0].rotulo)}</text>
    <text class="g-eixo" x="${L - d}" y="${A - 5}" text-anchor="end">${esc(pontos[pontos.length - 1].rotulo)}</text>
  </svg>`;
}

function graficoBarras(itens, unidade = '', meta = null) {
  const L = 320, A = 150, e = 38, d = 8, t = 12, b = 22;
  const max = Math.max(1, meta || 0, ...itens.map((i) => i.v)) * 1.1;
  const y = (v) => t + ((max - v) * (A - t - b)) / max;
  const passo = (L - e - d) / itens.length;
  const larg = Math.min(26, passo - 6);
  const casas = max < 20 ? 1 : 0;
  const grade = [0.5, 1].map((f) => {
    const v = (max / 1.1) * f;
    return `<line class="g-grade" x1="${e}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eixo" x="${e - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, casas)}</text>`;
  }).join('');
  const barras = itens.map((it, i) => {
    const cx = e + passo * i + passo / 2, alt = Math.max(0, A - b - y(it.v)), r = Math.min(4, alt);
    const x0 = cx - larg / 2, yb = A - b;
    const forma = alt > 0 ? `<path class="g-barra" d="M${x0},${yb} V${yb - alt + r} Q${x0},${yb - alt} ${x0 + r},${yb - alt} H${x0 + larg - r} Q${x0 + larg},${yb - alt} ${x0 + larg},${yb - alt + r} V${yb} Z"/>` : '';
    return `${forma}<rect class="g-alvo" x="${cx - passo / 2}" y="${t}" width="${passo}" height="${A - t - b}" data-dica="${esc(it.rotulo)}: ${fmt(it.v, casas)} ${esc(unidade)}"/>
      <text class="g-eixo" x="${cx}" y="${A - 5}" text-anchor="middle">${esc(it.rotulo)}</text>`;
  }).join('');
  const linhaMeta = meta ? `<line class="g-meta" x1="${e}" x2="${L - d}" y1="${y(meta)}" y2="${y(meta)}"/>` : '';
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img">${grade}<line class="g-base" x1="${e}" x2="${L - d}" y1="${A - b}" y2="${A - b}"/>${barras}${linhaMeta}</svg>`;
}

function anel(fracao, centro, sub) {
  const r = 86, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, fracao));
  return `<div class="anel"><svg viewBox="0 0 200 200">
    <circle class="anel-fundo" cx="100" cy="100" r="${r}"/>
    <circle class="anel-valor" id="anel-valor" cx="100" cy="100" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 100 100)"/>
  </svg><div class="anel-texto"><strong id="anel-centro">${centro}</strong><span id="anel-sub">${sub}</span></div></div>`;
}

function barraMeta(rotulo, valor, meta, unidade) {
  const pct = meta ? Math.min(100, (valor / meta) * 100) : 0;
  return `<div class="meta-linha"><div class="meta-topo"><span>${rotulo}</span><span>${fmt(valor)} / ${fmt(meta)} ${unidade}</span></div>
    <div class="barra"><div style="width:${pct}%"></div></div></div>`;
}

/* --- Fotos (IndexedDB, ficam so no aparelho) --- */
function bancoFotos() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open('treino_iolico', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fotos', { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}
async function fotosOp(modo, fn) {
  const db = await bancoFotos();
  return new Promise((ok, erro) => {
    const tx = db.transaction('fotos', modo);
    const req = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => ok(req && req.result);
    tx.onerror = () => erro(tx.error);
  });
}
const listarFotos = async () => ((await fotosOp('readonly', (s) => s.getAll())) || []).sort((a, b) => a.d.localeCompare(b.d) || a.id - b.id);
const salvarFoto = (foto) => fotosOp('readwrite', (s) => s.put(foto));
const apagarFoto = (id) => fotosOp('readwrite', (s) => s.delete(id));
const limparFotos = () => fotosOp('readwrite', (s) => s.clear());
