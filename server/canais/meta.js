const crypto = require('node:crypto');
const { igualSeguro } = require('./util');

// Partilhado pelo WhatsApp e pelo Instagram: ambos usam os webhooks da Meta.

/*
 * Cada pedido da Meta traz "sha256=<HMAC do corpo>", feito com o segredo da app.
 * Sem esta verificação, qualquer pessoa podia enviar mensagens falsas ao webhook.
 */
function assinaturaValida(corpoCru, cabecalho, segredo) {
  if (!corpoCru || !cabecalho || !segredo) return false;
  const esperado = `sha256=${crypto.createHmac('sha256', segredo).update(corpoCru).digest('hex')}`;
  return igualSeguro(esperado, cabecalho);
}

// Passo único de configuração: a Meta faz um GET e espera o "challenge" de volta.
function verificarWebhook(req, res, tokenEsperado) {
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const desafio = req.query['hub.challenge'];
  if (modo === 'subscribe' && tokenEsperado && igualSeguro(token, tokenEsperado)) {
    return res.status(200).type('text/plain').send(String(desafio ?? ''));
  }
  return res.sendStatus(403);
}

module.exports = { assinaturaValida, verificarWebhook };
