const { decidir, cortar } = require('./bot');

const NEGOCIO_PADRAO = {
  nome: 'O nosso negócio',
  boas_vindas: 'Olá! Em que posso ajudar?',
  mensagem_humano: 'Já avisei a equipa. Uma pessoa responde-te em breve.',
  mensagem_falha: 'Não percebi bem a tua pergunta.',
};

async function transacao(pool, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

/*
 * Envia um texto pela rede certa e guarda-o na conversa. Se o envio falhar
 * (token errado, rede em baixo...) a mensagem fica registada como "falhou",
 * para a equipa ver o que não chegou ao cliente.
 */
async function responder(pool, canais, contacto, conversaId, texto, origem) {
  const canal = canais[contacto.canal];
  let envio;
  let erro = null;
  try {
    if (!canal?.configurado()) throw new Error('Canal não configurado');
    envio = await canal.enviar(contacto.externo_id, cortar(texto, canal.limite));
  } catch (e) {
    envio = 'falhou';
    erro = e.message.slice(0, 300);
  }
  const { rows } = await pool.query(
    `INSERT INTO mensagens (conversa_id, origem, texto, envio, erro)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [conversaId, origem, texto, envio, erro]
  );
  await pool.query('UPDATE conversas SET ultima_em = NOW() WHERE id = $1', [conversaId]);
  return rows[0];
}

/*
 * Uma mensagem entrou por um canal. Guarda-a (uma só vez, mesmo que a rede a
 * reenvie) e, se a conversa for do bot, responde.
 */
async function receber(pool, canais, nomeCanal, entrada) {
  const { externoId, nome, texto, msgId = null, anexo = false } = entrada;

  const gravada = await transacao(pool, async (db) => {
    const contacto = (
      await db.query(
        `INSERT INTO contactos (canal, externo_id, nome) VALUES ($1, $2, $3)
         ON CONFLICT (canal, externo_id) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING *`,
        [nomeCanal, externoId, nome]
      )
    ).rows[0];

    const { rows } = await db.query(
      `INSERT INTO conversas (contacto_id) VALUES ($1)
       ON CONFLICT (contacto_id) DO UPDATE SET contacto_id = EXCLUDED.contacto_id
       RETURNING id`,
      [contacto.id]
    );
    const conversaId = rows[0].id;

    const nova = await db.query(
      `INSERT INTO mensagens (conversa_id, origem, texto, externo_id)
       VALUES ($1, 'cliente', $2, $3)
       ON CONFLICT (externo_id) DO NOTHING RETURNING id`,
      [conversaId, texto, msgId]
    );
    if (nova.rowCount === 0) return null; // reenvio da mesma mensagem

    // Se o cliente volta a escrever numa conversa fechada, volta a ser atendida pelo bot.
    const conversa = (
      await db.query(
        `UPDATE conversas SET nao_lidas = nao_lidas + 1, ultima_em = NOW(),
           estado = CASE WHEN estado = 'fechada' THEN 'bot' ELSE estado END
         WHERE id = $1 RETURNING *`,
        [conversaId]
      )
    ).rows[0];
    return { contacto, conversa };
  });

  if (!gravada) return { duplicada: true };
  const { contacto, conversa } = gravada;
  if (conversa.estado === 'humano') return { conversaId: conversa.id, bot: false };

  const [regras, negocio] = await Promise.all([
    pool.query('SELECT * FROM respostas'),
    pool.query('SELECT * FROM negocio'),
  ]);
  const dados = negocio.rows[0] ?? NEGOCIO_PADRAO;

  // Fotografias, áudios e afins: o bot não os entende, é melhor chamar uma pessoa.
  const decisao = anexo
    ? { tipo: 'humano', texto: dados.mensagem_humano }
    : decidir({ texto, regras: regras.rows, negocio: dados, falhasSeguidas: conversa.falhas_seguidas });

  await responder(pool, canais, contacto, conversa.id, decisao.texto, 'bot');

  await pool.query(
    `UPDATE conversas SET
       estado = CASE WHEN $2 = 'humano' THEN 'humano' ELSE estado END,
       falhas_seguidas = CASE WHEN $2 = 'falha' THEN falhas_seguidas + 1 ELSE 0 END
     WHERE id = $1`,
    [conversa.id, decisao.tipo]
  );
  return { conversaId: conversa.id, bot: true, tipo: decisao.tipo };
}

module.exports = { receber, responder, NEGOCIO_PADRAO };
