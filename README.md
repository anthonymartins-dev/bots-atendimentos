# Bots de Atendimento

Um assistente que responde às perguntas frequentes dos clientes no **Telegram**, **WhatsApp** e
**Instagram**, e passa a conversa a uma pessoa quando é preciso. Tudo fica numa caixa de entrada
única, e há um simulador para experimentar sem contas nas redes. Projeto 6 de uma série de 6
ferramentas para pequenos negócios.

## Funcionalidades

- **Caixa de entrada única** com as conversas dos três canais, pesquisa, filtros e contagem de mensagens por ler
- **Bot de perguntas frequentes:** responde por palavras-chave (sem contar acentos nem maiúsculas) ou pelo número de uma opção do menu
- **Passagem para a equipa:** o cliente escreve "humano", o bot não percebe três vezes seguidas, ou o cliente envia uma fotografia ou áudio. Uma pessoa responde na caixa de entrada e o bot cala-se nessa conversa
- **Respostas editáveis** na interface, com um campo para experimentar o que o bot diria
- **Simulador** que usa o mesmo caminho das mensagens reais, para demonstrar o projeto sem nenhuma conta
- Painel com conversas abertas, à espera da equipa, mensagens do dia e percentagem de respostas dadas pelo bot
- Apagar uma conversa remove o cliente e as mensagens (pedidos de remoção de dados)

### Regras de negócio

- Cada mensagem é processada **uma só vez**, mesmo que a Meta ou o Telegram a reenviem
- Se o envio de uma resposta falhar (chave errada, rede em baixo), a mensagem fica registada como não enviada e a equipa vê-o na conversa
- Uma conversa fechada reabre sozinha, com o bot, quando o cliente volta a escrever
- Cada rede tem o seu limite de tamanho: as respostas são cortadas para caber (Instagram 1000, Telegram e WhatsApp 4096 caracteres)

## Como funciona

```
Telegram ─┐                                   ┌─ PostgreSQL (conversas, mensagens)
WhatsApp ─┼─> webhook ─> receber() ─> bot.js ─┤
Instagram ┘     │                             └─ responder() ─> mesma rede
                └ assinatura verificada
```

- **`bot.js`** decide a resposta. É uma função pura, sem rede nem base de dados, e por isso fácil de testar
- **`canais/`** tem um ficheiro por rede, todos com o mesmo molde (`configurado`, `enviar`, `extrair`). O resto da aplicação não sabe nada sobre cada rede
- **`servico.js`** guarda a mensagem, chama o bot e envia a resposta

### Segurança

- Os webhooks da Meta só aceitam pedidos com a **assinatura HMAC-SHA256** correta (segredo da app); o do Telegram exige o segredo no cabeçalho. Pedidos sem ela recebem 401 e nada é processado
- Um canal sem chaves configuradas responde 503 ao webhook em vez de aceitar tudo
- As chaves ficam só no `.env` do servidor (ignorado pelo Git); a interface nunca as vê
- Os erros de envio não incluem o endereço do pedido, porque nos pedidos do Telegram o token faz parte dele
- Comparações de segredos em tempo constante

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React 19, Vite, Tailwind CSS 4 |
| API | Node.js, Express 5 (REST), `fetch` nativo |
| Base de dados | PostgreSQL |

## Como correr

Requisitos: Node.js 20+ e PostgreSQL 15+.

```bash
# 1. Base de dados
createdb bots_atendimento
psql -d bots_atendimento -f server/db/schema.sql
psql -d bots_atendimento -f server/db/seed.sql   # dados de demonstração (opcional)

# 2. API
cd server
cp .env.example .env     # ajusta o utilizador e a palavra-passe
npm install
npm start                # http://localhost:3006

# 3. Interface (noutro terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

Sem mais nenhuma configuração, o **Simulador** já funciona.

## Ligar os canais

As chaves vão no `server/.env` (veja `.env.example`). O separador Definições mostra o que falta.

### Telegram (o mais simples)

1. No Telegram, fala com o **@BotFather**, envia `/newbot` e copia o token
2. Põe-no em `TELEGRAM_BOT_TOKEN` e reinicia o servidor
3. Pronto: sem URL pública, o servidor vai buscar as mensagens (polling). Escreve ao teu bot

Em produção, com `TELEGRAM_MODO=webhook`, define `TELEGRAM_WEBHOOK_SECRET` e regista o webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://o-teu-dominio/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### WhatsApp (Cloud API da Meta)

1. Em developers.facebook.com cria uma app com o produto **WhatsApp**
2. Copia o token de acesso, o ID do número de telefone e o **segredo da app** para `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_APP_SECRET`
3. Inventa um `WHATSAPP_VERIFY_TOKEN` (qualquer texto)
4. Em Configuração do WhatsApp, define o webhook `https://o-teu-dominio/webhooks/whatsapp`, com esse token de verificação, e subscreve o campo `messages`

### Instagram (mensagens diretas)

Igual ao WhatsApp, com `INSTAGRAM_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_VERIFY_TOKEN` e
`INSTAGRAM_APP_SECRET`, e o webhook `https://o-teu-dominio/webhooks/instagram`. A conta tem de ser
profissional e estar ligada à app.

### URL pública no teu computador

A Meta precisa de um endereço HTTPS. Para experimentar localmente, expõe a porta 3006 com um túnel
(por exemplo `cloudflared tunnel --url http://localhost:3006` ou `ngrok http 3006`).

## Testes

```bash
cd server
npm test           # 14 testes da lógica do bot
npm run test:e2e   # 34 verificações de ponta a ponta
```

O teste de ponta a ponta arranca a API com um **servidor falso das redes** e envia pedidos
assinados: verificação do webhook, assinaturas erradas, mensagens repetidas, passagem para a
equipa, falhas de envio, e os três canais. Não precisa de contas reais, mas também não substitui
um teste final com elas.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/resumo`, `/canais` | Números do painel e estado dos canais |
| GET | `/conversas` | Lista (`?estado=&canal=&q=`) |
| GET, DELETE | `/conversas/:id` | Abre (marca como lida) e apaga com os dados do cliente |
| POST | `/conversas/:id/mensagens` | Uma pessoa responde (o bot deixa de intervir) |
| PUT | `/conversas/:id/estado` | `bot`, `humano` ou `fechada` |
| GET, POST | `/respostas` | Perguntas frequentes |
| PUT, DELETE | `/respostas/:id` | Edita e apaga |
| POST | `/respostas/testar` | O que o bot responderia, sem enviar nada |
| GET, PUT | `/negocio` | Textos do bot |
| POST | `/simulador/mensagem` | Mensagem de um cliente de teste |
| GET, POST | `/webhooks/whatsapp`, `/webhooks/instagram` | Webhooks da Meta |
| POST | `/webhooks/telegram` | Webhook do Telegram |

## Estrutura

```
bots-atendimento/
  client/   interface React
  server/
    bot.js        lógica de decisão do bot
    servico.js    receber e responder a mensagens
    canais/       Telegram, WhatsApp, Instagram e simulador
    db/           esquema e dados de demonstração
    test/         testes da lógica do bot
    scripts/      teste de ponta a ponta
```
