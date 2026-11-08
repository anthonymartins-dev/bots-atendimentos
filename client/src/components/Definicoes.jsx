import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { api, BASE } from '../api.js';
import { CANAIS } from '../format.js';
import { Area, BotaoPrimario, BotaoSecundario, Campo, Cartao, Erro, useDados } from './ui.jsx';

const VARIAVEIS = {
  telegram: ['TELEGRAM_BOT_TOKEN'],
  whatsapp: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'],
  instagram: ['INSTAGRAM_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_VERIFY_TOKEN', 'INSTAGRAM_APP_SECRET'],
};

function Copiar({ texto }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* sem permissão para a área de transferência */
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      aria-label="Copiar endereço"
      className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-line/70 hover:text-ink"
    >
      {copiado ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function FormNegocio({ inicial, avisar }) {
  const [dados, setDados] = useState({
    nome: inicial.nome,
    boas_vindas: inicial.boas_vindas,
    mensagem_humano: inicial.mensagem_humano,
    mensagem_falha: inicial.mensagem_falha,
  });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      await api.guardarNegocio(dados);
      avisar('Textos guardados');
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cartao titulo="Textos do bot" texto="O que o bot diz nas saudações, quando chama a equipa e quando não percebe.">
      <form onSubmit={guardar} className="space-y-4 p-5">
        <Campo rotulo="Nome do negócio" obrigatorio value={dados.nome} onChange={mudar('nome')} />
        <Area
          rotulo="Saudação"
          ajuda="Vem antes da lista de opções do menu."
          value={dados.boas_vindas}
          onChange={mudar('boas_vindas')}
        />
        <Area rotulo="Quando passa para a equipa" value={dados.mensagem_humano} onChange={mudar('mensagem_humano')} />
        <Area
          rotulo="Quando não percebe"
          ajuda="Depois de três mensagens seguidas que não percebe, o bot passa a conversa à equipa."
          value={dados.mensagem_falha}
          onChange={mudar('mensagem_falha')}
        />
        <Erro>{erro}</Erro>
        <div className="flex justify-end">
          <BotaoPrimario type="submit" disabled={ocupado}>
            Guardar
          </BotaoPrimario>
        </div>
      </form>
    </Cartao>
  );
}

export default function Definicoes({ avisar }) {
  const negocio = useDados(() => api.negocio(), []);
  const canais = useDados(() => api.canais(), []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        {negocio.dados ? (
          <FormNegocio inicial={negocio.dados} avisar={avisar} />
        ) : (
          <div className="h-96 animate-pulse rounded-2xl border border-line bg-line/40" />
        )}
      </div>

      <div className="min-w-0">
        <Cartao
          titulo="Canais"
          texto="As chaves ficam no ficheiro .env do servidor, nunca nesta página."
          acao={
            <BotaoSecundario className="px-3 py-2" onClick={canais.recarregar}>
              Verificar
            </BotaoSecundario>
          }
        >
          <ul className="divide-y divide-line">
            {canais.dados?.map((c) => (
              <li key={c.nome} className="space-y-2.5 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: CANAIS[c.nome].cor }} />
                  <h3 className="font-medium">{c.rotulo}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.configurado ? 'bg-brand-soft text-brand' : 'bg-line text-muted'
                    }`}
                  >
                    {c.configurado ? 'Ligado' : 'Por configurar'}
                  </span>
                  {c.configurado && c.nome === 'telegram' && (
                    <span className="text-xs text-muted">{c.modo === 'polling' ? 'sem URL pública' : 'webhook'}</span>
                  )}
                </div>

                {!c.configurado && (
                  <p className="text-sm text-muted">
                    Preenche no <code className="rounded bg-line/70 px-1">.env</code>:{' '}
                    {VARIAVEIS[c.nome].map((v, i) => (
                      <span key={v}>
                        {i > 0 && ', '}
                        <code className="rounded bg-line/70 px-1 text-xs">{v}</code>
                      </span>
                    ))}
                  </p>
                )}

                {(c.nome !== 'telegram' || c.modo === 'webhook') && (
                  <div className="flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5">
                    <code className="min-w-0 flex-1 truncate text-xs text-muted">
                      {BASE}
                      {c.webhook}
                    </code>
                    <Copiar texto={`${BASE}${c.webhook}`} />
                  </div>
                )}
              </li>
            ))}
            <li className="space-y-1 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: CANAIS.simulador.cor }} />
                <h3 className="font-medium">Simulador</h3>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Sempre ligado</span>
              </div>
              <p className="text-sm text-muted">Para experimentar o bot sem contas nas redes.</p>
            </li>
          </ul>
        </Cartao>
      </div>
    </div>
  );
}
