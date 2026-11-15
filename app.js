// PandaFit - navegacao, boas-vindas, opcoes, backup e eventos
const ABAS = ['inicio', 'treino', 'jejum', 'dieta', 'corpo'];
const TITULOS = { inicio: 'Resumo', treino: 'Treino', jejum: 'Jejum intermitente', dieta: 'Dieta', corpo: 'Corpo' };
let abaAtual = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';

function render() {
  for (const a of ABAS) $('tela-' + a).hidden = a !== abaAtual;
  document.querySelectorAll('.nav-baixo button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === abaAtual));
  $('sub-topo').textContent = TITULOS[abaAtual];
  TELAS[abaAtual]();
}

ACOES['ir'] = (el) => {
  abaAtual = el.dataset.aba;
  if (el.dataset.sub) subCorpo = el.dataset.sub;
  history.replaceState(null, '', '#' + abaAtual);
  render();
  window.scrollTo(0, 0);
};

/* --- Boas-vindas: perfil e depois biotipo --- */
function mostrar() {
  const precisaPerfil = !estado.perfil && !estado.perfilVisto;
  const precisaBiotipo = !precisaPerfil && !estado.iniciado;
  $('boas-vindas').hidden = !(precisaPerfil || precisaBiotipo);
  $('principal').hidden = precisaPerfil || precisaBiotipo;

  if (precisaPerfil) {
    $('boas-vindas').innerHTML = `
      <img class="panda" src="icon-512.png" alt="">
      <h1>PandaFit</h1>
      <p class="sub">Treino, jejum, dieta e medidas em um só lugar. Conte um pouco sobre você para as calorias e metas ficarem certas.</p>
      ${formPerfil('Continuar')}
      <button class="botao-sec centro" data-acao="pular-perfil">Pular por enquanto</button>`;
  } else if (precisaBiotipo) {
    const temPlano = DIAS.some((d) => estado.plano[d.k].length);
    $('boas-vindas').innerHTML = `
      <h1>Seu treino</h1>
      <p class="sub">Escolha seu biotipo para começar com um treino pré-montado, ou monte o seu do zero. Você pode mudar tudo depois.</p>
      ${Object.entries(BIOTIPOS).map(([k, b]) => `<button class="cartao" data-acao="biotipo" data-biotipo="${k}"><strong>${b.nome}</strong><span>${b.resumo}</span></button>`).join('')}
      <button class="cartao cartao-livre" data-acao="biotipo" data-biotipo=""><strong>Começar do zero</strong><span>Sem treino pré-montado. Você escolhe todos os exercícios.</span></button>
      ${temPlano ? '<button class="botao-sec centro" data-acao="manter-plano">Cancelar e manter meu treino atual</button>' : ''}
      <p class="aviso">Os treinos pré-montados são sugestões gerais, não substituem a orientação de um profissional.</p>`;
  } else render();
}

ACOES['pular-perfil'] = () => { estado.perfilVisto = true; salvar(); mostrar(); };
ACOES['manter-plano'] = () => { estado.iniciado = true; salvar(); mostrar(); };

ACOES['biotipo'] = (el) => {
  const biotipo = el.dataset.biotipo || null;
  estado.biotipo = biotipo;
  estado.plano = planoVazio();
  if (biotipo) for (const d of DIAS) estado.plano[d.k] = BIOTIPOS[biotipo].plano[d.k].map(([id, series, reps]) => ({ id, series, reps }));
  estado.feitos = {};
  estado.iniciado = true;
  salvar();
  abaAtual = 'treino';
  mostrar();
};

/* --- Opcoes e backup --- */
ACOES['abrir-config'] = () => abrirFolha('Opções', `
  <label class="campo">Descanso padrão entre séries (segundos)
    <input type="number" inputmode="numeric" min="0" step="5" value="${estado.cfg.descanso}" data-mudar="cfg-descanso"></label>
  <label class="campo-linha"><input type="checkbox" data-mudar="cfg-som"${estado.cfg.som ? ' checked' : ''}> Som no fim do descanso e do jejum</label>
  <h3>Treino</h3>
  <button class="botao-sec" data-acao="trocar-biotipo">Trocar biotipo / treino pré-montado</button>
  <button class="botao-sec" data-acao="limpar-dia">Limpar o treino de ${DIAS.find((d) => d.k === diaAtual).nome}</button>
  <h3>Backup</h3>
  <button class="botao-sec" data-acao="exportar">Salvar backup em arquivo</button>
  <label class="botao-sec">Restaurar backup de um arquivo<input type="file" accept=".json,application/json" data-mudar="importar" hidden></label>
  <p class="sub">Seus dados ficam só neste aparelho. Faça backup antes de trocar de celular ou limpar o navegador.</p>
  <button class="botao-sec perigo" data-acao="apagar-tudo">Apagar todos os dados</button>`);

MUDANCAS['cfg-descanso'] = (el) => { estado.cfg.descanso = Math.max(0, Math.round(num(el.value))); salvar(); render(); };
MUDANCAS['cfg-som'] = (el) => { estado.cfg.som = el.checked; salvar(); };

ACOES['trocar-biotipo'] = () => {
  if (!confirm('Escolher um treino pré-montado substitui os exercícios de todos os dias. Continuar?')) return;
  fecharFolha();
  estado.iniciado = false;
  mostrar();
};

ACOES['limpar-dia'] = () => {
  if (!confirm('Limpar os exercícios deste dia?')) return;
  estado.plano[diaAtual] = [];
  salvar();
  fecharFolha();
  render();
};

ACOES['apagar-tudo'] = async () => {
  if (!confirm('Apagar TODOS os dados do app (treinos, jejuns, dieta, medidas e fotos)? Isso não pode ser desfeito.')) return;
  try { localStorage.removeItem(CHAVE); } catch (e) {}
  try { await limparFotos(); } catch (e) {}
  estado = carregar();
  fecharFolha();
  mostrar();
};

ACOES['exportar'] = async () => {
  let fotos = [];
  try { fotos = await listarFotos(); } catch (e) {}
  const blob = new Blob([JSON.stringify({ app: 'treino-iolico', versao: 1, estado, fotos })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pandafit-backup-${dataISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  aviso('Backup salvo na pasta de downloads');
};

MUDANCAS['importar'] = async (el) => {
  const arquivo = el.files[0];
  if (!arquivo) return;
  try {
    const dados = JSON.parse(await arquivo.text());
    if (dados.app !== 'treino-iolico' || !dados.estado || !dados.estado.plano) throw new Error('formato');
    if (!confirm('Restaurar este backup substitui os dados atuais do app. Continuar?')) return;
    localStorage.setItem(CHAVE, JSON.stringify(dados.estado));
    estado = carregar();
    await limparFotos();
    for (const f of dados.fotos || []) await salvarFoto(f);
    fecharFolha();
    mostrar();
    aviso('Backup restaurado');
  } catch (e) {
    aviso('Arquivo de backup inválido');
  }
};

ACOES['fechar-folha'] = fecharFolha;

/* --- Eventos --- */
function mostrarDica(el, ev) {
  const caixa = $('dica-grafico');
  if (!el) { caixa.hidden = true; return; }
  caixa.textContent = el.dataset.dica;
  caixa.hidden = false;
  const x = Math.min(window.innerWidth - caixa.offsetWidth - 8, Math.max(8, ev.clientX - caixa.offsetWidth / 2));
  caixa.style.left = x + 'px';
  caixa.style.top = Math.max(8, ev.clientY - caixa.offsetHeight - 14) + 'px';
}

document.addEventListener('click', (ev) => {
  mostrarDica(ev.target.closest('[data-dica]'), ev);
  if (ev.target.id === 'folha') return fecharFolha();
  const alvo = ev.target.closest('[data-acao]');
  if (alvo && ACOES[alvo.dataset.acao]) ACOES[alvo.dataset.acao](alvo, ev);
});

document.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'mouse') mostrarDica(ev.target.closest('[data-dica]'), ev);
});

document.addEventListener('change', (ev) => {
  const fn = MUDANCAS[ev.target.dataset.mudar];
  if (fn) fn(ev.target);
});

document.addEventListener('input', (ev) => {
  const fn = DIGITAR[ev.target.dataset.digitar];
  if (fn) fn(ev.target);
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  FORMS[form.dataset.form](Object.fromEntries(new FormData(form)), form);
});

setInterval(() => { tickTreino(); tickJejum(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('principal').hidden) render(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

mostrar();
