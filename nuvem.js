// PandaFit - conta (e-mail e senha) e sincronizacao dos dados com a nuvem (Firebase)
const SDK_FIREBASE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
const CHAVE_UID = 'pandafit_uid';
const CHAVE_PENDENTE = 'pandafit_pendente';
const CHAVE_FOTOS_OK = 'pandafit_fotos_ok';
const SENHA_MINIMA = 8;

// Cada parte vira um documento (limite de 1 MB por documento no Firestore); o resto vai em "base"
const PARTES = { log: ['log'], dieta: ['dieta'], corpo: ['medidas', 'sono'] };

const nuvem = {
  ativa: typeof FIREBASE_CONFIG === 'object' && !!FIREBASE_CONFIG && !!FIREBASE_CONFIG.apiKey,
  usuario: null, auth: null, db: null,
  enviado: {}, timer: null, ultimaSinc: 0, ultimoPull: 0,
  criando: false, email: '',
};

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

const docsDados = () => nuvem.db.collection('usuarios').doc(nuvem.usuario.uid).collection('dados');
const docsFotos = () => nuvem.db.collection('usuarios').doc(nuvem.usuario.uid).collection('fotos');
const comPrazo = (promessa, ms = 15000) => Promise.race([promessa, new Promise((_, erro) => setTimeout(() => erro(new Error('tempo')), ms))]);

function carregarScript(src) {
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = erro;
    document.head.appendChild(s);
  });
}

/* --- Telas de entrada --- */
function telaCarregando(texto) {
  $('principal').hidden = true;
  $('boas-vindas').hidden = false;
  $('boas-vindas').innerHTML = `<img class="panda" src="icon-512.png" alt=""><h1>PandaFit</h1><p class="sub centro">${texto}</p>`;
}

function telaLogin(mensagem = '', erro = true) {
  const criar = nuvem.criando;
  $('principal').hidden = true;
  $('boas-vindas').hidden = false;
  $('boas-vindas').innerHTML = `
    <img class="panda" src="icon-512.png" alt="">
    <h1>PandaFit</h1>
    <p class="sub centro">${criar ? 'Crie sua conta para guardar seus dados com segurança.' : 'Entre na sua conta para acessar seus dados em qualquer aparelho.'}</p>
    ${mensagem ? `<p class="${erro ? 'msg-erro' : 'msg-ok'}">${esc(mensagem)}</p>` : ''}
    <form class="form" data-form="login">
      <label class="campo">E-mail<input id="login-email" name="email" type="email" autocomplete="email" value="${esc(nuvem.email)}" required></label>
      <label class="campo">Senha${criar ? ` (mínimo ${SENHA_MINIMA} caracteres)` : ''}<input name="senha" type="password" minlength="${criar ? SENHA_MINIMA : 6}" autocomplete="${criar ? 'new-password' : 'current-password'}" required></label>
      ${criar ? `<label class="campo">Repita a senha<input name="senha2" type="password" minlength="${SENHA_MINIMA}" autocomplete="new-password" required></label>` : ''}
      <button type="submit" class="botao-principal">${criar ? 'Criar conta' : 'Entrar'}</button>
    </form>
    <button class="botao-sec centro" data-acao="login-google">Entrar com Google</button>
    <button class="botao-sec centro" data-acao="login-modo">${criar ? 'Já tenho conta' : 'Criar conta nova'}</button>
    ${criar ? '' : '<button class="botao-sec centro" data-acao="login-esqueci">Esqueci minha senha</button>'}`;
}

function erroDeLogin(e) {
  const msgs = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Toque em "Já tenho conta".',
    'auth/weak-password': 'Senha fraca. Use pelo menos 8 caracteres.',
    'auth/requires-recent-login': 'Por segurança, saia da conta, entre de novo e repita a operação.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/operation-not-allowed': 'Esse tipo de login não está ativado no Firebase.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).',
  };
  return msgs[e && e.code] || 'Não foi possível entrar. Tente de novo.';
}

FORMS['login'] = async (dados, form) => {
  nuvem.email = dados.email.trim();
  if (nuvem.criando && dados.senha.length < SENHA_MINIMA) return telaLogin(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  if (nuvem.criando && dados.senha !== dados.senha2) return telaLogin('As senhas não são iguais.');
  form.querySelector('[type="submit"]').disabled = true;
  try {
    if (nuvem.criando) await nuvem.auth.createUserWithEmailAndPassword(nuvem.email, dados.senha);
    else await nuvem.auth.signInWithEmailAndPassword(nuvem.email, dados.senha);
  } catch (e) {
    telaLogin(erroDeLogin(e));
  }
};

ACOES['login-google'] = async () => {
  try {
    await nuvem.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) telaLogin(erroDeLogin(e));
  }
};

ACOES['login-modo'] = () => {
  if ($('login-email')) nuvem.email = $('login-email').value.trim();
  nuvem.criando = !nuvem.criando;
  telaLogin();
};

ACOES['login-esqueci'] = async () => {
  nuvem.email = $('login-email').value.trim();
  if (!nuvem.email) return telaLogin('Digite seu e-mail e toque de novo em "Esqueci minha senha".');
  try {
    await nuvem.auth.sendPasswordResetEmail(nuvem.email);
    telaLogin('Enviamos um e-mail com o link para criar uma senha nova.', false);
  } catch (e) {
    telaLogin(erroDeLogin(e));
  }
};

/* --- Inicio e troca de usuario --- */
async function nuvemIniciar() {
  telaCarregando('Conectando...');
  try {
    for (const m of ['app', 'auth', 'firestore']) await carregarScript(`${SDK_FIREBASE}${m}-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG);
    nuvem.auth = firebase.auth();
    nuvem.db = firebase.firestore();
  } catch (e) {
    // Sem internet: quem ja entrou neste aparelho segue usando, o envio fica pendente
    if (lsGet(CHAVE_UID)) return mostrar();
    $('boas-vindas').innerHTML += '<p class="msg-erro">Sem conexão. Conecte-se à internet e abra o app de novo para entrar.</p>';
    return;
  }
  nuvem.auth.onAuthStateChanged(aoMudarUsuario);
}

async function aoMudarUsuario(usuario) {
  nuvem.usuario = usuario;
  if (!usuario) return telaLogin();
  if (lsGet(CHAVE_UID) === usuario.uid) {
    mostrar();
    nuvemSincronizar();
    return;
  }
  telaCarregando('Carregando seus dados...');
  try {
    const remoto = await comPrazo(baixarDados());
    const temLocal = estado.iniciado || !!estado.perfil;
    const usarConta = remoto && (!temLocal || confirm('Esta conta já tem dados salvos.\n\nOK = usar os dados da conta.\nCancelar = substituir pelos dados deste aparelho.'));
    lsSet(CHAVE_UID, usuario.uid);
    if (usarConta) aplicarDados(remoto);
    else await enviarDados();
    await sincronizarFotos();
    mostrar();
  } catch (e) {
    lsDel(CHAVE_UID);
    await nuvem.auth.signOut();
    telaLogin('Não foi possível carregar seus dados. Verifique a internet e tente de novo.');
  }
}

/* --- Dados --- */
function dividirEstado() {
  const resto = { ...estado }, partes = {};
  for (const [nome, chaves] of Object.entries(PARTES)) {
    const pedaco = {};
    for (const c of chaves) { pedaco[c] = resto[c]; delete resto[c]; }
    partes[nome] = JSON.stringify(pedaco);
  }
  partes.base = JSON.stringify(resto);
  return partes;
}

async function baixarDados() {
  const snap = await docsDados().get();
  const partes = {};
  snap.forEach((d) => { partes[d.id] = d.data().json; });
  return partes.base ? partes : null;
}

function aplicarDados(partes) {
  const obj = {};
  for (const json of Object.values(partes)) Object.assign(obj, JSON.parse(json));
  lsSet(CHAVE, JSON.stringify(obj));
  estado = carregar();
  nuvem.enviado = { ...partes };
  lsDel(CHAVE_PENDENTE);
  nuvem.ultimaSinc = Date.now();
}

async function enviarDados() {
  if (!nuvem.usuario) return;
  if (!estado._mod) estado._mod = Date.now();
  const mod = estado._mod;
  const partes = dividirEstado();
  const lote = nuvem.db.batch();
  let mudou = 0;
  for (const [nome, json] of Object.entries(partes)) {
    if (nuvem.enviado[nome] === json) continue;
    lote.set(docsDados().doc(nome), { json, mod: estado._mod });
    mudou++;
  }
  if (mudou) await comPrazo(lote.commit());
  nuvem.enviado = partes;
  if (estado._mod === mod) lsDel(CHAVE_PENDENTE);
  nuvem.ultimaSinc = Date.now();
}

// Chamado por salvar(): junta as mudancas e envia depois de 2,5 s
function nuvemAgendar() {
  if (!nuvem.ativa || !lsGet(CHAVE_UID)) return;
  lsSet(CHAVE_PENDENTE, '1');
  if (!nuvem.usuario) return;
  clearTimeout(nuvem.timer);
  nuvem.timer = setTimeout(() => enviarDados().catch(() => {}), 2500);
}

// Ao minimizar ou fechar o app, envia na hora o que estiver aguardando
function nuvemEnviarJa() {
  if (!nuvem.usuario || !lsGet(CHAVE_PENDENTE)) return;
  clearTimeout(nuvem.timer);
  enviarDados().catch(() => {});
}

// Mudanca local pendente vence; senao, vale a versao mais nova (este aparelho x conta)
async function nuvemSincronizar(forcar = false) {
  if (!nuvem.usuario || !navigator.onLine) return false;
  try {
    if (lsGet(CHAVE_PENDENTE)) await enviarDados();
    else if (forcar || Date.now() - nuvem.ultimoPull > 60000) {
      nuvem.ultimoPull = Date.now();
      const remoto = await comPrazo(baixarDados());
      if (!remoto) await enviarDados();
      else if ((JSON.parse(remoto.base)._mod || 0) > (estado._mod || 0)) {
        aplicarDados(remoto);
        if (!$('principal').hidden && $('folha').hidden) render();
      } else {
        nuvem.enviado = remoto;
        nuvem.ultimaSinc = Date.now();
      }
    }
    await sincronizarFotos();
    return true;
  } catch (e) {
    return false;
  }
}

/* --- Fotos: estado.fotosIds e a lista oficial; cada foto e um documento --- */
async function sincronizarFotos() {
  if (!nuvem.usuario) return;
  const locais = await listarFotos();
  if (!estado.fotosIds) {
    estado.fotosIds = locais.map((f) => f.id);
    salvar();
  }
  const indice = new Set(estado.fotosIds);
  const naNuvem = new Set(JSON.parse(lsGet(CHAVE_FOTOS_OK) || '[]'));
  const idsLocais = new Set(locais.map((f) => f.id));

  for (const id of indice) {
    if (idsLocais.has(id)) continue;
    const d = await comPrazo(docsFotos().doc(String(id)).get());
    if (d.exists) { await guardarFotoLocal({ id, ...d.data() }); naNuvem.add(id); }
  }
  for (const f of locais) {
    if (!indice.has(f.id)) await removerFotoLocal(f.id);
    else if (!naNuvem.has(f.id)) {
      await comPrazo(docsFotos().doc(String(f.id)).set({ d: f.d, img: f.img }));
      naNuvem.add(f.id);
    }
  }
  lsSet(CHAVE_FOTOS_OK, JSON.stringify([...naNuvem].filter((id) => indice.has(id))));
  if (abaAtual === 'corpo' && subCorpo === 'fotos' && !$('principal').hidden) carregarFotos();
}

function nuvemFotoNova(id) {
  estado.fotosIds = [...new Set([...(estado.fotosIds || []), id])];
  salvar();
  sincronizarFotos().catch(() => {});
}

function nuvemFotoApagada(id) {
  estado.fotosIds = (estado.fotosIds || []).filter((x) => x !== id);
  salvar();
  if (nuvem.usuario) docsFotos().doc(String(id)).delete().catch(() => {});
}

/* --- Conta nas Opcoes --- */
function htmlConta() {
  if (!nuvem.ativa) return '';
  const email = nuvem.usuario ? nuvem.usuario.email : 'sem conexão';
  const situacao = lsGet(CHAVE_PENDENTE) ? 'Há alterações aguardando envio' : nuvem.ultimaSinc ? `Salvo na conta às ${horaMin(nuvem.ultimaSinc)}` : 'Dados salvos na conta';
  return `<div class="cartao-bloco"><strong>${esc(email)}</strong><span class="sub">${situacao}</span></div>
    <button class="botao-sec" data-acao="sincronizar">Sincronizar agora</button>
    <button class="botao-sec" data-acao="sair">Sair da conta</button>
    <button class="botao-sec perigo" data-acao="excluir-conta">Excluir minha conta e meus dados</button>`;
}

ACOES['sincronizar'] = async () => {
  aviso('Sincronizando...');
  const ok = await nuvemSincronizar(true);
  aviso(ok && !lsGet(CHAVE_PENDENTE) ? 'Tudo salvo na sua conta' : 'Sem conexão. Tento de novo depois.');
  if (!$('folha').hidden) ACOES['abrir-config']();
};

ACOES['sair'] = async () => {
  if (!nuvem.usuario) return aviso('Sem conexão. Tente sair quando tiver internet.');
  let enviou = true;
  try { clearTimeout(nuvem.timer); await enviarDados(); await sincronizarFotos(); } catch (e) { enviou = false; }
  if (!enviou && !confirm('Sem internet: as últimas alterações ainda não foram salvas na conta. Sair mesmo assim e perdê-las?')) return;
  fecharFolha();
  await limparAparelho();
  await nuvem.auth.signOut();
};

function limparAparelho() {
  clearTimeout(nuvem.timer);
  [CHAVE, CHAVE_UID, CHAVE_PENDENTE, CHAVE_FOTOS_OK].forEach(lsDel);
  estado = carregar();
  nuvem.enviado = {};
  nuvem.criando = false;
  return limparFotos().catch(() => {});
}

// Pede a senha (ou o Google) de novo antes de apagar: confirma que e o dono da conta
ACOES['excluir-conta'] = async () => {
  const u = nuvem.usuario;
  if (!u || !navigator.onLine) return aviso('Sem conexão. Para excluir a conta é preciso internet.');
  if (!confirm('Excluir sua conta e TODOS os seus dados (treinos, jejuns, dieta, medidas e fotos)?\n\nIsso não pode ser desfeito.')) return;
  try {
    if (u.providerData.some((p) => p.providerId === 'password')) {
      const senha = prompt('Digite sua senha para confirmar a exclusão:');
      if (!senha) return;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, senha));
    } else {
      await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    }
  } catch (e) {
    return aviso(erroDeLogin(e));
  }
  try {
    clearTimeout(nuvem.timer);
    const fotos = await comPrazo(docsFotos().get());
    const ids = [];
    fotos.forEach((d) => ids.push(d.id));
    for (const id of ids) await docsFotos().doc(id).delete();
    for (const nome of ['base', ...Object.keys(PARTES)]) await docsDados().doc(nome).delete();
    fecharFolha();
    await limparAparelho();
    await u.delete();
    aviso('Conta e dados excluídos');
  } catch (e) {
    aviso('Não foi possível excluir agora. Tente de novo.');
  }
};

window.addEventListener('online', () => nuvemSincronizar());
