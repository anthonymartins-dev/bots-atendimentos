// Cérebro do bot: recebe o texto do cliente e decide a resposta.
// É uma função pura (sem rede nem base de dados), por isso é fácil de testar.

const LIMITE_FALHAS = 3; // à terceira pergunta seguida que não percebe, passa para uma pessoa

const SAUDACOES = ['ola', 'oi', 'menu', 'inicio', 'start', 'ajuda', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'];
const PEDIDOS_HUMANO = [
  'humano', 'atendente', 'pessoa', 'operador', 'operadora',
  'falar com alguem', 'falar com uma pessoa', 'falar com um humano',
];

// Minúsculas, sem acentos nem pontuação: "Qual é o HORÁRIO?" -> "qual e o horario"
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A frase tem de aparecer como palavra inteira: "sol" não apanha "solução".
const contem = (textoNormalizado, frase) => ` ${textoNormalizado} `.includes(` ${frase} `);

function montarMenu(introducao, regras) {
  const itens = regras.filter((r) => r.no_menu).map((r, i) => `${i + 1}. ${r.titulo}`);
  const rodape = 'Escreve o número ou a tua pergunta. Para falar com uma pessoa, escreve "humano".';
  return itens.length ? `${introducao}\n\n${itens.join('\n')}\n\n${rodape}` : `${introducao}\n\n${rodape}`;
}

/*
 * Devolve { tipo, texto, regraId? } com tipo:
 *   'humano'   pede uma pessoa (ou o bot desistiu), a conversa passa para a equipa
 *   'resposta' respondeu a uma pergunta frequente
 *   'menu'     saudação, mostra as opções
 *   'falha'    não percebeu, mostra as opções
 */
function decidir({ texto, regras, negocio, falhasSeguidas = 0 }) {
  const ativas = regras.filter((r) => r.ativa).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  const menu = ativas.filter((r) => r.no_menu);
  const msg = normalizar(texto);

  if (PEDIDOS_HUMANO.some((f) => contem(msg, f))) {
    return { tipo: 'humano', texto: negocio.mensagem_humano };
  }

  // Só um número: escolhe essa opção do menu.
  if (/^\d{1,2}$/.test(msg)) {
    const escolhida = menu[Number(msg) - 1];
    if (escolhida) return { tipo: 'resposta', texto: escolhida.resposta, regraId: escolhida.id };
  } else {
    // A regra com mais palavras-chave (e mais longas) encontradas ganha.
    let melhor = null;
    let melhorPontos = 0;
    for (const regra of ativas) {
      const pontos = regra.palavras_chave
        .map(normalizar)
        .filter((k) => k && contem(msg, k))
        .reduce((soma, k) => soma + k.length, 0);
      if (pontos > melhorPontos) {
        melhor = regra;
        melhorPontos = pontos;
      }
    }
    if (melhor) return { tipo: 'resposta', texto: melhor.resposta, regraId: melhor.id };

    if (SAUDACOES.some((f) => contem(msg, f))) {
      return { tipo: 'menu', texto: montarMenu(negocio.boas_vindas, ativas) };
    }
  }

  if (falhasSeguidas + 1 >= LIMITE_FALHAS) {
    return { tipo: 'humano', texto: negocio.mensagem_humano };
  }
  return { tipo: 'falha', texto: montarMenu(negocio.mensagem_falha, ativas) };
}

// Cada rede tem o seu limite de caracteres por mensagem.
function cortar(texto, limite) {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}

module.exports = { decidir, normalizar, montarMenu, cortar, LIMITE_FALHAS };
