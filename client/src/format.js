const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const p2 = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export const iniciais = (nome = '') =>
  nome.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export function diaDe(ts) {
  const dia = ts.slice(0, 10);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (dia === isoLocal(hoje)) return 'Hoje';
  if (dia === isoLocal(ontem)) return 'Ontem';
  const [, m, d] = dia.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export const hora = (ts) => ts.slice(11, 16);

/* Na lista: hora se for de hoje, senão "Ontem" ou a data. */
export const quandoCurto = (ts) => (diaDe(ts) === 'Hoje' ? hora(ts) : diaDe(ts));

export const CANAIS = {
  telegram: { texto: 'Telegram', cor: '#3b5a7a' },
  whatsapp: { texto: 'WhatsApp', cor: '#24493c' },
  instagram: { texto: 'Instagram', cor: '#a63a2b' },
  simulador: { texto: 'Simulador', cor: '#5c5a52' },
};

export const ESTADOS_CONVERSA = {
  bot: { texto: 'Bot', badge: 'bg-brand-soft text-brand' },
  humano: { texto: 'Equipa', badge: 'bg-warn-soft text-warn' },
  fechada: { texto: 'Fechada', badge: 'bg-line text-muted' },
};
