// Acesso pelo celular: abre um túnel Cloudflare gratuito até este PC e publica o endereço
// atual num gist secreto. O app (instalado a partir do GitHub Pages, endereço fixo) lê o gist
// e se conecta sozinho, mesmo com o endereço do túnel mudando a cada reinício.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

// ---------- localizar binários (mesma busca do conversor-midia) ----------
function acharBin(nome) {
  const exe = process.platform === 'win32' ? nome + '.exe' : nome;
  const candidatos = [
    path.join(__dirname, 'bin', exe),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', exe),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'cloudflared', exe),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'cloudflared', exe),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'GitHub CLI', exe),
  ].filter(Boolean);
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  try {
    return execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [nome], { encoding: 'utf8' }).split(/\r?\n/)[0].trim() || null;
  } catch { return null; }
}

// ---------- chave e gist ficam em config.json (fora do git) ----------
function lerConfig(arq) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return {}; } }
function gravarCelular(arq, campos) {
  const c = lerConfig(arq);
  c.celular = { ...(c.celular || {}), ...campos };
  fs.writeFileSync(arq, JSON.stringify(c, null, 2));
}
function garantirChave(arq) {
  const c = lerConfig(arq);
  if (c.celular?.chave) return c.celular.chave;
  const chave = crypto.randomBytes(18).toString('base64url');
  gravarCelular(arq, { chave });
  return chave;
}

// compara a chave enviada pelo app sem vazar tempo de comparação
function chaveConfere(enviada, chave) {
  const a = Buffer.from(String(enviada || '')), b = Buffer.from(chave);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// cria (na 1ª vez) ou atualiza o gist secreto com o endereço atual do túnel
function publicarEndereco(arq, url) {
  const gh = acharBin('gh');
  if (!gh) return Promise.reject(new Error('GitHub CLI (gh) não encontrado: instale com winget install GitHub.cli e rode gh auth login'));
  const atual = lerConfig(arq).celular?.gist;
  const corpo = JSON.stringify({
    description: 'Monitor de Preços: endereço atual do servidor (atualizado automaticamente)',
    ...(atual ? {} : { public: false }),
    files: { 'monitor-precos.json': { content: JSON.stringify({ url, atualizado: new Date().toISOString() }) } },
  });
  return new Promise((resolve, reject) => {
    const p = spawn(gh, ['api', atual ? `gists/${atual}` : 'gists', '-X', atual ? 'PATCH' : 'POST', '--input', '-'], { windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (err += d));
    p.on('error', reject);
    p.on('close', cod => {
      if (cod !== 0) {
        // gist apagado por fora: cria outro
        if (atual && /404|Not Found/i.test(err + out)) { gravarCelular(arq, { gist: null }); return publicarEndereco(arq, url).then(resolve, reject); }
        return reject(new Error(`gh: ${(err || out).trim().slice(0, 200)}`));
      }
      try {
        const id = JSON.parse(out).id;
        if (!atual) gravarCelular(arq, { gist: id });
        resolve(id);
      } catch (e) { reject(e); }
    });
    p.stdin.end(corpo);
  });
}

// abre o túnel e chama aoAbrir(url) quando o endereço sair; reinicia se cair
function abrirTunel(porta, aoAbrir, aoErro) {
  const bin = acharBin('cloudflared');
  if (!bin) { aoErro(new Error('cloudflared não encontrado: instale com winget install Cloudflare.cloudflared')); return null; }
  let encerrando = false, proc;
  const iniciar = () => {
    proc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${porta}`], { windowsHide: true });
    let achou = false;
    const ler = d => {
      const m = d.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !achou) { achou = true; aoAbrir(m[0]); }
    };
    proc.stdout.on('data', ler);
    proc.stderr.on('data', ler);
    proc.on('error', aoErro);
    proc.on('close', cod => {
      if (encerrando) return;
      aoErro(new Error(`túnel encerrado (código ${cod}); abrindo de novo em 30 s`));
      setTimeout(iniciar, 30000);
    });
  };
  iniciar();
  const fechar = () => { encerrando = true; try { proc?.kill(); } catch {} };
  process.on('exit', fechar);
  process.on('SIGINT', () => process.exit());
  return fechar;
}

module.exports = { garantirChave, chaveConfere, publicarEndereco, abrirTunel, lerConfig };
