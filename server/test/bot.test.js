const test = require('node:test');
const assert = require('node:assert/strict');
const { decidir, normalizar, cortar } = require('../bot');

const negocio = {
  boas_vindas: 'Olá! Sou o assistente.',
  mensagem_humano: 'Já avisei a equipa.',
  mensagem_falha: 'Não percebi.',
};

const regra = (id, titulo, palavras, extra = {}) => ({
  id, titulo, palavras_chave: palavras, resposta: `resposta ${titulo}`, no_menu: true, ativa: true, ordem: id, ...extra,
});

const regras = [
  regra(1, 'Horário', ['horario', 'aberto', 'que horas']),
  regra(2, 'Morada', ['morada', 'onde']),
  regra(3, 'Entregas', ['entrega', 'entregas', 'portes']),
  regra(4, 'Pagamentos', ['mb way', 'multibanco', 'pagar']),
  regra(5, 'Cuidados', ['sol', 'rega'], { no_menu: false }),
  regra(6, 'Antiga', ['promocao'], { ativa: false }),
];

const pergunta = (texto, falhasSeguidas = 0) => decidir({ texto, regras, negocio, falhasSeguidas });

test('normalizar tira acentos, pontuação e maiúsculas', () => {
  assert.equal(normalizar('  Qual é o HORÁRIO?! '), 'qual e o horario');
  assert.equal(normalizar(null), '');
});

test('saudação mostra o menu só com as regras ativas e visíveis no menu', () => {
  const r = pergunta('Boa tarde');
  assert.equal(r.tipo, 'menu');
  assert.match(r.texto, /1\. Horário/);
  assert.match(r.texto, /4\. Pagamentos/);
  assert.doesNotMatch(r.texto, /Cuidados|Antiga/);
});

test('"/start" do Telegram conta como saudação', () => {
  assert.equal(pergunta('/start').tipo, 'menu');
});

test('um número escolhe a opção do menu', () => {
  assert.equal(pergunta('3').texto, 'resposta Entregas');
});

test('um número fora do menu não é resposta', () => {
  assert.equal(pergunta('9').tipo, 'falha');
});

test('palavras-chave ignoram acentos e maiúsculas', () => {
  assert.equal(pergunta('Qual é o horário de hoje?').texto, 'resposta Horário');
});

test('palavras-chave com mais de uma palavra', () => {
  assert.equal(pergunta('Aceitam MB Way?').texto, 'resposta Pagamentos');
});

test('palavra inteira: "sol" não apanha "solução"', () => {
  assert.equal(pergunta('Preciso de uma solução').tipo, 'falha');
  assert.equal(pergunta('Dá muito sol?').texto, 'resposta Cuidados');
});

test('a pergunta ganha à saudação', () => {
  const r = pergunta('Boa tarde, fazem entregas?');
  assert.equal(r.tipo, 'resposta');
  assert.equal(r.texto, 'resposta Entregas');
});

test('regras desativadas são ignoradas', () => {
  assert.equal(pergunta('Têm promoção?').tipo, 'falha');
});

test('pedir uma pessoa passa a conversa para a equipa', () => {
  assert.equal(pergunta('Quero falar com uma pessoa').tipo, 'humano');
  assert.equal(pergunta('humano').texto, 'Já avisei a equipa.');
});

test('sem perceber, responde com o menu', () => {
  const r = pergunta('asdfgh');
  assert.equal(r.tipo, 'falha');
  assert.match(r.texto, /^Não percebi\./);
  assert.match(r.texto, /1\. Horário/);
});

test('à terceira falha seguida passa para uma pessoa', () => {
  assert.equal(pergunta('asdfgh', 1).tipo, 'falha');
  assert.equal(pergunta('asdfgh', 2).tipo, 'humano');
});

test('cortar respeita o limite de cada rede', () => {
  assert.equal(cortar('abc', 10), 'abc');
  assert.equal(cortar('abcdefghij', 5), 'abcd…');
});
