const crypto = require('node:crypto');

// Compara textos em tempo constante, para não revelar um segredo pelo tempo de resposta.
function igualSeguro(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/*
 * Pedido HTTP em JSON com limite de tempo. Os erros nunca incluem o endereço
 * (nos pedidos do Telegram o token faz parte dele).
 */
async function pedirJSON(url, { metodo = 'POST', token, corpo, tempo = 10000 } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(tempo),
    });
  } catch (erro) {
    throw new Error(erro.name === 'TimeoutError' ? 'O serviço demorou demasiado a responder' : 'Sem ligação ao serviço');
  }

  const texto = await resposta.text();
  let dados = null;
  try {
    dados = JSON.parse(texto);
  } catch {
    /* resposta que não é JSON */
  }
  if (!resposta.ok) {
    const detalhe = dados?.error?.message || dados?.description || texto.slice(0, 120);
    throw new Error(`${resposta.status}: ${detalhe}`);
  }
  return dados;
}

module.exports = { igualSeguro, pedirJSON };
