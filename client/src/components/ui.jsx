import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CANAIS, ESTADOS_CONVERSA, iniciais } from '../format.js';

/* Carrega dados da API e volta a carregar quando as dependências mudam. */
export function useDados(carregar, dependencias) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const pedido = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    const meu = ++pedido.current;
    try {
      const resultado = await carregar();
      if (meu !== pedido.current) return;
      setDados(resultado);
      setErro('');
    } catch (e) {
      if (meu === pedido.current) setErro(e.message);
    }
  }, dependencias);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, setDados, erro, recarregar };
}

/* Volta a pedir os dados de tempos a tempos (e quando o separador volta a ficar visível). */
export function useAtualizar(recarregar, segundos) {
  useEffect(() => {
    const tick = () => !document.hidden && recarregar();
    const t = setInterval(tick, segundos * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [recarregar, segundos]);
}

export function useEscape(aoFechar) {
  useEffect(() => {
    const fechar = (e) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [aoFechar]);
}

export function Modal({ titulo, subtitulo, largura = 'max-w-md', aoFechar, children }) {
  useEscape(aoFechar);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div
        className={`animar my-auto w-full ${largura} rounded-2xl border border-line bg-card p-6 shadow-xl shadow-ink/10`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-muted">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted transition hover:bg-line/60 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const classeInput =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-3 focus:ring-brand/15';

export function Campo({ rotulo, obrigatorio, ajuda, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">
        {rotulo}
        {obrigatorio && <span className="text-danger"> *</span>}
      </span>
      <input className={classeInput} {...props} />
      {ajuda && <span className="mt-1 block text-xs text-muted">{ajuda}</span>}
    </label>
  );
}

export function Area({ rotulo, ajuda, rows = 3, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{rotulo}</span>
      <textarea rows={rows} className={`${classeInput} resize-y`} {...props} />
      {ajuda && <span className="mt-1 block text-xs text-muted">{ajuda}</span>}
    </label>
  );
}

export function BotaoPrimario({ className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function BotaoSecundario({ className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-line/50 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function BotaoPerigo({ className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function IconeBotao({ rotulo, perigo, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={`rounded-lg p-2 text-muted transition ${
        perigo ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-line/70 hover:text-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Erro({ children }) {
  if (!children) return null;
  return <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{children}</p>;
}

export function Vazio({ titulo, texto, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center">
      <h2 className="font-serif text-xl font-semibold">{titulo}</h2>
      <p className="mt-1 text-sm text-muted">{texto}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Cartao({ titulo, texto, acao, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-card ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 className="font-serif text-xl font-semibold">{titulo}</h2>
          {texto && <p className="mt-0.5 text-sm text-muted">{texto}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

/* Círculo com as iniciais, na cor do canal por onde o cliente escreve. */
export function Avatar({ nome, canal, tamanho = 40 }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-medium text-white"
      style={{ width: tamanho, height: tamanho, backgroundColor: CANAIS[canal]?.cor ?? '#5c5a52', fontSize: tamanho * 0.38 }}
    >
      {iniciais(nome)}
    </span>
  );
}

export function CanalTag({ canal }) {
  const { texto, cor } = CANAIS[canal] ?? CANAIS.simulador;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: cor }} />
      {texto}
    </span>
  );
}

export function EstadoBadge({ estado }) {
  const { texto, badge } = ESTADOS_CONVERSA[estado];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badge}`}>
      {texto}
    </span>
  );
}

/* Pede confirmação antes de uma ação que não se desfaz. */
export function Confirmar({ titulo, texto, rotulo, aoConfirmar, aoFechar }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    setOcupado(true);
    setErro('');
    try {
      await aoConfirmar();
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <p className="text-sm leading-relaxed text-muted">{texto}</p>
      <div className="mt-4">
        <Erro>{erro}</Erro>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <BotaoSecundario onClick={aoFechar}>Cancelar</BotaoSecundario>
        <BotaoPerigo onClick={confirmar} disabled={ocupado}>
          {rotulo}
        </BotaoPerigo>
      </div>
    </Modal>
  );
}

/* Balão de mensagem, partilhado pelas conversas e pelo simulador. */
export function Balao({ mensagem }) {
  const { origem, texto, envio, erro } = mensagem;
  const cliente = origem === 'cliente';
  const estilo = cliente
    ? 'rounded-bl-md border border-line bg-white text-ink'
    : origem === 'bot'
      ? 'rounded-br-md bg-brand-soft text-ink'
      : 'rounded-br-md bg-brand text-white';

  return (
    <div className={`flex flex-col ${cliente ? 'items-start' : 'items-end'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap ${estilo}`}>
        {texto}
      </div>
      <p className="num mt-1 px-1 text-xs text-muted">
        {origem === 'bot' && 'Bot · '}
        {origem === 'humano' && 'Equipa · '}
        {mensagem.criado_em.slice(11, 16)}
      </p>
      {envio === 'falhou' && (
        <p className="mt-0.5 max-w-[85%] px-1 text-xs text-danger">Não chegou ao cliente: {erro || 'erro ao enviar'}</p>
      )}
    </div>
  );
}
