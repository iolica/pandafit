// PandaFit - aba Treino (plano da semana, series, cargas, descanso, demonstracoes)
let diaAtual = POR_DATA_JS[new Date().getDay()];
let grupoFiltro = 'Todos';
let descanso = null;

function feitosDaSemana() {
  const semana = segundaDaSemana();
  if (!estado.feitos || estado.feitos.semana !== semana) estado.feitos = { semana, itens: {} };
  return estado.feitos.itens;
}

function registroDoItem(dia, id) {
  const feitos = feitosDaSemana();
  const chave = `${dia}|${id}`;
  if (feitos[chave] === true) feitos[chave] = { sets: [], ok: true };
  return feitos[chave] || (feitos[chave] = { sets: [], ok: false });
}

function gravarNoLog(it, reg) {
  const iso = reg.d || dataISO();
  const dia = estado.log[iso] || (estado.log[iso] = { itens: {} });
  if (reg.sets.length) {
    const ex = buscarExercicio(it.id);
    dia.itens[it.id] = { nome: ex ? ex.nome : it.id, sets: reg.sets, kcal: kcalItem(it, reg.sets.length) };
  } else {
    delete dia.itens[it.id];
    if (!Object.keys(dia.itens).length) delete estado.log[iso];
  }
}

function animacao(ex, classe = 'anim') {
  if (!ex || !ex.img) return `<div class="${classe} sem-img">🐼</div>`;
  const url = BASE_IMG + ex.img;
  return `<div class="${classe}"><img src="${url}/0.jpg" alt="" loading="lazy"><img src="${url}/1.jpg" alt="" loading="lazy"></div>`;
}

const linkYoutube = (nome) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`como fazer ${nome} execução correta`);

TELAS.treino = function renderTreino() {
  const hoje = POR_DATA_JS[new Date().getDay()];
  const lista = estado.plano[diaAtual];
  const regs = lista.map((it) => registroDoItem(diaAtual, it.id));
  const qtdFeitos = regs.filter((r) => r.ok).length;
  const kcalPlano = lista.reduce((s, it) => s + kcalItem(it), 0);
  const kcalFeito = lista.reduce((s, it, i) => s + kcalItem(it, regs[i].sets.length), 0);

  const sessao = estado.sessao
    ? `<div class="sessao ativa"><span>⏱ <strong id="relogio-sessao">${duracaoTexto(Date.now() - estado.sessao.inicio)}</strong></span><button class="botao-mini" data-acao="finalizar-treino">Finalizar treino</button></div>`
    : `<div class="sessao"><span class="sub">${estado.biotipo ? 'Biotipo: ' + BIOTIPOS[estado.biotipo].nome : 'Treino livre'}</span><button class="botao-mini" data-acao="iniciar-treino">▶ Iniciar treino</button></div>`;

  const abas = DIAS.map(
    (d) => `<button class="aba${d.k === diaAtual ? ' ativa' : ''}${d.k === hoje ? ' hoje' : ''}" data-acao="aba-dia" data-dia="${d.k}">${d.curto}</button>`
  ).join('');

  const itens = lista.length
    ? lista.map((it, i) => cartaoItem(it, i, regs[i])).join('')
    : '<li class="vazio">Nenhum exercício neste dia.<br>Toque em "Adicionar exercício" ou deixe como descanso.</li>';

  $('tela-treino').innerHTML = `
    ${sessao}
    <nav class="abas">${abas}</nav>
    <div class="resumo-dia"><span>${DIAS.find((d) => d.k === diaAtual).nome}</span>
      <span class="sub">${lista.length ? `${qtdFeitos}/${lista.length} feitos · 🔥 ${kcalFeito}/${kcalPlano} kcal` : 'Descanso'}</span></div>
    <div class="barra"><div style="width:${lista.length ? (qtdFeitos / lista.length) * 100 : 0}%"></div></div>
    <ul>${itens}</ul>
    <button class="botao-principal" data-acao="abrir-picker">+ Adicionar exercício</button>`;
};

function cartaoItem(it, i, reg) {
  const ex = buscarExercicio(it.id) || { nome: it.id, grupo: '' };
  const cardio = ex.grupo === 'Cardio';
  const chips = Array.from({ length: it.series }, (_, s) => {
    const set = reg.sets[s];
    const rotulo = set ? (set.kg ? fmt(set.kg, set.kg % 1 ? 1 : 0) + 'kg' : '✓') : s + 1;
    return `<button class="serie${set ? ' ok' : s === reg.sets.length ? ' proxima' : ''}" data-acao="serie" data-i="${i}" data-s="${s}">${rotulo}</button>`;
  }).join('');
  return `<li class="item${reg.ok ? ' feito' : ''}">
    <input type="checkbox" class="marcar" data-acao="marcar" data-i="${i}"${reg.ok ? ' checked' : ''} aria-label="Concluir">
    <button class="item-info" data-acao="detalhe" data-id="${it.id}" data-i="${i}">
      ${animacao(ex, 'mini')}
      <span><span class="item-nome">${esc(ex.nome)}</span><span class="item-grupo">${esc(ex.grupo)} · 🔥 ${kcalItem(it)} kcal · ver demonstração</span></span>
    </button>
    <button class="remover" data-acao="remover" data-i="${i}" aria-label="Remover">✕</button>
    <div class="item-controles">
      <label><input type="number" inputmode="numeric" min="1" max="20" value="${it.series}" data-mudar="item" data-campo="series" data-i="${i}"><span>séries</span></label>
      <label><input type="text" value="${esc(it.reps)}" data-mudar="item" data-campo="reps" data-i="${i}" maxlength="10"><span>${cardio ? 'tempo' : 'reps'}</span></label>
      ${cardio ? '' : `<label><input type="number" inputmode="decimal" min="0" step="0.5" value="${it.carga || ''}" placeholder="0" data-mudar="item" data-campo="carga" data-i="${i}"><span>kg</span></label>
      <label><input type="number" inputmode="numeric" min="0" step="5" value="${descansoDoItem(it)}" data-mudar="item" data-campo="descanso" data-i="${i}"><span>desc. (s)</span></label>`}
    </div>
    <div class="series">${chips}</div>
  </li>`;
}

/* --- Series, marcacao e descanso --- */
function concluirSerie(i) {
  const it = estado.plano[diaAtual][i];
  const reg = registroDoItem(diaAtual, it.id);
  const kg = it.carga || 0;
  const anterior = recordes()[it.id];
  if (!reg.sets.length) reg.d = dataISO();
  reg.sets.push({ kg, reps: it.reps });
  reg.ok = reg.sets.length >= it.series;
  gravarNoLog(it, reg);
  if (kg > 0 && anterior && kg > anterior.kg) aviso(`🏆 Novo recorde: ${fmt(kg, kg % 1 ? 1 : 0)} kg!`);
  const ex = buscarExercicio(it.id);
  if (!reg.ok && !(ex && ex.grupo === 'Cardio')) iniciarDescanso(descansoDoItem(it));
}

function iniciarDescanso(seg) {
  if (!seg) return;
  descanso = { fim: Date.now() + seg * 1000 };
  atualizarDescanso();
}

function atualizarDescanso() {
  const barra = $('barra-descanso');
  if (!descanso) { barra.hidden = true; return; }
  const falta = descanso.fim - Date.now();
  if (falta <= 0) {
    descanso = null;
    barra.hidden = true;
    apitar();
    aviso('Descanso acabou. Próxima série!');
    return;
  }
  barra.hidden = false;
  $('tempo-descanso').textContent = duracaoTexto(falta).slice(3);
}

function tickTreino() {
  atualizarDescanso();
  const rel = $('relogio-sessao');
  if (rel && estado.sessao) rel.textContent = duracaoTexto(Date.now() - estado.sessao.inicio);
}

ACOES['aba-dia'] = (el) => { diaAtual = el.dataset.dia; render(); };

ACOES['serie'] = (el) => {
  const i = Number(el.dataset.i);
  const it = estado.plano[diaAtual][i];
  const reg = registroDoItem(diaAtual, it.id);
  if (Number(el.dataset.s) < reg.sets.length) {
    reg.sets.pop();
    reg.ok = false;
    gravarNoLog(it, reg);
  } else concluirSerie(i);
  salvar();
  render();
};

ACOES['marcar'] = (el) => {
  const it = estado.plano[diaAtual][Number(el.dataset.i)];
  const reg = registroDoItem(diaAtual, it.id);
  if (el.checked) {
    if (!reg.sets.length) reg.d = dataISO();
    while (reg.sets.length < it.series) reg.sets.push({ kg: it.carga || 0, reps: it.reps });
    reg.ok = true;
  } else {
    reg.sets = [];
    reg.ok = false;
  }
  gravarNoLog(it, reg);
  salvar();
  render();
};

ACOES['remover'] = (el) => {
  estado.plano[diaAtual].splice(Number(el.dataset.i), 1);
  salvar();
  render();
};

MUDANCAS['item'] = (el) => {
  const it = estado.plano[diaAtual][Number(el.dataset.i)];
  const campo = el.dataset.campo;
  if (campo === 'series') it.series = Math.min(20, Math.max(1, Math.round(num(el.value)) || 1));
  else if (campo === 'reps') it.reps = el.value.trim() || '-';
  else if (campo === 'carga') it.carga = Math.max(0, num(el.value));
  else if (campo === 'descanso') it.descanso = Math.max(0, Math.round(num(el.value)));
  salvar();
  render();
};

ACOES['descanso-mais'] = () => { if (descanso) { descanso.fim += 15000; atualizarDescanso(); } };
ACOES['descanso-pular'] = () => { descanso = null; atualizarDescanso(); };

ACOES['iniciar-treino'] = () => {
  estado.sessao = { inicio: Date.now() };
  salvar();
  render();
};

ACOES['finalizar-treino'] = () => {
  const iso = dataISO();
  const min = Math.max(1, Math.round((Date.now() - estado.sessao.inicio) / 60000));
  const dia = estado.log[iso];
  const qtd = dia ? Object.keys(dia.itens).length : 0;
  if (dia) dia.dur = (dia.dur || 0) + min;
  estado.sessao = null;
  descanso = null;
  atualizarDescanso();
  salvar();
  render();
  abrirFolha('Treino finalizado 💪', `
    <div class="cartoes-num">
      <div><strong>${min} min</strong><span>duração</span></div>
      <div><strong>${qtd}</strong><span>exercícios</span></div>
      <div><strong>${kcalDoDia(iso)}</strong><span>kcal gastas</span></div>
    </div>
    <p class="sub centro">${qtd ? 'Boa! O treino de hoje já está no seu histórico.' : 'Nenhuma série foi marcada, então nada foi gravado no histórico.'}</p>
    <button class="botao-principal" data-acao="fechar-folha">Fechar</button>`);
};

/* --- Detalhe do exercicio (demonstracao, recorde, evolucao) --- */
ACOES['detalhe'] = (el) => {
  const ex = buscarExercicio(el.dataset.id);
  if (!ex) return;
  const doPicker = el.dataset.origem === 'picker';
  const rec = recordes()[ex.id];
  const evolucao = Object.keys(estado.log).sort()
    .map((iso) => ({ rotulo: dataBR(iso), v: Math.max(0, ...((estado.log[iso].itens[ex.id] || {}).sets || []).map((s) => s.kg || 0)) }))
    .filter((p) => p.v > 0);
  const exemplo = { id: ex.id, series: ex.grupo === 'Cardio' ? 1 : 3, reps: ex.grupo === 'Cardio' ? '20 min' : '12' };

  abrirFolha(ex.nome, `
    ${animacao(ex)}
    <p class="etiquetas"><span>${esc(ex.grupo)}</span><span>🔥 ≈ ${kcalItem(exemplo)} kcal em ${exemplo.series} x ${exemplo.reps}</span></p>
    ${ex.dica ? `<p>${esc(ex.dica)}</p>` : ''}
    <a class="botao-sec centro" href="${linkYoutube(ex.nome)}" target="_blank" rel="noopener">▶ Ver vídeo explicativo no YouTube</a>
    ${ex.grupo === 'Cardio' ? '' : `<h3>Evolução da carga</h3>
      ${rec ? `<p class="sub">🏆 Recorde: <strong>${fmt(rec.kg, rec.kg % 1 ? 1 : 0)} kg</strong> em ${dataBRLonga(rec.d)}</p>` : ''}
      ${evolucao.length ? graficoLinha(evolucao, 'kg') : '<p class="vazio">Anote a carga (kg) e marque as séries para acompanhar a evolução.</p>'}`}
    ${doPicker ? `<button class="botao-principal" data-acao="add" data-id="${ex.id}" data-fechar="1">+ Adicionar em ${DIAS.find((d) => d.k === diaAtual).nome}</button>
      <button class="botao-sec centro" data-acao="abrir-picker">← Voltar para a lista</button>` : ''}`);
};

/* --- Escolher exercicio --- */
ACOES['abrir-picker'] = () => {
  abrirFolha('Escolher exercício', `
    <input id="busca" type="search" placeholder="Buscar exercício" autocomplete="off" data-digitar="busca-exercicio">
    <div id="filtros-grupo" class="chips"></div>
    <ul id="lista-catalogo"></ul>
    <form class="form" data-form="exercicio-custom">
      <h3>Não achou? Crie o seu</h3>
      <input name="nome" type="text" placeholder="Nome do exercício" maxlength="40" required>
      <div class="dupla">
        <select name="grupo">${GRUPOS.map((g) => `<option>${g}</option>`).join('')}</select>
        <select name="met"><option value="3.5">Intensidade leve</option><option value="5" selected>Intensidade moderada</option><option value="7">Intensidade alta</option></select>
      </div>
      <button type="submit" class="botao-principal">Criar e adicionar</button>
    </form>`);
  renderPicker();
};

function renderPicker() {
  if (!$('lista-catalogo')) return;
  $('filtros-grupo').innerHTML = ['Todos'].concat(GRUPOS)
    .map((g) => `<button class="chip${g === grupoFiltro ? ' ativa' : ''}" data-acao="filtro-grupo" data-grupo="${g}">${g}</button>`)
    .join('');
  const termo = $('busca').value.trim().toLowerCase();
  const jaNoDia = new Set(estado.plano[diaAtual].map((it) => it.id));
  const itens = todosExercicios().filter((e) => (grupoFiltro === 'Todos' || e.grupo === grupoFiltro) && e.nome.toLowerCase().includes(termo));
  $('lista-catalogo').innerHTML = itens.length
    ? itens.map((e) => `<li class="linha-catalogo">
        <button class="linha-info" data-acao="detalhe" data-id="${e.id}" data-origem="picker">${animacao(e, 'mini')}<span>${esc(e.nome)}<small>${esc(e.grupo)} · ver demonstração</small></span></button>
        <button class="botao-add${jaNoDia.has(e.id) ? ' ok' : ''}" data-acao="add" data-id="${e.id}" aria-label="Adicionar">${jaNoDia.has(e.id) ? '✓' : '+'}</button>
      </li>`).join('')
    : '<li class="vazio">Nada encontrado.</li>';
}

function adicionarAoDia(id) {
  if (estado.plano[diaAtual].some((it) => it.id === id)) return false;
  const ex = buscarExercicio(id);
  const cardio = ex && ex.grupo === 'Cardio';
  estado.plano[diaAtual].push({ id, series: cardio ? 1 : 3, reps: cardio ? '20 min' : '12' });
  salvar();
  return true;
}

ACOES['filtro-grupo'] = (el) => { grupoFiltro = el.dataset.grupo; renderPicker(); };
ACOES['add'] = (el) => {
  aviso(adicionarAoDia(el.dataset.id) ? 'Exercício adicionado' : 'Já está neste dia');
  if (el.dataset.fechar) fecharFolha();
  renderPicker();
  render();
};

const DIGITAR = { 'busca-exercicio': renderPicker };

const FORMS = {
  'exercicio-custom': (dados) => {
    const id = 'x-' + Date.now();
    estado.custom.push({ id, nome: dados.nome.trim(), grupo: dados.grupo, met: num(dados.met), img: null, dica: '' });
    adicionarAoDia(id);
    fecharFolha();
    render();
  },
};
