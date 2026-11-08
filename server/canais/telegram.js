const { pedirJSON } = require('./util');

const api = () => process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const token = () => process.env.TELEGRAM_BOT_TOKEN;
const modo = () => (process.env.TELEGRAM_MODO === 'webhook' ? 'webhook' : 'polling');

const nomeDe = (de = {}) =>
  [de.first_name, de.last_name].filter(Boolean).join(' ') || de.username || 'Telegram';

// Transforma uma "update" do Telegram no formato interno. Ignora o que não é mensagem.
function extrairUpdate(update) {
  const m = update?.message;
  if (!m?.chat) return [];
  const anexo = !m.text;
  return [
    {
      externoId: String(m.chat.id),
      nome: nomeDe(m.from),
      texto: m.text ?? '[anexo]',
      anexo,
      msgId: `telegram:${update.update_id}`,
    },
  ];
}

const telegram = {
  nome: 'telegram',
  rotulo: 'Telegram',
  limite: 4096,
  modo,
  configurado: () => Boolean(token()),
  segredoWebhook: () => process.env.TELEGRAM_WEBHOOK_SECRET,

  async enviar(chatId, texto) {
    await pedirJSON(`${api()}/bot${token()}/sendMessage`, { corpo: { chat_id: chatId, text: texto } });
    return 'ok';
  },

  extrair: async (corpo) => extrairUpdate(corpo),

  /*
   * Sem URL pública (por exemplo no teu computador), o servidor pergunta ao
   * Telegram se há mensagens novas (long polling). Em produção usa-se o webhook.
   */
  iniciarPolling(processar) {
    let ativo = true;
    let offset = 0;

    (async () => {
      try {
        await pedirJSON(`${api()}/bot${token()}/deleteWebhook`, { corpo: {} });
      } catch (erro) {
        console.error('Telegram: não consegui preparar o polling:', erro.message);
      }
      while (ativo) {
        try {
          const resposta = await pedirJSON(`${api()}/bot${token()}/getUpdates`, {
            corpo: { offset, timeout: 25, allowed_updates: ['message'] },
            tempo: 35000,
          });
          for (const update of resposta?.result ?? []) {
            offset = update.update_id + 1;
            await processar(extrairUpdate(update));
          }
        } catch (erro) {
          console.error('Telegram (polling):', erro.message);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    })();

    return () => {
      ativo = false;
    };
  },
};

module.exports = telegram;
