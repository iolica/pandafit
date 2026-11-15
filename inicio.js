// PandaFit - aba Inicio (resumo do dia, calendario, conquistas, recordes)
let mesCal = 0;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function conquistas() {
  const dias = Object.keys(estado.log).filter(treinouEm);
  const kcal = dias.reduce((s, d) => s + kcalDoDia(d), 0);
  const jejuns = estado.jejum.historico.filter((j) => horasDeJejum(j) >= j.meta).length;
  const seq = sequenciaTreino();
  return [
    ['🎯', 'Primeiro treino', 'Concluir um exercício', dias.length >= 1],
    ['💪', '10 treinos', 'Treinar em 10 dias', dias.length >= 10],
    ['🏅', '50 treinos', 'Treinar em 50 dias', dias.length >= 50],
    ['🔥', '3 seguidos', 'Sequência de 3 treinos', seq >= 3],
    ['⚡', '7 seguidos', 'Sequência de 7 treinos', seq >= 7],
    ['🌋', '5.000 kcal', 'Queimar 5.000 kcal treinando', kcal >= 5000],
    ['🏆', 'Recordista', 'Registrar carga em 5 exercícios', Object.keys(recordes()).length >= 5],
    ['⏳', 'Primeiro jejum', 'Bater a meta de um jejum', jejuns >= 1],
    ['🧘', '10 jejuns', 'Bater a meta de 10 jejuns', jejuns >= 10],
    ['🍽️', 'Diário em dia', 'Registrar alimentação em 7 dias', Object.keys(estado.dieta).length >= 7],
    ['📏', 'De olho na fita', 'Registrar medidas em 3 datas', estado.medidas.length >= 3],
    ['😴', 'Bom de cama', 'Registrar 7 noites de sono', estado.sono.length >= 7],
  ];
}

function htmlCalendario() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + mesCal);
  const ano = base.getFullYear(), mes = base.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const vazios = (base.getDay() + 6) % 7;
  const hoje = dataISO();
  let celulas = '<span></span>'.repeat(vazios);
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${dois(mes + 1)}-${dois(d)}`;
    const treinou = treinouEm(iso);
    celulas += `<button class="dia${treinou ? ' treinou' : ''}${iso === hoje ? ' hoje' : ''}" ${treinou ? `data-acao="ver-dia" data-d="${iso}"` : 'disabled'}>${d}</button>`;
  }
  return `<div class="nav-data">
      <button class="botao-icone" data-acao="mes" data-n="-1" aria-label="Mês anterior">‹</button>
      <strong>${MESES[mes]} ${ano}</strong>
      <button class="botao-icone" data-acao="mes" data-n="1" aria-label="Próximo mês"${mesCal >= 0 ? ' disabled' : ''}>›</button>
    </div>
    <div class="calendario">${DIAS.map((d) => `<small>${d.curto[0]}</small>`).join('')}${celulas}</div>
    <p class="sub centro">Dias destacados = dias treinados. Toque para ver o que fez.</p>`;
}

TELAS.inicio = function renderInicio() {
  const hoje = dataISO(), dia = diaDaData(hoje);
  const plano = estado.plano[dia];
  const feitosHoje = plano.filter((it) => registroDoItem(dia, it.id).ok).length;
  const semana = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i - 6));
  const inicioSemana = segundaDaSemana();
  const diasSemana = Object.keys(estado.log).filter((d) => d >= inicioSemana && treinouEm(d));
  const kcalSemana = diasSemana.reduce((s, d) => s + kcalDoDia(d), 0);
  const j = estado.jejum;
  const dieta = totaisDoDia(hoje);
  const sonoUlt = estado.sono[estado.sono.length - 1];
  const rec = Object.entries(recordes()).sort((a, b) => b[1].d.localeCompare(a[1].d)).slice(0, 5);
  const conq = conquistas();
  const nome = estado.perfil && estado.perfil.nome;

  $('tela-inicio').innerHTML = `
    <h2>${nome ? `Olá, ${esc(nome)}!` : 'Olá!'}</h2>
    <p class="sub">${DIAS.find((d) => d.k === dia).nome}, ${dataBRLonga(hoje)}</p>
    <div class="cartoes-num">
      <div><strong>${sequenciaTreino()}</strong><span>treinos seguidos</span></div>
      <div><strong>${diasSemana.length}</strong><span>treinos na semana</span></div>
      <div><strong>${fmt(kcalSemana)}</strong><span>kcal na semana</span></div>
    </div>

    <h3>Hoje</h3>
    <button class="atalho" data-acao="ir" data-aba="treino"><span class="atalho-icone">🏋️</span>
      <span><strong>Treino</strong><small>${plano.length ? `${feitosHoje}/${plano.length} exercícios · ${kcalDoDia(hoje)} kcal gastas` : 'Dia de descanso'}</small></span><span>›</span></button>
    <button class="atalho" data-acao="ir" data-aba="jejum"><span class="atalho-icone">⏳</span>
      <span><strong>Jejum</strong><small>${j.inicio ? `Em jejum há ${horasTexto((Date.now() - j.inicio) / 3600000)} · meta ${j.horas} h` : `Fora do jejum · protocolo ${j.protocolo}`}</small></span><span>›</span></button>
    <button class="atalho" data-acao="ir" data-aba="dieta"><span class="atalho-icone">🍽️</span>
      <span><strong>Dieta</strong><small>${fmt(dieta.kcal)} de ${fmt(metaKcal())} kcal</small></span><span>›</span></button>
    <button class="atalho" data-acao="ir" data-aba="corpo" data-sub="sono"><span class="atalho-icone">😴</span>
      <span><strong>Sono</strong><small>${sonoUlt ? `Última noite: ${horasTexto(sonoUlt.h)}` : 'Nenhuma noite registrada'}</small></span><span>›</span></button>

    <h3>Calorias gastas no treino (7 dias)</h3>
    ${graficoBarras(semana.map((d) => ({ rotulo: dataBR(d), v: kcalDoDia(d) })), 'kcal')}

    <h3>Calendário de treinos</h3>
    ${htmlCalendario()}

    <h3>Recordes recentes</h3>
    <ul>${rec.length ? rec.map(([id, r]) => `<li class="linha"><span>${esc((buscarExercicio(id) || { nome: id }).nome)}<small>${dataBRLonga(r.d)}</small></span><strong>${fmt(r.kg, r.kg % 1 ? 1 : 0)} kg</strong></li>`).join('')
      : '<li class="vazio">Anote a carga nos exercícios para ver seus recordes aqui.</li>'}</ul>

    <h3>Conquistas (${conq.filter((c) => c[3]).length}/${conq.length})</h3>
    <div class="conquistas">${conq.map(([icone, titulo, desc, ok]) => `<div class="conquista${ok ? ' ok' : ''}"><span>${icone}</span><strong>${titulo}</strong><small>${desc}</small></div>`).join('')}</div>`;
};

ACOES['mes'] = (el) => { mesCal = Math.min(0, mesCal + Number(el.dataset.n)); render(); };

ACOES['ver-dia'] = (el) => {
  const iso = el.dataset.d, dia = estado.log[iso];
  abrirFolha(`Treino de ${dataBRLonga(iso)}`, `
    <div class="cartoes-num">
      <div><strong>${Object.keys(dia.itens).length}</strong><span>exercícios</span></div>
      <div><strong>${kcalDoDia(iso)}</strong><span>kcal gastas</span></div>
      <div><strong>${dia.dur ? dia.dur + ' min' : '—'}</strong><span>duração</span></div>
    </div>
    <ul>${Object.values(dia.itens).map((r) => `<li class="linha"><span>${esc(r.nome)}<small>${r.sets.map((s) => `${s.kg ? fmt(s.kg, s.kg % 1 ? 1 : 0) + ' kg x ' : ''}${esc(s.reps)}`).join(' · ')}</small></span><strong>${r.kcal} kcal</strong></li>`).join('')}</ul>`);
};
