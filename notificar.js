// Envia alertas: terminal, notificação do Windows, Telegram, Discord e ntfy (push no celular).
const { spawn } = require('child_process');

const ROTULO = { bug: 'BUG DE PREÇO?', alvo: 'Preço alvo', desconto: 'Desconto', queda: 'Queda de preço', minimo: 'Menor preço', feed: 'Promoção' };
const COR = { 3: '\x1b[41;97m', 2: '\x1b[43;30m', 1: '\x1b[42;30m' };

const dinheiro = (v, moeda = 'BRL') => {
  try { return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda || 'BRL' }); } catch { return v.toFixed(2); }
};

function texto(a) {
  const preco = a.preco != null ? dinheiro(a.preco, a.moeda) : '';
  return { titulo: `${ROTULO[a.tipo] || a.tipo}: ${preco}`.trim(), corpo: `${a.nome || ''}\n${a.motivo}`.trim() };
}

const xml = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

function windows(a) {
  if (process.platform !== 'win32') return;
  const t = texto(a);
  const titulo = a.titulo || t.titulo, corpo = t.corpo;
  const toast = `<toast activationType="protocol" launch="${xml(a.url || '')}"><visual><binding template="ToastGeneric">`
    + `<text>${xml(titulo)}</text><text>${xml(corpo.slice(0, 250))}</text></binding></visual>${a.nivel >= 3 ? '<audio src="ms-winsoundevent:Notification.Looping.Alarm" />' : ''}</toast>`;
  const ps = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument; $x.LoadXml($env:TOAST_XML)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
  spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: { ...process.env, TOAST_XML: toast }, windowsHide: true, stdio: 'ignore' })
    .on('error', () => {});
}

async function post(url, opcoes) {
  try {
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000), ...opcoes });
    if (!r.ok) console.log(`  aviso: notificação falhou (${new URL(url).host}: HTTP ${r.status})`);
  } catch (e) { console.log(`  aviso: notificação falhou (${e.message})`); }
}

async function notificar(a, cfg) {
  const { titulo, corpo } = texto(a);
  console.log(`${COR[a.nivel] || ''} ${titulo} \x1b[0m ${corpo.replace(/\n/g, ' — ')}\n   ${a.url || ''}`);
  const n = cfg.notificar || {};
  if (a.nivel < (n.nivelMinimo || 1)) return;
  if (n.windows) windows(a);
  const msg = `${titulo}\n${corpo}\n${a.url || ''}`;
  const tarefas = [];
  if (n.telegram?.token && n.telegram?.chatId)
    tarefas.push(post(`https://api.telegram.org/bot${n.telegram.token}/sendMessage`, {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: n.telegram.chatId, text: msg }),
    }));
  if (n.discordWebhook)
    tarefas.push(post(n.discordWebhook, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg.slice(0, 1900) }) }));
  if (n.ntfyTopico)
    tarefas.push(post(`https://ntfy.sh/${encodeURIComponent(n.ntfyTopico)}`, {
      headers: { Priority: a.nivel >= 3 ? 'urgent' : 'default', Tags: a.tipo === 'bug' ? 'rotating_light' : 'moneybag', ...(a.url ? { Click: a.url } : {}) },
      body: msg,
    }));
  await Promise.all(tarefas);
}

// mensagem longa (resumo diário): vai inteira para Telegram/Discord/ntfy e como aviso curto no Windows
async function enviarTexto({ titulo, corpo, url }, cfg) {
  console.log(`\n${titulo}\n${corpo}\n`);
  const n = cfg.notificar || {};
  if (n.windows) windows({ tipo: 'resumo', nivel: 1, nome: corpo.split('\n').find(Boolean) || '', motivo: 'abra o site para ver tudo', url, preco: null, titulo });
  const msg = `${titulo}\n\n${corpo}${url ? `\n\n${url}` : ''}`;
  const tarefas = [];
  if (n.telegram?.token && n.telegram?.chatId)
    tarefas.push(post(`https://api.telegram.org/bot${n.telegram.token}/sendMessage`, {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: n.telegram.chatId, text: msg.slice(0, 4000), disable_web_page_preview: true }),
    }));
  if (n.discordWebhook)
    for (let i = 0; i < msg.length && i < 6000; i += 1900)
      tarefas.push(post(n.discordWebhook, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg.slice(i, i + 1900) }) }));
  if (n.ntfyTopico)
    tarefas.push(post(`https://ntfy.sh/${encodeURIComponent(n.ntfyTopico)}`, { headers: { Tags: 'newspaper', ...(url ? { Click: url } : {}) }, body: msg.slice(0, 4000) }));
  await Promise.all(tarefas);
}

module.exports = { notificar, enviarTexto, dinheiro };
