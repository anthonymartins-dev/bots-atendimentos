import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import {
  Area,
  BotaoPrimario,
  BotaoSecundario,
  Campo,
  Cartao,
  Confirmar,
  Erro,
  IconeBotao,
  Modal,
  Vazio,
  classeInput,
  useDados,
} from './ui.jsx';

function RespostaForm({ resposta, aoGuardar, aoFechar }) {
  const [dados, setDados] = useState({
    titulo: resposta?.titulo ?? '',
    palavras: (resposta?.palavras_chave ?? []).join(', '),
    resposta: resposta?.resposta ?? '',
    no_menu: resposta?.no_menu ?? true,
    ativa: resposta?.ativa ?? true,
  });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });

  async function submeter(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    const corpo = { titulo: dados.titulo, palavras_chave: dados.palavras, resposta: dados.resposta, no_menu: dados.no_menu, ativa: dados.ativa };
    try {
      if (resposta) await api.editarResposta(resposta.id, corpo);
      else await api.criarResposta(corpo);
      await aoGuardar();
    } catch (err) {
      setErro(err.message);
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={resposta ? 'Editar resposta' : 'Nova resposta'} largura="max-w-lg" aoFechar={aoFechar}>
      <form onSubmit={submeter} className="space-y-4">
        <Campo
          rotulo="Título"
          obrigatorio
          ajuda="É o nome que aparece no menu."
          value={dados.titulo}
          onChange={mudar('titulo')}
          autoFocus
        />
        <Campo
          rotulo="Palavras-chave"
          ajuda="Separadas por vírgulas. O bot responde quando o cliente escreve uma delas (sem contar acentos nem maiúsculas)."
          placeholder="horário, aberto, que horas"
          value={dados.palavras}
          onChange={mudar('palavras')}
        />
        <Area rotulo="Resposta" rows={5} value={dados.resposta} onChange={mudar('resposta')} />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dados.no_menu}
              onChange={(e) => setDados({ ...dados, no_menu: e.target.checked })}
              className="size-4 accent-brand"
            />
            Aparece no menu
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dados.ativa}
              onChange={(e) => setDados({ ...dados, ativa: e.target.checked })}
              className="size-4 accent-brand"
            />
            Ativa
          </label>
        </div>
        <Erro>{erro}</Erro>
        <div className="flex justify-end gap-2 pt-1">
          <BotaoSecundario type="button" onClick={aoFechar}>
            Cancelar
          </BotaoSecundario>
          <BotaoPrimario type="submit" disabled={ocupado}>
            Guardar
          </BotaoPrimario>
        </div>
      </form>
    </Modal>
  );
}

const RESULTADOS = {
  resposta: 'Responde com esta resposta',
  menu: 'Mostra o menu (saudação)',
  falha: 'Não percebe e mostra o menu',
  humano: 'Passa a conversa para a equipa',
};

function Testar() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function testar(e) {
    e.preventDefault();
    setErro('');
    try {
      setResultado(await api.testarResposta(texto));
    } catch (err) {
      setResultado(null);
      setErro(err.message);
    }
  }

  return (
    <Cartao titulo="Experimentar" texto="Vê o que o bot responderia, sem enviar nada a ninguém.">
      <form onSubmit={testar} className="flex gap-2 p-5 pb-3">
        <input
          className={classeInput}
          placeholder="Escreve como um cliente: Fazem entregas?"
          aria-label="Mensagem de teste"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <BotaoSecundario type="submit">Testar</BotaoSecundario>
      </form>
      <div className="px-5 pb-5">
        <Erro>{erro}</Erro>
        {resultado && (
          <div className="mt-1">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{RESULTADOS[resultado.tipo]}</p>
            <div className="rounded-2xl rounded-bl-md bg-brand-soft px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap">
              {resultado.texto}
            </div>
          </div>
        )}
      </div>
    </Cartao>
  );
}

export default function Respostas({ avisar }) {
  const { dados, erro, recarregar } = useDados(() => api.respostas(), []);
  const [form, setForm] = useState(null);
  const [apagar, setApagar] = useState(null);

  if (erro && !dados) return <p className="text-danger">{erro}</p>;
  if (!dados) return <div className="h-96 animate-pulse rounded-2xl border border-line bg-line/40" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            O bot procura estas palavras na mensagem do cliente. Quem escreve o número de uma opção do menu recebe essa resposta.
          </p>
          <BotaoPrimario className="shrink-0" onClick={() => setForm({})}>
            <Plus size={16} /> Nova resposta
          </BotaoPrimario>
        </div>

        {dados.length === 0 ? (
          <Vazio titulo="Sem respostas" texto="Cria a primeira pergunta frequente para o bot responder." />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {dados.map((r) => (
              <li key={r.id} className={`flex items-start gap-3 border-b border-line px-5 py-4 last:border-b-0 ${r.ativa ? '' : 'opacity-55'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{r.titulo}</h3>
                    {r.no_menu && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">No menu</span>}
                    {!r.ativa && <span className="rounded-full bg-line px-2 py-0.5 text-xs font-medium text-muted">Desativada</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{r.resposta}</p>
                  {r.palavras_chave.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {r.palavras_chave.slice(0, 8).map((p) => (
                        <span key={p} className="rounded-md bg-line/70 px-1.5 py-0.5 text-xs text-muted">
                          {p}
                        </span>
                      ))}
                      {r.palavras_chave.length > 8 && (
                        <span className="py-0.5 text-xs text-muted">+{r.palavras_chave.length - 8}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0">
                  <IconeBotao rotulo="Editar" onClick={() => setForm(r)}>
                    <Pencil size={15} />
                  </IconeBotao>
                  <IconeBotao rotulo="Apagar" perigo onClick={() => setApagar(r)}>
                    <Trash2 size={15} />
                  </IconeBotao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <Testar />
      </div>

      {form && (
        <RespostaForm
          resposta={form.id ? form : null}
          aoGuardar={async () => {
            setForm(null);
            avisar('Resposta guardada');
            await recarregar();
          }}
          aoFechar={() => setForm(null)}
        />
      )}
      {apagar && (
        <Confirmar
          titulo="Apagar resposta?"
          texto={`O bot deixa de responder a "${apagar.titulo}". Se só queres pô-la em pausa, desativa-a ao editar.`}
          rotulo="Apagar"
          aoConfirmar={async () => {
            await api.apagarResposta(apagar.id);
            setApagar(null);
            avisar('Resposta apagada');
            await recarregar();
          }}
          aoFechar={() => setApagar(null)}
        />
      )}
    </div>
  );
}
