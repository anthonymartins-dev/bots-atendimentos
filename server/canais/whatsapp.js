const { pedirJSON } = require('./util');

const graph = () => process.env.GRAPH_API_URL || 'https://graph.facebook.com/v21.0';

const whatsapp = {
  nome: 'whatsapp',
  rotulo: 'WhatsApp',
  limite: 4096,
  configurado: () =>
    Boolean(
      process.env.WHATSAPP_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_VERIFY_TOKEN &&
        process.env.WHATSAPP_APP_SECRET
    ),
  segredo: () => process.env.WHATSAPP_APP_SECRET,
  tokenVerificacao: () => process.env.WHATSAPP_VERIFY_TOKEN,

  async enviar(numero, texto) {
    await pedirJSON(`${graph()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      token: process.env.WHATSAPP_TOKEN,
      corpo: { messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: texto } },
    });
    return 'ok';
  },

  // O corpo tem entry -> changes -> value -> messages; os nomes vêm em value.contacts.
  async extrair(corpo) {
    if (corpo?.object !== 'whatsapp_business_account') return [];
    const mensagens = [];
    for (const entrada of corpo.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        const valor = mudanca.value ?? {};
        const nomes = Object.fromEntries(
          (valor.contacts ?? []).map((c) => [c.wa_id, c.profile?.name])
        );
        for (const m of valor.messages ?? []) {
          mensagens.push({
            externoId: m.from,
            nome: nomes[m.from] || `+${m.from}`,
            texto: m.type === 'text' ? m.text?.body ?? '' : `[${m.type}]`,
            anexo: m.type !== 'text',
            msgId: `whatsapp:${m.id}`,
          });
        }
      }
    }
    return mensagens;
  },
};

module.exports = whatsapp;
