import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Conversas from './components/Conversas.jsx';
import Definicoes from './components/Definicoes.jsx';
import Respostas from './components/Respostas.jsx';
import Simulador from './components/Simulador.jsx';
import { BotaoSecundario, useAtualizar, useDados } from './components/ui.jsx';

const SEPARADORES = [
  ['conversas', 'Conversas'],
  ['respostas', 'Respostas'],
  ['simulador', 'Simulador'],
  ['definicoes', 'Definições'],
];

function Numero({ valor, texto, alerta }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <p className={`num font-serif text-2xl font-semibold ${alerta ? 'text-warn' : ''}`}>{valor}</p>
      <p className="text-xs text-muted">{texto}</p>
    </div>
  );
}

export default function App() {
  const [separador, setSeparador] = useState('conversas');
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState('');
  const aoMudar = useCallback(() => setVersao((v) => v + 1), []);

  const resumo = useDados(() => api.resumo(), [versao]);
  useAtualizar(resumo.recarregar, 8);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 2800);
    return () => clearTimeout(t);
  }, [aviso]);

  const r = resumo.dados;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-brand uppercase">Atendimento automático</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Bots de atendimento</h1>
        </div>
        <nav className="flex gap-6 overflow-x-auto border-b border-line sm:border-0">
          {SEPARADORES.map(([chave, texto]) => (
            <button
              key={chave}
              onClick={() => setSeparador(chave)}
              className={`-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition sm:mb-0 ${
                separador === chave ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {texto}
            </button>
          ))}
        </nav>
      </header>

      {resumo.erro && !r ? (
        <div className="mt-8 rounded-2xl border border-line bg-card p-10 text-center">
          <p className="text-danger">Não foi possível ligar ao servidor. Confirma que a API está a correr.</p>
          <BotaoSecundario className="mt-4" onClick={resumo.recarregar}>
            Tentar de novo
          </BotaoSecundario>
        </div>
      ) : (
        <>
          {r && (
            <div className="mt-8 grid grid-cols-2 divide-line rounded-2xl border border-line bg-card sm:grid-cols-4 sm:divide-x">
              <Numero valor={r.abertas} texto="Conversas abertas" />
              <Numero valor={r.por_responder} texto="À espera da equipa" alerta={r.por_responder > 0} />
              <Numero valor={r.mensagens_hoje} texto="Mensagens hoje" />
              <Numero valor={`${r.bot_pct}%`} texto="Respostas dadas pelo bot" />
            </div>
          )}

          <main className="mt-6">
            {separador === 'conversas' ? (
              <Conversas versao={versao} aoMudar={aoMudar} avisar={setAviso} />
            ) : separador === 'respostas' ? (
              <Respostas avisar={setAviso} />
            ) : separador === 'simulador' ? (
              <Simulador aoMudar={aoMudar} />
            ) : (
              <Definicoes avisar={setAviso} />
            )}
          </main>
        </>
      )}

      {aviso && (
        <div className="animar fixed right-4 bottom-4 z-[60] rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  );
}
