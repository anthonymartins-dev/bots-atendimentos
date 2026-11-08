import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../api.js';
import { Balao, BotaoPrimario, Campo, Cartao, Erro, classeInput, useAtualizar, useDados } from './ui.jsx';

const SUGESTOES = ['Boa tarde', 'Qual é o horário?', 'Fazem entregas?', 'Aceitam MB Way?', 'Quero falar com uma pessoa'];

// Lembra o cliente simulado ao mudar de separador (só enquanto o navegador estiver aberto).
const CHAVE = 'simulador';
function lembrado() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE)) ?? {};
  } catch {
    return {};
  }
}

export default function Simulador({ aoMudar }) {
  const [nome, setNome] = useState(() => lembrado().nome ?? 'Visitante');
  const [conversaId, setConversaId] = useState(() => lembrado().conversaId ?? null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const fim = useRef(null);

  const { dados: conversa, recarregar } = useDados(
    () => (conversaId ? api.conversa(conversaId, false) : Promise.resolve(null)),
    [conversaId]
  );
  useAtualizar(recarregar, 2);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({ nome, conversaId }));
    } catch {
      /* sem armazenamento: perde-se ao mudar de separador */
    }
  }, [nome, conversaId]);

  const mensagens = conversa?.mensagens ?? [];
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);

  async function enviar(conteudo) {
    if (!conteudo.trim() || aEnviar) return;
    setAEnviar(true);
    setErro('');
    try {
      const { conversaId: id } = await api.simular(nome, conteudo);
      setTexto('');
      if (id === conversaId) await recarregar();
      else setConversaId(id);
      aoMudar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="flex h-[calc(100vh-17rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <header className="border-b border-line px-5 py-3">
          <p className="font-medium">{conversa ? conversa.nome : nome || 'Cliente'}</p>
          <p className="text-xs text-muted">
            Simulador{conversa?.estado === 'humano' ? ' · conversa com a equipa' : conversa ? ' · a responder o bot' : ''}
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-paper/60 px-5 py-5">
          {mensagens.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              Escreve como se fosses um cliente. A mensagem passa pelo mesmo caminho das mensagens reais do Telegram,
              WhatsApp e Instagram.
            </p>
          )}
          {mensagens.map((m) => (
            <Balao key={m.id} mensagem={m} />
          ))}
          {conversa?.estado === 'humano' && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-center text-sm text-warn">
              Esta conversa está com a equipa. O bot não responde; responde no separador Conversas.
            </p>
          )}
          <div ref={fim} />
        </div>

        <div className="border-t border-line p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                disabled={aEnviar}
                className="rounded-full border border-line px-3 py-1 text-sm text-muted transition hover:border-brand/40 hover:text-ink disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="flex gap-2"
          >
            <input
              className={classeInput}
              placeholder="Escreve uma mensagem"
              aria-label="Mensagem do cliente"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <BotaoPrimario type="submit" disabled={aEnviar || !texto.trim()} aria-label="Enviar">
              <Send size={16} />
            </BotaoPrimario>
          </form>
          <div className="mt-2">
            <Erro>{erro}</Erro>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <Cartao titulo="Quem escreve" texto="Cada nome é um cliente diferente, com a sua própria conversa.">
          <div className="space-y-3 p-5">
            <Campo
              rotulo="Nome do cliente"
              value={nome}
              maxLength={40}
              onChange={(e) => {
                setNome(e.target.value);
                setConversaId(null);
              }}
            />
            <p className="text-sm text-muted">
              Experimenta pedir uma pessoa e depois responde no separador Conversas: a resposta aparece aqui.
            </p>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
