-- Bots de Atendimento: esquema PostgreSQL.
-- Pode ser corrido mais do que uma vez sem estragar nada.

-- Uma única linha: os textos do negócio que o bot usa.
CREATE TABLE IF NOT EXISTS negocio (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome             TEXT NOT NULL,
  boas_vindas      TEXT NOT NULL,
  mensagem_humano  TEXT NOT NULL,
  mensagem_falha   TEXT NOT NULL
);

-- Perguntas frequentes: se a mensagem tiver uma das palavras-chave, o bot envia a resposta.
CREATE TABLE IF NOT EXISTS respostas (
  id              SERIAL PRIMARY KEY,
  titulo          TEXT NOT NULL CHECK (btrim(titulo) <> ''),
  palavras_chave  TEXT[] NOT NULL DEFAULT '{}',
  resposta        TEXT NOT NULL CHECK (btrim(resposta) <> ''),
  no_menu         BOOLEAN NOT NULL DEFAULT TRUE,
  ativa           BOOLEAN NOT NULL DEFAULT TRUE,
  ordem           INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contactos (
  id          SERIAL PRIMARY KEY,
  canal       TEXT NOT NULL CHECK (canal IN ('telegram', 'whatsapp', 'instagram', 'simulador')),
  externo_id  TEXT NOT NULL,
  nome        TEXT NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (canal, externo_id)
);

-- Uma conversa por contacto. `estado` diz quem responde: o bot ou uma pessoa.
CREATE TABLE IF NOT EXISTS conversas (
  id               SERIAL PRIMARY KEY,
  contacto_id      INT NOT NULL UNIQUE REFERENCES contactos(id) ON DELETE CASCADE,
  estado           TEXT NOT NULL DEFAULT 'bot' CHECK (estado IN ('bot', 'humano', 'fechada')),
  nao_lidas        INT NOT NULL DEFAULT 0,
  falhas_seguidas  INT NOT NULL DEFAULT 0,
  ultima_em        TIMESTAMP NOT NULL DEFAULT NOW(),
  criado_em        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- `externo_id` é o identificador da mensagem na rede; o índice único impede
-- processar duas vezes a mesma mensagem quando a Meta ou o Telegram reenviam.
CREATE TABLE IF NOT EXISTS mensagens (
  id          SERIAL PRIMARY KEY,
  conversa_id INT NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  origem      TEXT NOT NULL CHECK (origem IN ('cliente', 'bot', 'humano')),
  texto       TEXT NOT NULL,
  externo_id  TEXT UNIQUE,
  envio       TEXT CHECK (envio IN ('ok', 'simulado', 'falhou')),
  erro        TEXT,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mensagens_conversa_idx ON mensagens (conversa_id, id);
CREATE INDEX IF NOT EXISTS conversas_ultima_idx ON conversas (ultima_em DESC);

CREATE OR REPLACE VIEW conversas_v AS
SELECT
  c.*,
  k.canal,
  k.nome,
  (SELECT m.texto  FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima_texto,
  (SELECT m.origem FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima_origem
FROM conversas c JOIN contactos k ON k.id = c.contacto_id;
