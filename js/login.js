/* ===== CLOCK ===== */
function tick() {
  const n = new Date();
  document.getElementById('stime').textContent =
    n.toLocaleTimeString('pt-BR', { hour12: false }) + ' ' +
    n.toLocaleDateString('pt-BR');
}
tick();
setInterval(tick, 1000);

/* ===== CANVAS BACKGROUND ===== */
const cv = document.getElementById('bg');
const cx = cv.getContext('2d');
let W, H, pts = [];

function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
resize();
window.addEventListener('resize', resize);

class Pt {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * W;
    this.y = init ? Math.random() * H : H + 4;
    this.vy = -(Math.random() * .4 + .1);
    this.vx = (Math.random() - .5) * .15;
    this.r  = Math.random() * 1.2 + .3;
    this.a  = Math.random() * .5 + .1;
    this.life  = 1;
    this.decay = Math.random() * .003 + .001;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.life -= this.decay;
    if (this.life <= 0 || this.y < -4) this.reset();
  }
  draw() {
    cx.globalAlpha = this.life * this.a;
    cx.fillStyle = '#00d4ff';
    cx.beginPath();
    cx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    cx.fill();
  }
}

function drawGrid() {
  cx.strokeStyle = 'rgba(0,212,255,0.04)';
  cx.lineWidth = .5;
  const gs = 60;
  for (let x = 0; x < W; x += gs) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
  for (let y = 0; y < H; y += gs) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
}

const nodes = Array.from({ length: 18 }, () => ({
  x:  Math.random() * 1920,
  y:  Math.random() * 1080,
  vx: (Math.random() - .5) * .3,
  vy: (Math.random() - .5) * .3,
  r:  Math.random() * 2 + 1,
}));

function drawNodes() {
  nodes.forEach(n => {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0 || n.x > W) n.vx *= -1;
    if (n.y < 0 || n.y > H) n.vy *= -1;
    cx.globalAlpha = .18; cx.strokeStyle = '#00d4ff'; cx.lineWidth = .7;
    cx.beginPath(); cx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); cx.stroke();
    cx.globalAlpha = .35; cx.fillStyle = '#00d4ff';
    cx.beginPath(); cx.arc(n.x, n.y, n.r, 0, Math.PI * 2); cx.fill();
  });
  cx.lineWidth = .4;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 160) {
        cx.globalAlpha = (1 - d / 160) * .08;
        cx.strokeStyle = '#00d4ff';
        cx.beginPath();
        cx.moveTo(nodes[i].x, nodes[i].y);
        cx.lineTo(nodes[j].x, nodes[j].y);
        cx.stroke();
      }
    }
  }
  cx.globalAlpha = 1;
}

const cols = Array.from({ length: 14 }, () => ({
  x:     Math.random() * 1920,
  y:     Math.random() * 1080,
  chars: '01アイウエオカキ∑∂∇ΔΩΨΠΣ'.split(''),
  speed: Math.random() * 1.5 + .5,
  a:     Math.random() * .12 + .03,
  fs:    Math.floor(Math.random() * 6 + 8),
}));

function drawStreams() {
  cols.forEach(c => {
    c.y += c.speed;
    if (c.y > H) c.y = -20;
    const ch = c.chars[Math.floor(Math.random() * c.chars.length)];
    cx.globalAlpha = c.a;
    cx.fillStyle = '#00d4ff';
    cx.font = c.fs + 'px monospace';
    cx.fillText(ch, c.x, c.y);
  });
  cx.globalAlpha = 1;
}

for (let i = 0; i < 120; i++) pts.push(new Pt());

function loop() {
  cx.fillStyle = 'rgba(0,6,8,.18)';
  cx.fillRect(0, 0, W, H);
  drawGrid();
  drawStreams();
  drawNodes();
  pts.forEach(p => { p.update(); p.draw(); });
  cx.globalAlpha = 1;
  requestAnimationFrame(loop);
}
loop();

/* ===== EYE TOGGLE ===== */
const passEl = document.getElementById('password');
document.getElementById('eyeBtn').addEventListener('click', () => {
  const show = passEl.type === 'password';
  passEl.type = show ? 'text' : 'password';
  document.getElementById('eyeIco').innerHTML = show
    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
});

/* ===== LOGIN FORM ===== */
const errEl = document.getElementById('err');

['email', 'password'].forEach(id =>
  document.getElementById(id).addEventListener('input', () =>
    errEl.classList.remove('on'))
);

function handleLogin(e) {
  e.preventDefault();
  errEl.classList.remove('on');

  const em = document.getElementById('email').value.trim();
  const pw = document.getElementById('password').value;

  if (!em || !pw) {
    document.getElementById('errTxt').textContent = 'Preencha todos os campos.';
    errEl.classList.add('on');
    return;
  }

  const btn = document.getElementById('btnLogin');
  btn.classList.add('ld');
  btn.disabled = true;

(async () => {
  const ok = await window.auth.login(em, pw);

  btn.classList.remove('ld');
  btn.disabled = false;

  if (!ok) {
    document.getElementById('errTxt').textContent =
      'E-mail ou senha inválidos.';
    errEl.classList.add('on');
    return;
  }

  await window.auth.verificarSessao();

  if (
  window.APP_EMPRESA &&
  window.APP_EMPRESA.configuracao_inicial_concluida === false
) {
  sessionStorage.setItem("crv_primeira_configuracao", "1");
  window.location.href = "configuracoes.html";
  return;
}

window.location.href = "dashboard.html";
})();
}

function entrarDemo() {
  window.location.href = 'dashboard.html';
}

const loginForm = document.getElementById("loginForm");
const cadastroForm = document.getElementById("cadastroForm");
const btnMostrarCadastro = document.getElementById("btnMostrarCadastro");
const btnVoltarLogin = document.getElementById("btnVoltarLogin");

if (btnMostrarCadastro) {
  btnMostrarCadastro.addEventListener("click", () => {
    loginForm.style.display = "none";
    cadastroForm.style.display = "block";
    document.querySelector(".subtitle").style.display = "none";
    errEl.classList.remove("on");
  });
}

if (btnVoltarLogin) {
  btnVoltarLogin.addEventListener("click", () => {
    cadastroForm.style.display = "none";
    loginForm.style.display = "block";
    document.querySelector(".subtitle").style.display = "block";
    errEl.classList.remove("on");
  });
}

if (cadastroForm) {
  cadastroForm.addEventListener("submit", async e => {
    e.preventDefault();

    const nome = document.getElementById("cadNome").value.trim();
    const email = document.getElementById("cadEmail").value.trim();
    const senha = document.getElementById("cadSenha").value;

    if (!nome || !email || !senha) {
      document.getElementById("errTxt").textContent =
        "Preencha todos os campos do cadastro.";
      errEl.classList.add("on");
      return;
    }

    const emailValido =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const dominiosBloqueados = [
  "teste.com",
  "test.com",
  "email.com",
  "exemplo.com",
  "example.com"
];

const dominioEmail = email.split("@")[1]?.toLowerCase();

if (!emailValido || dominiosBloqueados.includes(dominioEmail)) {
  document.getElementById("errTxt").textContent =
    "Digite um e-mail válido e real para confirmar sua conta.";
  errEl.classList.add("on");
  return;
}

    const btn = document.getElementById("btnCadastro");
    btn.classList.add("ld");
    btn.disabled = true;

    const resp = await window.auth.cadastrarConta(nome, email, senha);

    btn.classList.remove("ld");
    btn.disabled = false;

    document.getElementById("errTxt").textContent = resp.mensagem;

    errEl.classList.remove("ok", "warn");

    if (resp.ok) {
      errEl.classList.add("on", "ok");
    } else {
      errEl.classList.add("on");
    }

    if (resp.ok) {
      cadastroForm.reset();

      setTimeout(() => {
        cadastroForm.style.display = "none";
        loginForm.style.display = "block";
      }, 1600);
    }
  });
}

const params = new URLSearchParams(window.location.search);
const hash = new URLSearchParams(window.location.hash.replace("#", "?"));

const emailConfirmado =
  params.get("type") === "signup" ||
  hash.get("type") === "signup" ||
  window.location.hash.includes("access_token");

if (emailConfirmado) {
  document.getElementById("errTxt").textContent =
    "E-mail confirmado com sucesso. Agora faça login para acessar o sistema.";

  errEl.classList.remove("warn");
  errEl.classList.add("on", "ok");

  history.replaceState(null, "", "index.html");
}

const recuperarForm = document.getElementById("recuperarForm");
const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");
const btnVoltarLoginRecuperacao = document.getElementById("btnVoltarLoginRecuperacao");

if (btnEsqueciSenha) {
  btnEsqueciSenha.addEventListener("click", () => {
    loginForm.style.display = "none";
    cadastroForm.style.display = "none";
    recuperarForm.style.display = "block";

    document.querySelector(".subtitle").style.display = "none";

    const emailAtual = document.getElementById("email")?.value?.trim();
    const recEmail = document.getElementById("recEmail");

    if (emailAtual && recEmail) {
      recEmail.value = emailAtual;
    }

    errEl.classList.remove("on", "ok", "warn");
  });
}

if (btnVoltarLoginRecuperacao) {
  btnVoltarLoginRecuperacao.addEventListener("click", () => {
    recuperarForm.style.display = "none";
    cadastroForm.style.display = "none";
    loginForm.style.display = "block";
    errEl.classList.remove("on", "ok", "warn");
  });
}

if (recuperarForm) {
  recuperarForm.addEventListener("submit", async e => {
    e.preventDefault();

    document.querySelector(".subtitle").style.display = "block";

    const email = document.getElementById("recEmail").value.trim();
    const btn = document.getElementById("btnEnviarRecuperacao");

    if (!email) {
      document.getElementById("errTxt").textContent =
        "Informe seu e-mail para recuperar a senha.";

      errEl.classList.remove("ok", "warn");
      errEl.classList.add("on");
      return;
    }

    btn.classList.add("ld");
    btn.disabled = true;

    const resp = await window.auth.enviarRecuperacaoSenha(email);

    btn.classList.remove("ld");
    btn.disabled = false;

    document.getElementById("errTxt").innerHTML = `
      Link de redefinição enviado com sucesso.<br>
      Verifique seu e-mail para continuar.
    `;

    errEl.classList.remove("ok", "warn");

    if (resp.ok) {

      errEl.classList.remove("warn");
      errEl.classList.add("on", "ok");

    } else {

      errEl.classList.remove("ok");
      errEl.classList.add("on");

    }
  });
}
