// PandaFit - aba Dieta (diario de alimentacao, calorias e macros)
let dataDieta = dataISO();
let refeicaoAtual = 0;

const todosAlimentos = () => estado.alimentosCustom.concat(ALIMENTOS);
const itensDoDia = (iso) => estado.dieta[iso] || [];

function totaisDoDia(iso) {
  return itensDoDia(iso).reduce((t, it) => ({ kcal: t.kcal + it.kcal, p: t.p + it.p, c: t.c + it.c, f: t.f + it.f }), { kcal: 0, p: 0, c: 0, f: 0 });
}

TELAS.dieta = function renderDieta() {
  const hoje = dataISO();
  const itens = itensDoDia(dataDieta);
  const tot = totaisDoDia(dataDieta);
  const meta = metaKcal(), macros = metaMacros();
  const gasto = kcalDoDia(dataDieta);
  const restam = meta + gasto - tot.kcal;

  const refeicoes = REFEICOES.map((nome, r) => {
    const lista = itens.map((it, i) => ({ it, i })).filter((x) => x.it.ref === r);
    const sub = lista.reduce((s, x) => s + x.it.kcal, 0);
    return `<div class="refeicao">
      <div class="refeicao-topo"><strong>${nome}</strong><span class="sub">${fmt(sub)} kcal</span>
        <button class="botao-add" data-acao="dieta-add" data-r="${r}" aria-label="Adicionar em ${nome}">+</button></div>
      <ul>${lista.map(({ it, i }) => `<li class="linha"><span>${esc(it.nome)}<small>${it.g ? fmt(it.g) + ' g · ' : ''}${fmt(it.kcal)} kcal · P ${fmt(it.p)} · C ${fmt(it.c)} · G ${fmt(it.f)}</small></span>
        <button class="remover" data-acao="dieta-remover" data-i="${i}" aria-label="Remover">✕</button></li>`).join('')}</ul>
    </div>`;
  }).join('');

  const semana = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i - 6)).map((iso) => ({ rotulo: dataBR(iso), v: Math.round(totaisDoDia(iso).kcal) }));

  $('tela-dieta').innerHTML = `
    <div class="nav-data">
      <button class="botao-icone" data-acao="dieta-dia" data-n="-1" aria-label="Dia anterior">‹</button>
      <strong>${dataDieta === hoje ? 'Hoje' : dataDieta === somaDias(hoje, -1) ? 'Ontem' : dataBRLonga(dataDieta)}</strong>
      <button class="botao-icone" data-acao="dieta-dia" data-n="1" aria-label="Próximo dia"${dataDieta >= hoje ? ' disabled' : ''}>›</button>
    </div>
    <div class="cartoes-num">
      <div><strong>${fmt(tot.kcal)}</strong><span>consumidas</span></div>
      <div><strong>${fmt(gasto)}</strong><span>gastas no treino</span></div>
      <div><strong>${fmt(Math.abs(restam))}</strong><span>${restam >= 0 ? 'restantes' : 'acima da meta'}</span></div>
    </div>
    <div class="cartao-bloco">
      ${barraMeta('Calorias', tot.kcal, meta, 'kcal')}
      ${barraMeta('Proteína', tot.p, macros.p, 'g')}
      ${barraMeta('Carboidrato', tot.c, macros.c, 'g')}
      ${barraMeta('Gordura', tot.f, macros.f, 'g')}
    </div>
    <div class="acoes-dieta">
      <label class="botao-principal" for="campo-foto-camera" data-acao="dieta-agora">📷 Foto do prato</label>
      <button class="botao-principal contorno" data-acao="codigo-agora">Código de barras</button>
    </div>
    ${estado.perfil ? '' : '<p class="aviso">Preencha seu perfil na aba Corpo para a meta ficar certa para você.</p>'}
    ${refeicoes}
    <h3>Calorias nos últimos 7 dias</h3>
    ${graficoBarras(semana, 'kcal', meta)}
    <p class="sub centro">Linha tracejada: meta de ${fmt(meta)} kcal</p>
    <p class="aviso">Valores nutricionais aproximados. A meta é uma estimativa e não substitui um nutricionista.</p>`;
};

/* --- Adicionar alimento --- */
ACOES['dieta-add'] = (el) => {
  refeicaoAtual = Number(el.dataset.r);
  abrirFolha(REFEICOES[refeicaoAtual], opcoesDeLeitura());
};

// Pelos botoes do topo a refeicao sai do horario; da para trocar na conferencia
ACOES['dieta-agora'] = () => { refeicaoAtual = refeicaoPelaHora(); };
ACOES['codigo-agora'] = () => { refeicaoAtual = refeicaoPelaHora(); ACOES['codigo-abrir'](); };

ACOES['dieta-digitar'] = () => {
  abrirFolha(REFEICOES[refeicaoAtual], `
    <input id="busca-alimento" type="search" placeholder="Buscar alimento" autocomplete="off" data-digitar="busca-alimento">
    <ul id="lista-alimentos"></ul>
    <form class="form" data-form="dieta-rapido">
      <h3>Lançar só as calorias</h3>
      <div class="dupla"><input name="nome" type="text" placeholder="O que comeu" maxlength="40" required>
        <input name="kcal" type="number" inputmode="numeric" min="1" placeholder="kcal" required></div>
      <button type="submit" class="botao-sec centro">Adicionar</button>
    </form>
    <form class="form" data-form="alimento-custom">
      <h3>Criar alimento (valores por 100 g)</h3>
      <input name="nome" type="text" placeholder="Nome do alimento" maxlength="40" required>
      <div class="quadra">
        <input name="kcal" type="number" inputmode="decimal" step="any" min="0" placeholder="kcal" required>
        <input name="p" type="number" inputmode="decimal" step="any" min="0" placeholder="prot.">
        <input name="c" type="number" inputmode="decimal" step="any" min="0" placeholder="carb.">
        <input name="f" type="number" inputmode="decimal" step="any" min="0" placeholder="gord.">
      </div>
      <input name="porcao" type="number" inputmode="numeric" min="1" placeholder="Porção habitual em gramas (ex.: 100)">
      <button type="submit" class="botao-sec centro">Salvar alimento</button>
    </form>`);
  renderAlimentos();
};

function renderAlimentos() {
  if (!$('lista-alimentos')) return;
  const termo = $('busca-alimento').value.trim().toLowerCase();
  const lista = todosAlimentos().map((a, i) => ({ a, i })).filter((x) => x.a.nome.toLowerCase().includes(termo)).slice(0, termo ? 60 : 25);
  $('lista-alimentos').innerHTML = lista.length
    ? lista.map(({ a, i }) => `<li><button class="linha linha-botao" data-acao="dieta-escolher" data-i="${i}">
        <span>${esc(a.nome)}<small>${esc(a.medida)} (${a.porcao} g) · ${fmt((a.kcal * a.porcao) / 100)} kcal</small></span><span>›</span></button></li>`).join('')
      + (termo ? '' : '<li class="sub centro">Digite para buscar em toda a tabela</li>')
    : '<li class="vazio">Nada encontrado. Use os campos abaixo.</li>';
}
DIGITAR['busca-alimento'] = renderAlimentos;

ACOES['dieta-escolher'] = (el) => {
  const a = todosAlimentos()[Number(el.dataset.i)];
  abrirFolha(a.nome, `
    <p class="sub">Por 100 g: ${fmt(a.kcal)} kcal · P ${fmt(a.p, 1)} g · C ${fmt(a.c, 1)} g · G ${fmt(a.f, 1)} g</p>
    <form class="form" data-form="dieta-quantidade" data-i="${el.dataset.i}">
      <label class="campo">Quantidade em gramas
        <input name="g" type="number" inputmode="decimal" step="any" min="1" value="${a.porcao}" data-digitar="dieta-previa" data-kcal="${a.kcal}" required></label>
      <p class="sub">${esc(a.medida)} = ${a.porcao} g</p>
      <div class="chips">${[0.5, 1, 1.5, 2, 3].map((n) => `<button type="button" class="chip" data-acao="dieta-porcoes" data-g="${a.porcao * n}">${String(n).replace('.', ',')}x</button>`).join('')}</div>
      <p class="destaque" id="previa-kcal">${fmt((a.kcal * a.porcao) / 100)} kcal</p>
      <button type="submit" class="botao-principal">Adicionar em ${REFEICOES[refeicaoAtual]}</button>
      <button type="button" class="botao-sec centro" data-acao="dieta-digitar">← Voltar para a lista</button>
    </form>`);
};

function previaKcal() {
  const campo = document.querySelector('[data-digitar="dieta-previa"]');
  if (campo) $('previa-kcal').textContent = fmt((num(campo.dataset.kcal) * num(campo.value)) / 100) + ' kcal';
}
DIGITAR['dieta-previa'] = previaKcal;
ACOES['dieta-porcoes'] = (el) => {
  document.querySelector('[data-digitar="dieta-previa"]').value = el.dataset.g;
  previaKcal();
};

function lancar(item) {
  (estado.dieta[dataDieta] || (estado.dieta[dataDieta] = [])).push({ ref: refeicaoAtual, ...item });
  salvar();
  fecharFolha();
  render();
}

FORMS['dieta-quantidade'] = (dados, form) => {
  const a = todosAlimentos()[Number(form.dataset.i)];
  const g = num(dados.g), k = g / 100;
  if (g <= 0) return;
  lancar({ nome: a.nome, g, kcal: Math.round(a.kcal * k), p: +(a.p * k).toFixed(1), c: +(a.c * k).toFixed(1), f: +(a.f * k).toFixed(1) });
};

FORMS['dieta-rapido'] = (dados) => lancar({ nome: dados.nome.trim(), g: 0, kcal: Math.round(num(dados.kcal)), p: 0, c: 0, f: 0 });

FORMS['alimento-custom'] = (dados) => {
  const porcao = num(dados.porcao) || 100;
  estado.alimentosCustom.unshift({ nome: dados.nome.trim(), kcal: num(dados.kcal), p: num(dados.p), c: num(dados.c), f: num(dados.f), porcao, medida: '1 porção', ...(dados.cod ? { cod: dados.cod } : {}) });
  salvar();
  ACOES['dieta-escolher']({ dataset: { i: '0' } });
};

ACOES['dieta-remover'] = (el) => {
  estado.dieta[dataDieta].splice(Number(el.dataset.i), 1);
  if (!estado.dieta[dataDieta].length) delete estado.dieta[dataDieta];
  salvar();
  render();
};

ACOES['dieta-dia'] = (el) => {
  const novo = somaDias(dataDieta, Number(el.dataset.n));
  if (novo > dataISO()) return;
  dataDieta = novo;
  render();
};
