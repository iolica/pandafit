// PandaFit - leitura do prato por foto (Gemini pelo Firebase AI Logic) e de produto por codigo de barras (Open Food Facts)
const SDK_IA = 'https://www.gstatic.com/firebasejs/13.3.0/firebase-';
const MODELO_IA = 'gemini-3.8-flash';
const LEITOR_ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const BASE_PRODUTOS = 'https://world.openfoodfacts.org/api/v2/product/';
const FOTOS_POR_DIA = 15;
const CHAVE_FOTOS_IA = 'pandafit_fotos_ia';
const PEDIDO_IA = 'Você é nutricionista. Identifique cada alimento ou bebida visível na foto e estime a quantidade, em gramas, que está servida. '
  + 'Para cada item devolva um nome curto em português do Brasil e, para a quantidade estimada, as calorias (kcal) e os gramas de proteína, carboidrato e gordura. '
  + 'Considere o modo de preparo aparente (frito, grelhado, com molho, com óleo). Se a foto não mostrar comida ou bebida, devolva a lista vazia.';

let appLeitor = null;
let modeloIA = null;
let leitura = [];

const iaLigada = () => typeof FIREBASE_CONFIG !== 'undefined' && !!FIREBASE_CONFIG && !!RECAPTCHA.chave;
const refeicaoPelaHora = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 0 : h < 15 ? 1 : h < 18.5 ? 2 : 3; };
const restamNoDia = () => metaKcal() + kcalDoDia(dataDieta) - totaisDoDia(dataDieta).kcal;

function opcoesDeLeitura() {
  return `
    <label class="botao-principal" for="campo-foto-camera">📷 Tirar foto do prato</label>
    <label class="botao-sec centro" for="campo-foto-galeria">Escolher foto da galeria</label>
    <button class="botao-sec centro" data-acao="codigo-abrir">Ler código de barras de um produto</button>
    <button class="botao-sec centro" data-acao="dieta-digitar">Buscar na lista ou digitar</button>
    <p class="aviso">A foto é enviada ao Google (Gemini) só para a leitura e não fica guardada no app.</p>`;
}

/* --- Foto do prato --- */
function fotosHoje() {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_FOTOS_IA)) || {};
    return c.dia === dataISO() ? c.n : 0;
  } catch (e) { return 0; }
}
function contarFoto() {
  try { localStorage.setItem(CHAVE_FOTOS_IA, JSON.stringify({ dia: dataISO(), n: fotosHoje() + 1 })); } catch (e) {}
}

async function prepararIA() {
  if (modeloIA) return modeloIA;
  const [base, verif, ia] = await Promise.all(['app', 'app-check', 'ai'].map((m) => import(SDK_IA + m + '.js')));
  if (!appLeitor) {
    appLeitor = base.initializeApp(FIREBASE_CONFIG, 'leitor');
    const Provedor = RECAPTCHA.enterprise ? verif.ReCaptchaEnterpriseProvider : verif.ReCaptchaV3Provider;
    verif.initializeAppCheck(appLeitor, { provider: new Provedor(RECAPTCHA.chave), isTokenAutoRefreshEnabled: true });
  }
  const S = ia.Schema;
  const item = S.object({ properties: { nome: S.string(), gramas: S.number(), kcal: S.number(), proteina: S.number(), carboidrato: S.number(), gordura: S.number() } });
  modeloIA = ia.getGenerativeModel(ia.getAI(appLeitor, { backend: new ia.GoogleAIBackend() }), {
    model: MODELO_IA,
    generationConfig: { responseMimeType: 'application/json', responseSchema: S.object({ properties: { itens: S.array({ items: item }) } }) },
  });
  return modeloIA;
}

async function analisarFoto(img) {
  const modelo = await prepararIA();
  const r = await modelo.generateContent([PEDIDO_IA, { type: 'inlineData', inlineData: { data: img.split(',')[1], mimeType: 'image/jpeg' } }]);
  return JSON.parse(r.response.text()).itens || [];
}

// Guarda os valores por grama para recalcular quando a quantidade for corrigida
function itemLido(x) {
  const g = num(x.gramas) > 0 ? num(x.gramas) : 100;
  return { nome: String(x.nome || 'Alimento').slice(0, 40), g, r: { kcal: num(x.kcal) / g, p: num(x.proteina) / g, c: num(x.carboidrato) / g, f: num(x.gordura) / g } };
}
const valoresDe = (it) => ({ kcal: Math.round(it.r.kcal * it.g), p: +(it.r.p * it.g).toFixed(1), c: +(it.r.c * it.g).toFixed(1), f: +(it.r.f * it.g).toFixed(1) });

function erroDeLeitura(e) {
  const txt = String((e && (e.code || '') + ' ' + (e.message || '')) || '').toLowerCase();
  if (!navigator.onLine) return 'Sem internet. A leitura por foto precisa de conexão.';
  if (/429|quota|resource.exhausted/.test(txt)) return 'O limite gratuito de leituras acabou por agora. Tente mais tarde ou lance de outra forma.';
  if (/app.?check|403|permission/.test(txt)) return 'A leitura por foto não foi liberada para este app (verificação do Firebase).';
  return 'Não foi possível ler a foto. Tente de novo ou lance de outra forma.';
}

function falhaNaLeitura(texto) {
  abrirFolha('Foto do prato', `<p class="msg-erro">${texto}</p>${opcoesDeLeitura()}`);
}

MUDANCAS['foto-prato'] = async (el) => {
  const arquivo = el.files[0];
  if (!arquivo) return;
  el.value = '';
  if (!iaLigada()) return falhaNaLeitura('A leitura por foto ainda não foi ativada neste app.');
  if (fotosHoje() >= FOTOS_POR_DIA) return falhaNaLeitura(`Você já usou as ${FOTOS_POR_DIA} leituras por foto de hoje.`);
  abrirFolha('Foto do prato', '<p class="vazio" id="lendo-prato">Lendo o prato… leva alguns segundos.</p>');
  try {
    const itens = await analisarFoto(await reduzirImagem(arquivo, 1024));
    if (!$('lendo-prato')) return;
    contarFoto();
    if (!itens.length) return falhaNaLeitura('Não encontrei comida nesta foto. Tente outra, mais de perto e com boa luz.');
    leitura = itens.map(itemLido);
    mostrarLeitura();
  } catch (e) {
    if ($('lendo-prato')) falhaNaLeitura(erroDeLeitura(e));
  }
};

function resumoDaLeitura() {
  const t = leitura.map(valoresDe).reduce((s, v) => ({ kcal: s.kcal + v.kcal, p: s.p + v.p, c: s.c + v.c, f: s.f + v.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const sobra = restamNoDia() - t.kcal;
  return `<p class="destaque">${fmt(t.kcal)} kcal</p>
    <p class="sub centro">Proteína ${fmt(t.p)} g · Carboidrato ${fmt(t.c)} g · Gordura ${fmt(t.f)} g</p>
    <p class="${sobra >= 0 ? 'msg-ok' : 'msg-erro'}">${sobra >= 0
      ? `Cabe na meta: sobram ${fmt(sobra)} kcal depois deste prato.`
      : `Este prato passa da sua meta do dia em ${fmt(-sobra)} kcal.`}</p>`;
}

const textoDoItem = (it) => { const v = valoresDe(it); return `${fmt(v.kcal)} kcal · P ${fmt(v.p)} · C ${fmt(v.c)} · G ${fmt(v.f)}`; };

function mostrarLeitura() {
  if (!leitura.length) return abrirFolha(REFEICOES[refeicaoAtual], opcoesDeLeitura());
  abrirFolha('Conferir o prato', `
    <p class="sub">Confira os alimentos e corrija as gramas. A quantidade é uma estimativa pela foto.</p>
    <ul>${leitura.map((it, i) => `<li class="leitura-item">
      <input type="text" value="${esc(it.nome)}" maxlength="40" aria-label="Alimento" data-digitar="leitura-nome" data-i="${i}">
      <input type="number" inputmode="decimal" step="any" min="1" value="${it.g}" aria-label="Gramas" data-digitar="leitura-g" data-i="${i}">
      <button class="remover" data-acao="leitura-remover" data-i="${i}" aria-label="Remover">✕</button>
      <small id="leitura-info-${i}">${textoDoItem(it)}</small></li>`).join('')}</ul>
    <div id="leitura-resumo">${resumoDaLeitura()}</div>
    <label class="campo">Refeição
      <select data-mudar="leitura-ref">${REFEICOES.map((n, r) => `<option value="${r}"${r === refeicaoAtual ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <button class="botao-principal" data-acao="leitura-salvar">Adicionar ao diário</button>
    <label class="botao-sec centro" for="campo-foto-camera">Tirar outra foto</label>`);
}

DIGITAR['leitura-nome'] = (el) => { leitura[Number(el.dataset.i)].nome = el.value; };
DIGITAR['leitura-g'] = (el) => {
  const it = leitura[Number(el.dataset.i)];
  it.g = Math.max(0, num(el.value));
  $('leitura-info-' + el.dataset.i).textContent = textoDoItem(it);
  $('leitura-resumo').innerHTML = resumoDaLeitura();
};
MUDANCAS['leitura-ref'] = (el) => { refeicaoAtual = Number(el.value); };
ACOES['leitura-remover'] = (el) => { leitura.splice(Number(el.dataset.i), 1); mostrarLeitura(); };

ACOES['leitura-salvar'] = () => {
  const itens = leitura.filter((it) => it.g > 0);
  if (!itens.length) return aviso('Informe as gramas de pelo menos um alimento');
  const dia = estado.dieta[dataDieta] || (estado.dieta[dataDieta] = []);
  for (const it of itens) dia.push({ ref: refeicaoAtual, nome: it.nome.trim() || 'Alimento', g: it.g, ...valoresDe(it) });
  leitura = [];
  salvar();
  fecharFolha();
  render();
  aviso('Prato adicionado em ' + REFEICOES[refeicaoAtual]);
};

/* --- Codigo de barras --- */
ACOES['codigo-abrir'] = () => {
  abrirFolha('Código de barras', `
    <div class="visor"><video id="video-codigo" playsinline muted></video></div>
    <p class="sub centro" id="status-codigo">Abrindo a câmera…</p>
    <form class="form" data-form="codigo-digitado">
      <div class="dupla"><input name="cod" type="text" inputmode="numeric" pattern="[0-9]{8,14}" placeholder="Ou digite os números" required>
        <button type="submit" class="botao-sec centro">Buscar</button></div>
    </form>`);
  lerCodigoPelaCamera();
};

FORMS['codigo-digitado'] = (dados) => buscarProduto(dados.cod.trim());

async function leitorDeCodigo() {
  if ('BarcodeDetector' in window) {
    const aceitos = await BarcodeDetector.getSupportedFormats();
    if (aceitos.includes('ean_13')) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => aceitos.includes(f)) });
      return async (tela) => { const r = await detector.detect(tela); return r.length ? r[0].rawValue : null; };
    }
  }
  if (!window.ZXing) await carregarScript(LEITOR_ZXING);
  const Z = window.ZXing;
  const leitor = new Z.MultiFormatReader();
  leitor.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]]]));
  return async (tela) => {
    try { return leitor.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(tela)))).getText(); }
    catch (e) { return null; }
  };
}

async function lerCodigoPelaCamera() {
  const video = $('video-codigo');
  const status = (txt) => { if ($('status-codigo')) $('status-codigo').textContent = txt; };
  let fluxo, ler;
  const parar = () => fluxo && fluxo.getTracks().forEach((t) => t.stop());
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (!video.isConnected) return parar();
    video.srcObject = fluxo;
    await video.play();
    ler = await leitorDeCodigo();
  } catch (e) {
    parar();
    return status('Não foi possível usar a câmera. Digite os números do código abaixo.');
  }
  status('Aponte a câmera para o código de barras');
  const tela = document.createElement('canvas');
  // A camera desliga sozinha quando a folha fecha ou troca de conteudo
  const passo = async () => {
    if (!video.isConnected) return parar();
    if (video.videoWidth) {
      const k = Math.min(1, 960 / video.videoWidth);
      tela.width = Math.round(video.videoWidth * k);
      tela.height = Math.round(video.videoHeight * k);
      tela.getContext('2d').drawImage(video, 0, 0, tela.width, tela.height);
      const cod = await ler(tela).catch(() => null);
      if (cod && video.isConnected) { parar(); return buscarProduto(cod); }
    }
    setTimeout(passo, 200);
  };
  passo();
}

function alimentoDoProduto(p, cod) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] != null ? num(n['energy-kcal_100g']) : num(n.energy_100g) / 4.184;
  const nome = [p.product_name_pt || p.product_name, (p.brands || '').split(',')[0].trim()].filter(Boolean).join(' - ').slice(0, 60);
  if (!nome || !(kcal > 0)) return null;
  return {
    nome, kcal: Math.round(kcal), p: num(n.proteins_100g), c: num(n.carbohydrates_100g), f: num(n.fat_100g),
    porcao: Math.round(num(p.serving_quantity)) || 100, medida: String(p.serving_size || '1 porção').slice(0, 30), cod,
  };
}

async function buscarProduto(cod) {
  const salvo = estado.alimentosCustom.findIndex((a) => a.cod === cod);
  if (salvo >= 0) return ACOES['dieta-escolher']({ dataset: { i: String(salvo) } });
  abrirFolha('Código de barras', `<p class="vazio" id="buscando-produto">Buscando o produto ${esc(cod)}…</p>`);
  let produto = null, semRede = false;
  try {
    const r = await fetch(`${BASE_PRODUTOS}${encodeURIComponent(cod)}.json?fields=product_name,product_name_pt,brands,nutriments,serving_quantity,serving_size`);
    const j = await r.json();
    if (j.status === 1) produto = j.product;
  } catch (e) { semRede = true; }
  if (!$('buscando-produto')) return;
  const alimento = produto && alimentoDoProduto(produto, cod);
  if (alimento) {
    estado.alimentosCustom.unshift(alimento);
    salvar();
    return ACOES['dieta-escolher']({ dataset: { i: '0' } });
  }
  const nome = produto ? (produto.product_name_pt || produto.product_name || '') : '';
  abrirFolha('Código de barras', `
    <p class="msg-erro">${semRede ? 'Sem conexão para buscar o produto.' : `Produto ${esc(cod)} sem informação nutricional na base pública.`}</p>
    <form class="form" data-form="alimento-custom">
      <h3>Cadastrar pelo rótulo (valores por 100 g)</h3>
      <input type="hidden" name="cod" value="${esc(cod)}">
      <input name="nome" type="text" placeholder="Nome do produto" maxlength="60" value="${esc(nome)}" required>
      <div class="quadra">
        <input name="kcal" type="number" inputmode="decimal" step="any" min="0" placeholder="kcal" required>
        <input name="p" type="number" inputmode="decimal" step="any" min="0" placeholder="prot.">
        <input name="c" type="number" inputmode="decimal" step="any" min="0" placeholder="carb.">
        <input name="f" type="number" inputmode="decimal" step="any" min="0" placeholder="gord.">
      </div>
      <input name="porcao" type="number" inputmode="numeric" min="1" placeholder="Porção em gramas (ex.: 30)">
      <button type="submit" class="botao-principal">Salvar e lançar</button>
    </form>
    <button class="botao-sec centro" data-acao="codigo-abrir">Ler outro código</button>`);
}
