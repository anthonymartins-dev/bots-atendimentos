import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Search, Send, Trash2, UserRound } from 'lucide-react';
import { api } from '../api.js';
import { diaDe, quandoCurto } from '../format.js';
import {
  Avatar,
  Balao,
  BotaoPrimario,
  BotaoSecundario,
  CanalTag,
  Confirmar,
  EstadoBadge,
  IconeBotao,
  Vazio,
  classeInput,
  useAtualizar,
  useDados,
} from './ui.jsx';

const FILTROS = [
  ['abertas', 'Abertas'],
  ['humano', 'Com a equipa'],
  ['fechada', 'Fechadas'],
  ['', 'Todas'],
];

function ItemConversa({ c, ativa, aoAbrir }) {
  const previa = c.ultima_origem === 'cliente' ? c.ultima_texto : `${c.ultima_origem === 'bot' ? 'Bot' : 'Equipa'}: ${c.ultima_texto}`;
  const porResponder = c.estado === 'humano' && c.nao_lidas > 0;
  return (
    <button
      onClick={aoAbrir}
      className={`flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left transition last:border-b-0 ${
        ativa ? 'bg-brand-soft/60' : 'hover:bg-line/30'
      }`}
    >
      <Avatar nome={c.nome} canal={c.canal} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">{c.nome}</p>
          <span className="num shrink-0 text-xs text-muted">{quandoCurto(c.ultima_em)}</span>
        </div>
        <p className="truncate text-sm text-muted">{previa}</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <CanalTag canal={c.canal} />
          <EstadoBadge estado={c.estado} />
          {porResponder && (
            <span className="num ml-auto rounded-full bg-warn px-2 py-0.5 text-xs font-medium text-white">
              {c.nao_lidas}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Fio({ id, voltar, aoMudar, avisar, aoApagar }) {
  const { dados: c, erro, recarregar } = useDados(() => api.conversa(id), [id]);
  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [apagar, setApagar] = useState(false);
  const fim = useRef(null);
  const total = c?.mensagens.length ?? 0;

  useAtualizar(recarregar, 4);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [total, id]);

  if (erro && !c) return <p className="p-6 text-danger">{erro}</p>;
  if (!c) return <div className="m-6 h-64 animate-pulse rounded-2xl bg-line/40" />;

  async function enviar(e) {
    e?.preventDefault();
    if (!texto.trim() || aEnviar) return;
    setAEnviar(true);
    try {
      const mensagem = await api.responderConversa(c.id, texto);
      if (mensagem.envio === 'falhou') avisar('A mensagem não chegou ao cliente');
      setTexto('');
      await recarregar();
      aoMudar();
    } catch (err) {
      avisar(err.message);
    } finally {
      setAEnviar(false);
    }
  }

  async function mudarEstado(estado) {
    try {
      await api.mudarEstado(c.id, estado);
      await recarregar();
      aoMudar();
    } catch (err) {
      avisar(err.message);
    }
  }

  let diaAnterior = '';
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <button onClick={voltar} aria-label="Voltar à lista" className="-ml-1 rounded-lg p-1.5 text-muted hover:text-ink lg:hidden">
          <ArrowLeft size={18} />
        </button>
        <Avatar nome={c.nome} canal={c.canal} tamanho={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{c.nome}</p>
          <div className="flex items-center gap-2.5">
            <CanalTag canal={c.canal} />
            <EstadoBadge estado={c.estado} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c.estado === 'humano' ? (
            <BotaoSecundario className="px-3 py-2" onClick={() => mudarEstado('bot')}>
              <Bot size={15} /> Devolver ao bot
            </BotaoSecundario>
          ) : c.estado === 'bot' ? (
            <BotaoSecundario className="px-3 py-2" onClick={() => mudarEstado('humano')}>
              <UserRound size={15} /> Assumir
            </BotaoSecundario>
          ) : null}
          {c.estado === 'fechada' ? (
            <BotaoSecundario className="px-3 py-2" onClick={() => mudarEstado('bot')}>
              Reabrir
            </BotaoSecundario>
          ) : (
            <BotaoSecundario className="px-3 py-2" onClick={() => mudarEstado('fechada')}>
              Fechar
            </BotaoSecundario>
          )}
          <IconeBotao rotulo="Apagar conversa e dados do cliente" perigo onClick={() => setApagar(true)}>
            <Trash2 size={16} />
          </IconeBotao>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-paper/60 px-4 py-5 sm:px-5">
        {c.mensagens.map((m) => {
          const dia = diaDe(m.criado_em);
          const novoDia = dia !== diaAnterior;
          diaAnterior = dia;
          return (
            <Fragment key={m.id}>
              {novoDia && <p className="py-1 text-center text-xs font-medium text-muted">{dia}</p>}
              <Balao mensagem={m} />
            </Fragment>
          );
        })}
        <div ref={fim} />
      </div>

      <form onSubmit={enviar} className="border-t border-line p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            className={`${classeInput} resize-none`}
            placeholder={c.estado === 'fechada' ? 'Conversa fechada. Responder reabre-a.' : 'Escreve a resposta'}
            aria-label="Resposta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) enviar(e);
            }}
          />
          <BotaoPrimario type="submit" disabled={aEnviar || !texto.trim()} className="h-11" aria-label="Enviar">
            <Send size={16} />
          </BotaoPrimario>
        </div>
        {c.estado === 'bot' && (
          <p className="mt-2 text-xs text-muted">Ao responderes, o bot deixa de responder nesta conversa.</p>
        )}
      </form>

      {apagar && (
        <Confirmar
          titulo="Apagar conversa?"
          texto={`Vais apagar a conversa com ${c.nome} e todas as mensagens. Serve para pedidos de remoção de dados e não dá para desfazer.`}
          rotulo="Apagar"
          aoConfirmar={async () => {
            await api.apagarConversa(c.id);
            aoApagar();
          }}
          aoFechar={() => setApagar(false)}
        />
      )}
    </div>
  );
}

export default function Conversas({ versao, aoMudar, avisar }) {
  const [filtro, setFiltro] = useState('abertas');
  const [q, setQ] = useState('');
  const [aberta, setAberta] = useState(null);
  const lista = useDados(() => api.conversas({ estado: filtro, q }), [filtro, q, versao]);
  useAtualizar(lista.recarregar, 4);

  const conversas = lista.dados;

  return (
    <div className="grid h-[calc(100vh-17rem)] min-h-[34rem] overflow-hidden rounded-2xl border border-line bg-card lg:grid-cols-[23rem_1fr]">
      <div className={`flex min-h-0 flex-col border-line lg:border-r ${aberta ? 'hidden lg:flex' : 'flex'}`}>
        <div className="space-y-3 border-b border-line p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              className={`${classeInput} pl-9`}
              placeholder="Pesquisar nome ou mensagem"
              aria-label="Pesquisar conversas"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar conversas">
            {FILTROS.map(([valor, texto]) => (
              <button
                key={texto}
                onClick={() => setFiltro(valor)}
                aria-pressed={filtro === valor}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  filtro === valor ? 'border-brand bg-brand-soft font-medium text-brand' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lista.erro && !conversas && <p className="p-4 text-danger">{lista.erro}</p>}
          {conversas?.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">Nenhuma conversa com estes filtros.</p>
          )}
          {conversas?.map((c) => (
            <ItemConversa key={c.id} c={c} ativa={c.id === aberta} aoAbrir={() => setAberta(c.id)} />
          ))}
        </div>
      </div>

      <div className={`min-h-0 ${aberta ? 'block' : 'hidden lg:block'}`}>
        {aberta ? (
          <Fio
            key={aberta}
            id={aberta}
            voltar={() => setAberta(null)}
            aoMudar={aoMudar}
            avisar={avisar}
            aoApagar={() => {
              setAberta(null);
              avisar('Conversa apagada');
              aoMudar();
            }}
          />
        ) : (
          <div className="grid h-full place-items-center p-8">
            <Vazio titulo="Escolhe uma conversa" texto="As mensagens dos clientes aparecem aqui, venham de onde vierem." />
          </div>
        )}
      </div>
    </div>
  );
}
