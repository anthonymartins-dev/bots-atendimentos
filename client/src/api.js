export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3006';

async function pedir(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });

  if (resposta.status === 204) return null;

  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Algo correu mal');
  return dados;
}

const enviar = (metodo, corpo) => ({ method: metodo, body: JSON.stringify(corpo) });
const apagar = { method: 'DELETE' };

export const api = {
  resumo: () => pedir('/resumo'),
  canais: () => pedir('/canais'),

  conversas: (filtros = {}) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
    return pedir(`/conversas?${params}`);
  },
  conversa: (id, marcar = true) => pedir(`/conversas/${id}?marcar=${marcar}`),
  responderConversa: (id, texto) => pedir(`/conversas/${id}/mensagens`, enviar('POST', { texto })),
  mudarEstado: (id, estado) => pedir(`/conversas/${id}/estado`, enviar('PUT', { estado })),
  apagarConversa: (id) => pedir(`/conversas/${id}`, apagar),

  respostas: () => pedir('/respostas'),
  criarResposta: (d) => pedir('/respostas', enviar('POST', d)),
  editarResposta: (id, d) => pedir(`/respostas/${id}`, enviar('PUT', d)),
  apagarResposta: (id) => pedir(`/respostas/${id}`, apagar),
  testarResposta: (texto) => pedir('/respostas/testar', enviar('POST', { texto })),

  negocio: () => pedir('/negocio'),
  guardarNegocio: (d) => pedir('/negocio', enviar('PUT', d)),

  simular: (nome, texto) => pedir('/simulador/mensagem', enviar('POST', { nome, texto })),
};
