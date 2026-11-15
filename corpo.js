// PandaFit - aba Corpo (perfil, indicadores, medidas, sono, fotos)
let subCorpo = 'perfil';
let metrica = 'peso';

const MEDIDAS = [
  ['peso', 'Peso', 'kg'], ['pescoco', 'Pescoço', 'cm'], ['ombros', 'Ombros', 'cm'], ['peito', 'Peito', 'cm'],
  ['cintura', 'Cintura', 'cm'], ['abdomen', 'Abdômen', 'cm'], ['quadril', 'Quadril', 'cm'], ['braco', 'Braço', 'cm'],
  ['antebraco', 'Antebraço', 'cm'], ['coxa', 'Coxa', 'cm'], ['panturrilha', 'Panturrilha', 'cm'],
];
const META_SONO = 8;

function formPerfil(botao) {
  const p = estado.perfil || {};
  const opcoes = (obj, atual, rotulo) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === atual ? ' selected' : ''}>${rotulo(v)}</option>`).join('');
  return `<form class="form" data-form="perfil">
    <label class="campo">Nome<input name="nome" type="text" maxlength="30" value="${esc(p.nome || '')}" placeholder="Como quer ser chamado"></label>
    <div class="campo">Sexo
      <div class="opcoes">
        <label><input type="radio" name="sexo" value="M"${p.sexo !== 'F' ? ' checked' : ''}><span>Masculino</span></label>
        <label><input type="radio" name="sexo" value="F"${p.sexo === 'F' ? ' checked' : ''}><span>Feminino</span></label>
      </div></div>
    <label class="campo">Data de nascimento<input name="nasc" type="date" value="${p.nasc || ''}" max="${dataISO()}" required></label>
    <div class="dupla">
      <label class="campo">Altura (cm)<input name="altura" type="number" inputmode="numeric" min="100" max="250" value="${p.altura || ''}" placeholder="170" required></label>
      <label class="campo">Peso (kg)<input name="peso" type="number" inputmode="decimal" step="any" min="30" max="300" value="${estado.perfil ? pesoAtual() : ''}" placeholder="70" required></label>
    </div>
    <label class="campo">Nível de atividade<select name="atividade">${opcoes(ATIVIDADE, p.atividade || 'leve', (v) => v[0])}</select></label>
    <label class="campo">Objetivo<select name="objetivo">${opcoes(OBJETIVOS, p.objetivo || 'manter', (v) => v)}</select></label>
    <button type="submit" class="botao-principal">${botao}</button>
  </form>`;
}

function gravarMedidas(iso, valores) {
  let reg = estado.medidas.find((m) => m.d === iso);
  if (!reg) { reg = { d: iso }; estado.medidas.push(reg); }
  Object.assign(reg, valores);
  estado.medidas.sort((a, b) => a.d.localeCompare(b.d));
}

FORMS['perfil'] = (dados) => {
  const peso = num(dados.peso);
  estado.perfil = { nome: dados.nome.trim(), sexo: dados.sexo, nasc: dados.nasc, altura: num(dados.altura), peso, atividade: dados.atividade, objetivo: dados.objetivo };
  gravarMedidas(dataISO(), { peso });
  salvar();
  fecharFolha();
  mostrar();
};

ACOES['editar-perfil'] = () => abrirFolha('Meu perfil', formPerfil('Salvar perfil'));
ACOES['sub-corpo'] = (el) => { subCorpo = el.dataset.k; render(); };

TELAS.corpo = function renderCorpo() {
  const subs = [['perfil', 'Perfil'], ['medidas', 'Medidas'], ['sono', 'Sono'], ['fotos', 'Fotos']];
  $('tela-corpo').innerHTML = `
    <nav class="abas">${subs.map(([k, n]) => `<button class="aba${k === subCorpo ? ' ativa' : ''}" data-acao="sub-corpo" data-k="${k}">${n}</button>`).join('')}</nav>
    <div id="corpo-conteudo">${{ perfil: htmlPerfil, medidas: htmlMedidas, sono: htmlSono, fotos: htmlFotos }[subCorpo]()}</div>`;
  if (subCorpo === 'fotos') carregarFotos();
};

/* --- Perfil e indicadores --- */
function htmlPerfil() {
  const p = estado.perfil;
  if (!p) return `<p class="sub">Preencha seu perfil para calcular calorias, IMC e metas.</p>${formPerfil('Salvar perfil')}`;
  const v = imc(), m = alturaCm() / 100, gord = gorduraCorporal(), macros = metaMacros();
  const linha = (rotulo, valor, obs = '') => `<li class="linha"><span>${rotulo}<small>${obs}</small></span><strong>${valor}</strong></li>`;
  return `
    <div class="cartao-bloco perfil-topo">
      <div><strong>${esc(p.nome || 'Meu perfil')}</strong>
        <span class="sub">${p.sexo === 'F' ? 'Feminino' : 'Masculino'} · ${idade()} anos · ${fmt(alturaCm())} cm · ${fmt(pesoAtual(), 1)} kg</span>
        <span class="sub">${OBJETIVOS[p.objetivo]} · ${ATIVIDADE[p.atividade][0].split(' (')[0]}</span></div>
      <button class="botao-mini" data-acao="editar-perfil">Editar</button>
    </div>
    <h3>Indicadores</h3>
    <ul>
      ${linha('IMC', fmt(v, 1), faixaImc(v))}
      ${linha('Peso ideal (IMC 18,5 a 24,9)', `${fmt(18.5 * m * m)} a ${fmt(24.9 * m * m)} kg`)}
      ${linha('Gordura corporal', gord ? fmt(gord, 1) + ' %' : '—', gord ? `Massa gorda ${fmt((pesoAtual() * gord) / 100, 1)} kg · massa magra ${fmt(pesoAtual() * (1 - gord / 100), 1)} kg` : `Registre pescoço${p.sexo === 'F' ? ', cintura e quadril' : ' e cintura'} em Medidas`)}
      ${linha('Metabolismo basal', fmt(tmb()) + ' kcal', 'O que o corpo gasta em repouso')}
      ${linha('Gasto diário estimado', fmt(gastoDiario()) + ' kcal', 'Basal + nível de atividade')}
      ${linha('Meta de calorias', fmt(metaKcal()) + ' kcal', OBJETIVOS[p.objetivo])}
      ${linha('Meta de macros', `P ${macros.p} · C ${macros.c} · G ${macros.f} g`, 'Proteína · carboidrato · gordura')}
    </ul>
    <p class="aviso">Estimativas por fórmulas (Mifflin-St Jeor e Marinha dos EUA). Servem de referência, não de diagnóstico.</p>`;
}

/* --- Medidas --- */
function htmlMedidas() {
  const info = MEDIDAS.find((x) => x[0] === metrica);
  const pontos = estado.medidas.filter((m) => m[metrica]).map((m) => ({ rotulo: dataBR(m.d), v: m[metrica] }));
  const dif = pontos.length > 1 ? pontos[pontos.length - 1].v - pontos[0].v : null;
  return `
    <button class="botao-principal" data-acao="medidas-novo">+ Registrar medidas</button>
    <h3>Evolução</h3>
    <div class="chips">${MEDIDAS.map(([k, n]) => `<button class="chip${k === metrica ? ' ativa' : ''}" data-acao="medidas-metrica" data-k="${k}">${n}</button>`).join('')}</div>
    ${graficoLinha(pontos, info[2])}
    ${dif != null ? `<p class="sub centro">${info[1]}: ${dif > 0 ? '+' : ''}${fmt(dif, 1)} ${info[2]} desde ${pontos[0].rotulo}</p>` : ''}
    <h3>Registros</h3>
    <ul>${estado.medidas.length ? estado.medidas.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => `<li class="linha">
      <span><strong>${dataBRLonga(m.d)}</strong><small>${MEDIDAS.filter(([k]) => m[k]).map(([k, n, u]) => `${n} ${fmt(m[k], 1)} ${u}`).join(' · ')}</small></span>
      <button class="remover" data-acao="medidas-apagar" data-i="${i}" aria-label="Apagar">✕</button></li>`).join('')
    : '<li class="vazio">Nenhuma medida registrada.</li>'}</ul>`;
}

ACOES['medidas-metrica'] = (el) => { metrica = el.dataset.k; render(); };

ACOES['medidas-novo'] = () => abrirFolha('Registrar medidas', `
  <form class="form" data-form="medidas">
    <label class="campo">Data<input name="d" type="date" value="${dataISO()}" max="${dataISO()}" required></label>
    <div class="dupla">${MEDIDAS.map(([k, n, u]) => `<label class="campo">${n} (${u})
      <input name="${k}" type="number" inputmode="decimal" step="any" min="0" placeholder="${ultimaMedida(k) ? fmt(ultimaMedida(k), 1) : '—'}"></label>`).join('')}</div>
    <p class="sub">Preencha só o que mediu hoje. Meça sempre no mesmo horário, com a fita justa sem apertar.</p>
    <button type="submit" class="botao-principal">Salvar</button>
  </form>`);

FORMS['medidas'] = (dados) => {
  const valores = {};
  for (const [k] of MEDIDAS) if (num(dados[k]) > 0) valores[k] = num(dados[k]);
  if (!Object.keys(valores).length) { aviso('Preencha pelo menos uma medida'); return; }
  gravarMedidas(dados.d, valores);
  salvar();
  fecharFolha();
  render();
};

ACOES['medidas-apagar'] = (el) => {
  if (!confirm('Apagar este registro de medidas?')) return;
  estado.medidas.splice(Number(el.dataset.i), 1);
  salvar();
  render();
};

/* --- Sono --- */
function htmlSono() {
  const hoje = dataISO();
  const porData = Object.fromEntries(estado.sono.map((s) => [s.d, s]));
  const semana = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i - 6));
  const comDado = semana.filter((d) => porData[d]);
  const media = comDado.length ? comDado.reduce((s, d) => s + porData[d].h, 0) / comDado.length : 0;
  const ultima = estado.sono[estado.sono.length - 1];
  return `
    <div class="cartoes-num">
      <div><strong>${ultima ? horasTexto(ultima.h) : '—'}</strong><span>última noite</span></div>
      <div><strong>${comDado.length ? horasTexto(media) : '—'}</strong><span>média 7 dias</span></div>
      <div><strong>${META_SONO}h</strong><span>meta</span></div>
    </div>
    <form class="form cartao-bloco" data-form="sono">
      <label class="campo">Acordei no dia<input name="d" type="date" value="${hoje}" max="${hoje}" required></label>
      <div class="dupla">
        <label class="campo">Dormi às<input name="dormiu" type="time" value="${ultima ? ultima.dormiu : '23:00'}" required></label>
        <label class="campo">Acordei às<input name="acordou" type="time" value="${ultima ? ultima.acordou : '07:00'}" required></label>
      </div>
      <button type="submit" class="botao-principal">Registrar sono</button>
    </form>
    <h3>Últimos 7 dias (horas)</h3>
    ${graficoBarras(semana.map((d) => ({ rotulo: dataBR(d), v: porData[d] ? Math.round(porData[d].h * 10) / 10 : 0 })), 'h', META_SONO)}
    <p class="sub centro">Linha tracejada: meta de ${META_SONO} h</p>
    <h3>Registros</h3>
    <ul>${estado.sono.length ? estado.sono.map((s, i) => ({ s, i })).reverse().slice(0, 30).map(({ s, i }) => `<li class="linha">
      <span><strong>${horasTexto(s.h)}</strong><small>${dataBRLonga(s.d)} · ${s.dormiu} → ${s.acordou}</small></span>
      <button class="remover" data-acao="sono-apagar" data-i="${i}" aria-label="Apagar">✕</button></li>`).join('')
    : '<li class="vazio">Nenhuma noite registrada.</li>'}</ul>`;
}

FORMS['sono'] = (dados) => {
  const minutos = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let dur = minutos(dados.acordou) - minutos(dados.dormiu);
  if (dur <= 0) dur += 1440;
  estado.sono = estado.sono.filter((s) => s.d !== dados.d);
  estado.sono.push({ d: dados.d, dormiu: dados.dormiu, acordou: dados.acordou, h: dur / 60 });
  estado.sono.sort((a, b) => a.d.localeCompare(b.d));
  salvar();
  render();
  aviso(`Sono de ${horasTexto(dur / 60)} registrado`);
};

ACOES['sono-apagar'] = (el) => {
  estado.sono.splice(Number(el.dataset.i), 1);
  salvar();
  render();
};

/* --- Fotos de progresso --- */
let fotosCache = [];

function htmlFotos() {
  return `
    <label class="botao-principal centro">📷 Adicionar foto<input type="file" accept="image/*" data-mudar="foto-nova" hidden></label>
    <p class="sub centro">As fotos ficam guardadas só neste aparelho.</p>
    <div id="grade-fotos" class="grade-fotos"><p class="vazio">Carregando...</p></div>`;
}

async function carregarFotos() {
  try { fotosCache = await listarFotos(); } catch (e) { fotosCache = []; }
  const grade = $('grade-fotos');
  if (!grade) return;
  grade.innerHTML = fotosCache.length
    ? (fotosCache.length > 1 ? '<button class="botao-sec centro largo" data-acao="foto-comparar">Comparar primeira x última</button>' : '')
      + fotosCache.slice().reverse().map((f) => `<button class="foto" data-acao="foto-ver" data-id="${f.id}"><img src="${f.img}" alt="Foto de ${dataBRLonga(f.d)}"><span>${dataBRLonga(f.d)}</span></button>`).join('')
    : '<p class="vazio">Nenhuma foto ainda. Tire uma hoje para comparar depois.</p>';
}

function reduzirImagem(arquivo, lado = 1000) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      ok(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = erro;
    img.src = url;
  });
}

MUDANCAS['foto-nova'] = async (el) => {
  const arquivo = el.files[0];
  if (!arquivo) return;
  try {
    await salvarFoto({ id: Date.now(), d: dataISO(), img: await reduzirImagem(arquivo) });
    aviso('Foto guardada');
  } catch (e) {
    aviso('Não foi possível guardar a foto');
  }
  carregarFotos();
};

ACOES['foto-ver'] = (el) => {
  const f = fotosCache.find((x) => x.id === Number(el.dataset.id));
  if (!f) return;
  abrirFolha(dataBRLonga(f.d), `<img class="foto-grande" src="${f.img}" alt="">
    <button class="botao-sec perigo centro" data-acao="foto-apagar" data-id="${f.id}">Apagar foto</button>`);
};

ACOES['foto-apagar'] = async (el) => {
  if (!confirm('Apagar esta foto?')) return;
  await apagarFoto(Number(el.dataset.id));
  fecharFolha();
  carregarFotos();
};

ACOES['foto-comparar'] = () => {
  const a = fotosCache[0], b = fotosCache[fotosCache.length - 1];
  abrirFolha('Antes x depois', `<div class="comparar">
    <figure><img src="${a.img}" alt=""><figcaption>${dataBRLonga(a.d)}</figcaption></figure>
    <figure><img src="${b.img}" alt=""><figcaption>${dataBRLonga(b.d)}</figcaption></figure></div>`);
};
