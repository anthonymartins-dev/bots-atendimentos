// Teste de ponta a ponta: servidor falso das redes + API real + pedidos assinados.
// Precisa da base com os dados de demonstração (e acrescenta mensagens de teste).
// Uso: npm run test:e2e
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const SERVER_DIR = require('node:path').resolve(__dirname, '..');
const API = 'http://localhost:3006';
const MOCK = 4000;
const ZAP = 'segredozap';
const IG = 'segredoig';

const recebidos = [];
let falhar = false;
const mock = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    const json = corpo ? JSON.parse(corpo) : null;
    recebidos.push({ url: req.url, auth: req.headers.authorization, corpo: json });
    if (falhar && /sendMessage|\/messages/.test(req.url)) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'token invalido' } }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url.includes('?fields=')) return res.end(JSON.stringify({ username: 'loja.fan' }));
    res.end(JSON.stringify({ ok: true, result: [] }));
  });
});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const confere = (nome, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ` -> ${detalhe}` : ''}`);
};

const assinar = (segredo, corpo) => `sha256=${crypto.createHmac('sha256', segredo).update(corpo).digest('hex')}`;
async function postMeta(caminho, objeto, segredo, cabecalho) {
  const corpo = JSON.stringify(objeto);
  return fetch(`${API}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cabecalho === undefined ? { 'X-Hub-Signature-256': assinar(segredo, corpo) } : cabecalho ? { 'X-Hub-Signature-256': cabecalho } : {}) },
    body: corpo,
  });
}
const get = (c) => fetch(`${API}${c}`).then((r) => r.json());
const enviosPara = (parte) => recebidos.filter((r) => /sendMessage|\/messages/.test(r.url) && r.url.includes(parte));

const zap = (id, texto, de = '351911111111', tipo = 'text') => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: de, profile: { name: 'Teste Zap' } }], messages: [{ from: de, id, type: tipo, ...(tipo === 'text' ? { text: { body: texto } } : {}) }] } }] }],
});

(async () => {
  await new Promise((r) => mock.listen(MOCK, r));
  const servidor = spawn('node', ['index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      TELEGRAM_BOT_TOKEN: 'tok-falso', TELEGRAM_MODO: 'webhook', TELEGRAM_WEBHOOK_SECRET: 'seg-tg', TELEGRAM_API_URL: `http://localhost:${MOCK}`,
      GRAPH_API_URL: `http://localhost:${MOCK}`,
      WHATSAPP_TOKEN: 'tok-zap', WHATSAPP_PHONE_NUMBER_ID: '555', WHATSAPP_VERIFY_TOKEN: 'verifica', WHATSAPP_APP_SECRET: ZAP,
      INSTAGRAM_TOKEN: 'tok-ig', INSTAGRAM_ACCOUNT_ID: '777', INSTAGRAM_VERIFY_TOKEN: 'verifica-ig', INSTAGRAM_APP_SECRET: IG,
    },
  });
  servidor.stdout.on('data', () => {});
  servidor.stderr.on('data', (d) => process.stdout.write(`[servidor erro] ${d}`));
  await dormir(1500);

  try {
    const canais = await get('/canais');
    confere('canais configurados', canais.every((c) => c.configurado), canais.map((c) => `${c.nome}:${c.modo}`).join(' '));

    // --- verificação do webhook (GET)
    let r = await fetch(`${API}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=12345`);
    confere('GET verificação certa devolve o challenge', r.status === 200 && (await r.text()) === '12345');
    r = await fetch(`${API}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1`);
    confere('GET com token errado -> 403', r.status === 403);

    // --- assinatura (POST)
    r = await postMeta('/webhooks/whatsapp', zap('wamid.A', 'Boa tarde'), ZAP, '');
    confere('POST sem assinatura -> 401', r.status === 401);
    r = await postMeta('/webhooks/whatsapp', zap('wamid.A', 'Boa tarde'), ZAP, 'sha256=00');
    confere('POST com assinatura errada -> 401', r.status === 401);
    r = await postMeta('/webhooks/whatsapp', zap('wamid.A', 'Boa tarde'), 'outro-segredo');
    confere('POST assinado com outro segredo -> 401', r.status === 401);
    confere('nada foi enviado nos pedidos rejeitados', enviosPara('555').length === 0);

    // --- WhatsApp: mensagem válida
    r = await postMeta('/webhooks/whatsapp', zap('wamid.A', 'Boa tarde'), ZAP);
    await dormir(600);
    confere('POST assinado -> 200', r.status === 200);
    let envios = enviosPara('/555/messages');
    confere('bot respondeu ao número certo com o menu', envios.length === 1 && envios[0].corpo.to === '351911111111' && /1\. Horário/.test(envios[0].corpo.text.body) && envios[0].auth === 'Bearer tok-zap');

    // --- repetida (a Meta reenvia): não responde outra vez
    await postMeta('/webhooks/whatsapp', zap('wamid.A', 'Boa tarde'), ZAP);
    await dormir(400);
    confere('mensagem repetida não gera segunda resposta', enviosPara('/555/messages').length === 1);

    // --- pergunta normal
    await postMeta('/webhooks/whatsapp', zap('wamid.B', 'Qual é o horário?'), ZAP);
    await dormir(500);
    envios = enviosPara('/555/messages');
    confere('pergunta -> resposta do horário', envios.length === 2 && /9h às 19h/.test(envios[1].corpo.text.body));

    // --- anexo passa para humano
    await postMeta('/webhooks/whatsapp', zap('wamid.C', '', '351911111111', 'image'), ZAP);
    await dormir(500);
    let conversas = await get('/conversas?q=Teste%20Zap');
    confere('fotografia -> conversa passa para humano', conversas[0]?.estado === 'humano' && conversas[0].nao_lidas === 3, `estado=${conversas[0]?.estado} nao_lidas=${conversas[0]?.nao_lidas}`);

    // --- humano: o bot cala-se
    const antes = enviosPara('/555/messages').length;
    await postMeta('/webhooks/whatsapp', zap('wamid.D', 'Obrigada'), ZAP);
    await dormir(400);
    confere('em modo humano o bot não responde', enviosPara('/555/messages').length === antes);

    // --- resposta humana pela API
    const id = conversas[0].id;
    r = await fetch(`${API}/conversas/${id}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'Pode enviar a foto, obrigado!' }) });
    let msg = await r.json();
    confere('resposta humana enviada pela rede', r.status === 201 && msg.envio === 'ok' && enviosPara('/555/messages').at(-1).corpo.text.body === 'Pode enviar a foto, obrigado!');

    // --- envio falha: fica registado
    falhar = true;
    r = await fetch(`${API}/conversas/${id}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'Esta vai falhar' }) });
    msg = await r.json();
    confere('falha de envio fica registada (sem token na mensagem)', msg.envio === 'falhou' && /500/.test(msg.erro) && !/tok-/.test(msg.erro), msg.erro);
    falhar = false;

    // --- voltar a ligar o bot
    await fetch(`${API}/conversas/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'bot' }) });
    const n = enviosPara('/555/messages').length;
    await postMeta('/webhooks/whatsapp', zap('wamid.E', 'Aceitam mbway?'), ZAP);
    await dormir(500);
    confere('depois de reativar, o bot volta a responder', enviosPara('/555/messages').length === n + 1 && /MB Way/.test(enviosPara('/555/messages').at(-1).corpo.text.body));

    // --- conversa fechada reabre
    await fetch(`${API}/conversas/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'fechada' }) });
    await postMeta('/webhooks/whatsapp', zap('wamid.F', 'Olá outra vez'), ZAP);
    await dormir(500);
    confere('mensagem numa conversa fechada reabre-a para o bot', (await get(`/conversas/${id}?marcar=false`)).estado === 'bot');

    // --- Telegram webhook
    const tg = (secret, upd) => fetch(`${API}/webhooks/telegram`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}) }, body: JSON.stringify(upd) });
    const upd = { update_id: 9001, message: { message_id: 1, chat: { id: 4242 }, from: { first_name: 'Rita', last_name: 'Sá' }, text: '/start' } };
    r = await tg('errado', upd);
    confere('Telegram com segredo errado -> 401', r.status === 401);
    r = await tg(null, upd);
    confere('Telegram sem segredo -> 401', r.status === 401);
    r = await tg('seg-tg', upd);
    await dormir(500);
    const tgEnvios = recebidos.filter((x) => x.url === '/bottok-falso/sendMessage');
    confere('Telegram: /start recebe o menu no chat certo', r.status === 200 && tgEnvios.length === 1 && tgEnvios[0].corpo.chat_id === '4242' && /1\. Horário/.test(tgEnvios[0].corpo.text));
    conversas = await get('/conversas?canal=telegram&q=Rita');
    confere('nome do contacto Telegram guardado', conversas[0]?.nome === 'Rita Sá');

    // --- Instagram
    const ig = (mid, texto, extra = {}) => ({ object: 'instagram', entry: [{ messaging: [{ sender: { id: '999000111' }, message: { mid, text: texto, ...extra } }] }] });
    await postMeta('/webhooks/instagram', ig('m1', 'Quanto custa o vaso?', { is_echo: true }), IG);
    await dormir(300);
    confere('Instagram: eco das nossas respostas é ignorado', enviosPara('/777/messages').length === 0);
    r = await postMeta('/webhooks/instagram', ig('m2', 'Quanto custa o vaso?'), ZAP);
    confere('Instagram assinado com o segredo do WhatsApp -> 401', r.status === 401);
    await postMeta('/webhooks/instagram', ig('m2', 'Quanto custa o vaso?'), IG);
    await dormir(600);
    envios = enviosPara('/777/messages');
    confere('Instagram: resposta ao destinatário certo', envios.length === 1 && envios[0].corpo.recipient.id === '999000111' && /preços dependem/.test(envios[0].corpo.message.text) && envios[0].auth === 'Bearer tok-ig');
    conversas = await get('/conversas?canal=instagram&q=loja.fan');
    confere('Instagram: nome obtido do perfil', conversas.length === 1, conversas[0]?.nome);

    // --- falhas seguidas passam para humano
    for (const [i, t] of ['asdf', 'qwer', 'zxcv'].entries()) {
      await postMeta('/webhooks/whatsapp', zap(`wamid.G${i}`, t, '351922222222'), ZAP);
      await dormir(450);
    }
    conversas = await get('/conversas?q=zxcv');
    confere('três mensagens incompreendidas -> humano', conversas[0]?.estado === 'humano', conversas[0]?.estado);

    // --- simulador
    r = await fetch(`${API}/simulador/mensagem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Visitante Teste', texto: 'onde ficam?' }) });
    const sim = await r.json();
    const conv = await get(`/conversas/${sim.conversaId}?marcar=false`);
    confere('simulador responde e guarda', conv.mensagens.length === 2 && /Rua das Flores/.test(conv.mensagens[1].texto) && conv.mensagens[1].envio === 'simulado');

    // --- respostas CRUD e testar
    r = await fetch(`${API}/respostas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: 'Promoções', palavras_chave: 'promoção, desconto, Desconto, saldos', resposta: 'Temos 10% em vasos até domingo.', no_menu: false }) });
    const nova = await r.json();
    confere('nova resposta guarda palavras sem duplicados', r.status === 201 && nova.palavras_chave.length === 3, JSON.stringify(nova.palavras_chave));
    let t = await (await fetch(`${API}/respostas/testar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'Há descontos?' }) })).json();
    confere('testar: "descontos" ainda não é "desconto" (palavra inteira)', t.tipo === 'falha');
    t = await (await fetch(`${API}/respostas/testar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: 'Têm desconto?' }) })).json();
    confere('testar: "desconto" responde', t.tipo === 'resposta' && /10%/.test(t.texto));
    r = await fetch(`${API}/respostas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '', resposta: 'x' }) });
    confere('resposta sem título -> 400', r.status === 400);
    r = await fetch(`${API}/respostas/${nova.id}`, { method: 'DELETE' });
    confere('apagar resposta -> 204', r.status === 204);

    // --- RGPD
    r = await fetch(`${API}/conversas/${sim.conversaId}`, { method: 'DELETE' });
    confere('apagar conversa remove o contacto', r.status === 204 && (await fetch(`${API}/conversas/${sim.conversaId}`)).status === 404);

    const resumo = await get('/resumo');
    confere('resumo calculado', Number.isInteger(resumo.abertas) && resumo.bot_pct >= 0, JSON.stringify(resumo));
  } catch (erro) {
    falhas++;
    console.log('ERRO no teste:', erro);
  } finally {
    servidor.kill();
    mock.close();
    console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
    process.exit(falhas === 0 ? 0 : 1);
  }
})();
