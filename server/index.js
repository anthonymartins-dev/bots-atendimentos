require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool, types } = require('pg');
const canais = require('./canais');
const { assinaturaValida, verificarWebhook } = require('./canais/meta');
const { igualSeguro } = require('./canais/util');
const { decidir, normalizar } = require('./bot');
const { receber, responder, NEGOCIO_PADRAO } = require('./servico');

types.setTypeParser(1082, (v) => v);
types.setTypeParser(1114, (v) => v.replace(' ', 'T'));
types.setTypeParser(1700, parseFloat);

const app = express();
app.disable('x-powered-by');
app.use(cors());
// Guarda o corpo tal como chegou: a assinatura da Meta calcula-se sobre ele.
app.use(express.json({ verify: (req, _res, corpo) => { req.rawBody = corpo; } }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class Falha extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const rota = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (erro) {
    if (erro instanceof Falha) return res.status(erro.status).json({ erro: erro.message });
    if (erro.code === '22P02') return res.status(400).json({ erro: 'Valor inválido' });
    console.error(erro);
    res.status(500).json({ erro: 'Erro no servidor' });
  }
};

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Processa mensagens que já foram respondidas à rede com 200; um erro aqui só fica no registo.
async function processar(nomeCanal, mensagens) {
  for (const m of mensagens) {
    try {
      await receber(pool, canais, nomeCanal, m);
    } catch (erro) {
      console.error(`Erro ao processar mensagem de ${nomeCanal}:`, erro.message);
    }
  }
}

/* ---------- webhooks ---------- */

// WhatsApp e Instagram: mesmo protocolo (verificação por GET, assinatura nos POST).
function ligarMeta(canal) {
  app.get(`/webhooks/${canal.nome}`, (req, res) => verificarWebhook(req, res, canal.tokenVerificacao()));

  app.post(`/webhooks/${canal.nome}`, async (req, res) => {
    if (!canal.configurado()) return res.status(503).json({ erro: 'Canal não configurado' });
    if (!assinaturaValida(req.rawBody, req.get('x-hub-signature-256'), canal.segredo())) {
      return res.sendStatus(401);
    }
    res.sendStatus(200); // a Meta reenvia o pedido se a resposta demorar
    try {
      await processar(canal.nome, await canal.extrair(req.body));
    } catch (erro) {
      console.error(`Webhook ${canal.nome}:`, erro.message);
    }
  });
}
ligarMeta(canais.whatsapp);
ligarMeta(canais.instagram);

app.post('/webhooks/telegram', async (req, res) => {
  const t = canais.telegram;
  if (!t.configurado() || t.modo() !== 'webhook') return res.status(503).json({ erro: 'Canal não configurado' });
  if (!t.segredoWebhook() || !igualSeguro(req.get('x-telegram-bot-api-secret-token'), t.segredoWebhook())) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  await processar('telegram', await t.extrair(req.body));
});

/* ---------- estado e resumo ---------- */

app.get('/canais', (req, res) => {
  const { telegram, whatsapp, instagram } = canais;
  res.json([
    { nome: 'telegram', rotulo: telegram.rotulo, configurado: telegram.configurado(), modo: telegram.modo(), webhook: '/webhooks/telegram' },
    { nome: 'whatsapp', rotulo: whatsapp.rotulo, configurado: whatsapp.configurado(), modo: 'webhook', webhook: '/webhooks/whatsapp' },
    { nome: 'instagram', rotulo: instagram.rotulo, configurado: instagram.configurado(), modo: 'webhook', webhook: '/webhooks/instagram' },
  ]);
});

app.get('/resumo', rota(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM conversas WHERE estado <> 'fechada')::int AS abertas,
      (SELECT COUNT(*) FROM conversas WHERE estado = 'humano' AND nao_lidas > 0)::int AS por_responder,
      (SELECT COUNT(*) FROM mensagens WHERE origem = 'cliente' AND criado_em >= CURRENT_DATE)::int AS mensagens_hoje,
      COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE origem = 'bot')
        / NULLIF(COUNT(*) FILTER (WHERE origem IN ('bot', 'humano')), 0)), 0)::int AS bot_pct
    FROM mensagens`);
  res.json(rows[0]);
}));

/* ---------- conversas ---------- */

app.get('/conversas', rota(async (req, res) => {
  const { estado, canal, q } = req.query;
  const condicoes = [];
  const valores = [];
  const param = (v) => `$${valores.push(v)}`;

  if (estado === 'abertas') condicoes.push("estado <> 'fechada'");
  else if (estado) condicoes.push(`estado = ${param(estado)}`);
  if (canal) condicoes.push(`canal = ${param(canal)}`);
  if (q) {
    const padrao = param(`%${String(q).trim()}%`);
    condicoes.push(`(nome ILIKE ${padrao} OR EXISTS (
      SELECT 1 FROM mensagens m WHERE m.conversa_id = conversas_v.id AND m.texto ILIKE ${padrao}))`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM conversas_v ${condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''}
     ORDER BY (estado = 'humano' AND nao_lidas > 0) DESC, ultima_em DESC LIMIT 200`,
    valores
  );
  res.json(rows);
}));

// Abrir uma conversa marca-a como lida (a menos que se peça o contrário, como faz o simulador).
app.get('/conversas/:id', rota(async (req, res) => {
  if (req.query.marcar !== 'false') {
    await pool.query('UPDATE conversas SET nao_lidas = 0 WHERE id = $1', [req.params.id]);
  }
  const conversa = (await pool.query('SELECT * FROM conversas_v WHERE id = $1', [req.params.id])).rows[0];
  if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });
  const mensagens = await pool.query('SELECT * FROM mensagens WHERE conversa_id = $1 ORDER BY id', [conversa.id]);
  res.json({ ...conversa, mensagens: mensagens.rows });
}));

// Uma pessoa responde: o bot deixa de intervir nesta conversa até alguém o voltar a ligar.
app.post('/conversas/:id/mensagens', rota(async (req, res) => {
  const conteudo = texto(req.body.texto);
  if (!conteudo) throw new Falha(400, 'Escreve uma mensagem');
  if (conteudo.length > 4000) throw new Falha(400, 'A mensagem é demasiado longa');

  const { rows } = await pool.query(
    `SELECT c.id, k.canal, k.externo_id FROM conversas c JOIN contactos k ON k.id = c.contacto_id
     WHERE c.id = $1`, [req.params.id]);
  if (rows.length === 0) throw new Falha(404, 'Conversa não encontrada');

  const mensagem = await responder(pool, canais, rows[0], rows[0].id, conteudo, 'humano');
  await pool.query("UPDATE conversas SET estado = 'humano', nao_lidas = 0, falhas_seguidas = 0 WHERE id = $1", [rows[0].id]);
  res.status(201).json(mensagem);
}));

app.put('/conversas/:id/estado', rota(async (req, res) => {
  const { estado } = req.body;
  if (!['bot', 'humano', 'fechada'].includes(estado)) throw new Falha(400, 'Estado inválido');
  const { rowCount } = await pool.query(
    `UPDATE conversas SET estado = $1, falhas_seguidas = 0,
       nao_lidas = CASE WHEN $1 = 'humano' THEN nao_lidas ELSE 0 END
     WHERE id = $2`, [estado, req.params.id]);
  if (rowCount === 0) throw new Falha(404, 'Conversa não encontrada');
  res.json({ estado });
}));

// Apaga o contacto e tudo o que ele escreveu (pedido de remoção de dados, RGPD).
app.delete('/conversas/:id', rota(async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM contactos WHERE id = (SELECT contacto_id FROM conversas WHERE id = $1)', [req.params.id]);
  if (rowCount === 0) throw new Falha(404, 'Conversa não encontrada');
  res.status(204).end();
}));

/* ---------- respostas (perguntas frequentes) ---------- */

function listaPalavras(valor) {
  const lista = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : [];
  const vistas = new Set();
  const resultado = [];
  for (const item of lista) {
    const palavra = String(item).trim();
    const chave = normalizar(palavra);
    if (!chave || vistas.has(chave)) continue;
    if (palavra.length > 60) throw new Falha(400, 'Cada palavra-chave pode ter até 60 caracteres');
    vistas.add(chave);
    resultado.push(palavra);
  }
  if (resultado.length > 30) throw new Falha(400, 'No máximo 30 palavras-chave');
  return resultado;
}

function lerResposta(corpo) {
  const titulo = texto(corpo.titulo);
  if (!titulo) throw new Falha(400, 'O título é obrigatório');
  const resposta = texto(corpo.resposta);
  if (!resposta) throw new Falha(400, 'A resposta é obrigatória');
  const palavras = listaPalavras(corpo.palavras_chave);
  const ordem = corpo.ordem === undefined || corpo.ordem === '' ? null : Number(corpo.ordem);
  if (ordem !== null && !Number.isInteger(ordem)) throw new Falha(400, 'Ordem inválida');
  return [titulo, palavras, resposta, corpo.no_menu !== false, corpo.ativa !== false, ordem];
}

app.get('/respostas', rota(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM respostas ORDER BY ordem, id');
  res.json(rows);
}));

app.post('/respostas', rota(async (req, res) => {
  const [titulo, palavras, resposta, noMenu, ativa, ordem] = lerResposta(req.body);
  const { rows } = await pool.query(
    `INSERT INTO respostas (titulo, palavras_chave, resposta, no_menu, ativa, ordem)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM respostas)))
     RETURNING *`, [titulo, palavras, resposta, noMenu, ativa, ordem]);
  res.status(201).json(rows[0]);
}));

// O que o bot responderia a este texto, sem enviar nada a ninguém.
app.post('/respostas/testar', rota(async (req, res) => {
  const conteudo = texto(req.body.texto);
  if (!conteudo) throw new Falha(400, 'Escreve uma mensagem para testar');
  const [regras, negocio] = await Promise.all([
    pool.query('SELECT * FROM respostas'),
    pool.query('SELECT * FROM negocio'),
  ]);
  res.json(decidir({ texto: conteudo, regras: regras.rows, negocio: negocio.rows[0] ?? NEGOCIO_PADRAO }));
}));

app.put('/respostas/:id', rota(async (req, res) => {
  const [titulo, palavras, resposta, noMenu, ativa, ordem] = lerResposta(req.body);
  const { rows } = await pool.query(
    `UPDATE respostas SET titulo = $1, palavras_chave = $2, resposta = $3, no_menu = $4, ativa = $5,
       ordem = COALESCE($6, ordem)
     WHERE id = $7 RETURNING *`, [titulo, palavras, resposta, noMenu, ativa, ordem, req.params.id]);
  if (rows.length === 0) throw new Falha(404, 'Resposta não encontrada');
  res.json(rows[0]);
}));

app.delete('/respostas/:id', rota(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM respostas WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw new Falha(404, 'Resposta não encontrada');
  res.status(204).end();
}));

/* ---------- negócio ---------- */

app.get('/negocio', rota(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM negocio');
  res.json(rows[0] ?? { id: 1, ...NEGOCIO_PADRAO });
}));

app.put('/negocio', rota(async (req, res) => {
  const campos = ['nome', 'boas_vindas', 'mensagem_humano', 'mensagem_falha'].map((c) => texto(req.body[c]));
  if (campos.some((c) => !c)) throw new Falha(400, 'Preenche todos os textos');
  const { rows } = await pool.query(
    `INSERT INTO negocio (id, nome, boas_vindas, mensagem_humano, mensagem_falha)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, boas_vindas = EXCLUDED.boas_vindas,
       mensagem_humano = EXCLUDED.mensagem_humano, mensagem_falha = EXCLUDED.mensagem_falha
     RETURNING *`, campos);
  res.json(rows[0]);
}));

/* ---------- simulador ---------- */

// Faz de conta que um cliente escreveu: passa pelo mesmo caminho das mensagens reais.
app.post('/simulador/mensagem', rota(async (req, res) => {
  const nome = texto(req.body.nome);
  const conteudo = texto(req.body.texto);
  if (!nome || nome.length > 40) throw new Falha(400, 'Indica um nome (até 40 caracteres)');
  if (!conteudo || conteudo.length > 1000) throw new Falha(400, 'Escreve uma mensagem (até 1000 caracteres)');
  const resultado = await receber(pool, canais, 'simulador', {
    externoId: `sim-${normalizar(nome).replace(/ /g, '-')}`,
    nome,
    texto: conteudo,
  });
  res.status(201).json({ conversaId: resultado.conversaId });
}));

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
  for (const c of [canais.telegram, canais.whatsapp, canais.instagram]) {
    console.log(`  ${c.rotulo}: ${c.configurado() ? 'ligado' : 'sem configuração (usa o simulador)'}`);
  }
  if (canais.telegram.configurado() && canais.telegram.modo() === 'polling') {
    canais.telegram.iniciarPolling((mensagens) => processar('telegram', mensagens));
  }
});
