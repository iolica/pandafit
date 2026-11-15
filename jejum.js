// PandaFit - aba Jejum intermitente
const paraCampoData = (ts) => { const d = new Date(ts); return `${dataISO(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}`; };
const horasDeJejum = (j) => (j.fim - j.ini) / 3600000;

function faseAtual(horas) {
  let fase = FASES_JEJUM[0];
  for (const f of FASES_JEJUM) if (horas >= f.de) fase = f;
  return fase;
}

function sequenciaJejum() {
  const dias = new Set(estado.jejum.historico.filter((j) => horasDeJejum(j) >= j.meta).map((j) => dataISO(new Date(j.fim))));
  let seq = 0, iso = dataISO();
  if (!dias.has(iso)) iso = somaDias(iso, -1);
  while (dias.has(iso)) { seq++; iso = somaDias(iso, -1); }
  return seq;
}

function textosDoAnel() {
  const j = estado.jejum;
  const passou = Date.now() - j.inicio;
  const falta = j.horas * 3600000 - passou;
  return {
    fracao: passou / (j.horas * 3600000),
    centro: duracaoTexto(passou),
    sub: falta > 0 ? `faltam ${duracaoTexto(falta)}` : `meta batida! +${duracaoTexto(-falta)}`,
  };
}

TELAS.jejum = function renderJejum() {
  const j = estado.jejum;
  const hist = j.historico;
  let topo;

  if (j.inicio) {
    const t = textosDoAnel();
    const horas = (Date.now() - j.inicio) / 3600000;
    const fase = faseAtual(horas);
    topo = `
      ${anel(t.fracao, t.centro, t.sub)}
      <div class="cartoes-num">
        <div><strong>${j.protocolo}</strong><span>protocolo</span></div>
        <div><strong>${horaMin(j.inicio)}</strong><span>início</span></div>
        <div><strong>${horaMin(j.inicio + j.horas * 3600000)}</strong><span>término</span></div>
      </div>
      <div class="cartao-bloco"><strong id="fase-nome">Fase: ${fase.nome}</strong><span class="sub" id="fase-texto">${fase.texto}</span></div>
      <label class="campo">Comecei em outro horário
        <input type="datetime-local" value="${paraCampoData(j.inicio)}" max="${paraCampoData(Date.now())}" data-mudar="jejum-inicio"></label>
      <button class="botao-principal" data-acao="jejum-encerrar">Encerrar jejum</button>
      <button class="botao-sec centro" data-acao="jejum-cancelar">Cancelar sem gravar</button>`;
  } else {
    const chips = PROTOCOLOS.map((p) => `<button class="chip${p.k === j.protocolo ? ' ativa' : ''}" data-acao="jejum-protocolo" data-k="${p.k}">${p.k}</button>`).join('')
      + `<button class="chip${j.protocolo === 'Livre' ? ' ativa' : ''}" data-acao="jejum-protocolo" data-k="Livre">Personalizado</button>`;
    const prot = PROTOCOLOS.find((p) => p.k === j.protocolo);
    topo = `
      ${anel(0, j.horas + 'h', 'meta de jejum')}
      <div class="chips quebra">${chips}</div>
      ${prot ? `<p class="sub centro">${prot.texto}</p>` : `<label class="campo">Horas de jejum
        <input type="number" inputmode="numeric" min="1" max="72" value="${j.horas}" data-mudar="jejum-horas"></label>`}
      <button class="botao-principal" data-acao="jejum-iniciar">Iniciar jejum agora</button>
      <p class="sub centro">Se começar agora, termina às ${horaMin(Date.now() + j.horas * 3600000)}.</p>`;
  }

  const completos = hist.filter((h) => horasDeJejum(h) >= h.meta).length;
  const media = hist.length ? hist.reduce((s, h) => s + horasDeJejum(h), 0) / hist.length : 0;
  const maior = hist.length ? Math.max(...hist.map(horasDeJejum)) : 0;
  const ultimos = hist.slice(-7).map((h) => ({ rotulo: dataBR(dataISO(new Date(h.fim))), v: Math.round(horasDeJejum(h) * 10) / 10 }));

  $('tela-jejum').innerHTML = `
    ${topo}
    <h3>Seus números</h3>
    <div class="cartoes-num">
      <div><strong>${completos}</strong><span>metas batidas</span></div>
      <div><strong>${sequenciaJejum()}</strong><span>dias seguidos</span></div>
      <div><strong>${horasTexto(media)}</strong><span>média</span></div>
      <div><strong>${horasTexto(maior)}</strong><span>maior jejum</span></div>
    </div>
    ${ultimos.length ? `<h3>Últimos jejuns (horas)</h3>${graficoBarras(ultimos, 'h', j.horas)}<p class="sub centro">Linha tracejada: meta atual de ${j.horas} h</p>` : ''}
    <h3>Histórico</h3>
    <ul>${hist.length ? hist.map((h, i) => ({ h, i })).reverse().slice(0, 30).map(({ h, i }) => `<li class="linha">
        <span><strong>${horasTexto(horasDeJejum(h))}</strong> ${horasDeJejum(h) >= h.meta ? '✅' : ''}<small>${dataBR(dataISO(new Date(h.ini)))} ${horaMin(h.ini)} → ${dataBR(dataISO(new Date(h.fim)))} ${horaMin(h.fim)} · meta ${h.meta} h</small></span>
        <button class="remover" data-acao="jejum-apagar" data-i="${i}" aria-label="Apagar">✕</button></li>`).join('')
      : '<li class="vazio">Nenhum jejum registrado ainda.</li>'}</ul>
    <h3>Fases do jejum</h3>
    <ul>${FASES_JEJUM.map((f) => `<li class="linha"><span><strong>${f.de}h+ · ${f.nome}</strong><small>${f.texto}</small></span></li>`).join('')}</ul>
    <p class="aviso">As fases são aproximadas. Jejum não é indicado para gestantes, lactantes, menores de 18 anos, pessoas com diabetes ou histórico de transtorno alimentar sem orientação médica.</p>`;
};

function tickJejum() {
  const j = estado.jejum;
  if (!j.inicio) return;
  if (!j.avisado && Date.now() - j.inicio >= j.horas * 3600000) {
    j.avisado = true;
    salvar();
    apitar();
    aviso(`🎉 Meta de ${j.horas} h de jejum batida!`);
    notificar('Jejum concluído', `Você completou ${j.horas} h de jejum.`);
  }
  if (!$('anel-valor') || abaAtual !== 'jejum') return;
  const t = textosDoAnel();
  const c = 2 * Math.PI * 86;
  $('anel-valor').setAttribute('stroke-dashoffset', c * (1 - Math.min(1, t.fracao)));
  $('anel-centro').textContent = t.centro;
  $('anel-sub').textContent = t.sub;
  const fase = faseAtual((Date.now() - j.inicio) / 3600000);
  $('fase-nome').textContent = 'Fase: ' + fase.nome;
  $('fase-texto').textContent = fase.texto;
}

// So funciona com o app aberto ou em segundo plano recente
function notificar(titulo, texto) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.serviceWorker && navigator.serviceWorker.ready
    .then((reg) => reg.showNotification(titulo, { body: texto, icon: 'icon-192.png' }))
    .catch(() => {});
}

ACOES['jejum-protocolo'] = (el) => {
  const p = PROTOCOLOS.find((x) => x.k === el.dataset.k);
  estado.jejum.protocolo = el.dataset.k;
  if (p) estado.jejum.horas = p.horas;
  salvar();
  render();
};

ACOES['jejum-iniciar'] = () => {
  estado.jejum.inicio = Date.now();
  estado.jejum.avisado = false;
  salvar();
  render();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
};

ACOES['jejum-encerrar'] = () => {
  const j = estado.jejum;
  const horas = (Date.now() - j.inicio) / 3600000;
  if (horas < j.horas && !confirm(`Você ainda não bateu a meta de ${j.horas} h. Encerrar mesmo assim?`)) return;
  j.historico.push({ ini: j.inicio, fim: Date.now(), meta: j.horas });
  j.inicio = null;
  salvar();
  render();
  aviso(`Jejum de ${horasTexto(horas)} gravado`);
};

ACOES['jejum-cancelar'] = () => {
  if (!confirm('Cancelar este jejum sem gravar no histórico?')) return;
  estado.jejum.inicio = null;
  salvar();
  render();
};

ACOES['jejum-apagar'] = (el) => {
  if (!confirm('Apagar este jejum do histórico?')) return;
  estado.jejum.historico.splice(Number(el.dataset.i), 1);
  salvar();
  render();
};

MUDANCAS['jejum-inicio'] = (el) => {
  const ts = new Date(el.value).getTime();
  if (!ts || ts > Date.now()) { aviso('Horário inválido'); render(); return; }
  estado.jejum.inicio = ts;
  estado.jejum.avisado = Date.now() - ts >= estado.jejum.horas * 3600000;
  salvar();
  render();
};

MUDANCAS['jejum-horas'] = (el) => {
  estado.jejum.horas = Math.min(72, Math.max(1, Math.round(num(el.value)) || 16));
  salvar();
  render();
};
