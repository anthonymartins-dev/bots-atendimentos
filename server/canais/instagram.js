const { pedirJSON } = require('./util');

const graph = () => process.env.GRAPH_API_URL || 'https://graph.facebook.com/v21.0';

// O webhook não traz o nome de quem escreve: pede-se uma vez e guarda-se em memória.
const nomes = new Map();

async function obterNome(id) {
  if (nomes.has(id)) return nomes.get(id);
  let nome = `Instagram ${id.slice(-4)}`;
  try {
    const perfil = await pedirJSON(`${graph()}/${id}?fields=name,username`, {
      metodo: 'GET',
      token: process.env.INSTAGRAM_TOKEN,
      tempo: 3000,
    });
    nome = perfil?.username || perfil?.name || nome;
  } catch {
    /* o nome é só um extra: sem ele usa-se o código */
  }
  nomes.set(id, nome);
  return nome;
}

const instagram = {
  nome: 'instagram',
  rotulo: 'Instagram',
  limite: 1000,
  configurado: () =>
    Boolean(
      process.env.INSTAGRAM_TOKEN &&
        process.env.INSTAGRAM_ACCOUNT_ID &&
        process.env.INSTAGRAM_VERIFY_TOKEN &&
        process.env.INSTAGRAM_APP_SECRET
    ),
  segredo: () => process.env.INSTAGRAM_APP_SECRET,
  tokenVerificacao: () => process.env.INSTAGRAM_VERIFY_TOKEN,

  async enviar(destinatario, texto) {
    await pedirJSON(`${graph()}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`, {
      token: process.env.INSTAGRAM_TOKEN,
      corpo: { recipient: { id: destinatario }, message: { text: texto } },
    });
    return 'ok';
  },

  // entry -> messaging -> { sender, message }. Ignora os "ecos" das nossas próprias respostas.
  async extrair(corpo) {
    if (corpo?.object !== 'instagram') return [];
    const mensagens = [];
    for (const entrada of corpo.entry ?? []) {
      for (const evento of entrada.messaging ?? []) {
        const m = evento.message;
        if (!m || m.is_echo || !evento.sender?.id) continue;
        mensagens.push({
          externoId: evento.sender.id,
          nome: await obterNome(evento.sender.id),
          texto: m.text ?? '[anexo]',
          anexo: !m.text,
          msgId: `instagram:${m.mid}`,
        });
      }
    }
    return mensagens;
  },
};

module.exports = instagram;
