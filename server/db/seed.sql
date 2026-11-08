-- Dados de demonstração (uma loja de plantas). Só corre se a base estiver vazia.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM negocio) THEN
    RETURN;
  END IF;

  INSERT INTO negocio (nome, boas_vindas, mensagem_humano, mensagem_falha) VALUES (
    'Casa Verde',
    'Olá! Sou o assistente da Casa Verde. Em que posso ajudar?',
    'Já avisei a equipa. Uma pessoa responde-te assim que possível, normalmente no mesmo dia útil.',
    'Não percebi bem a tua pergunta.');

  INSERT INTO respostas (titulo, palavras_chave, resposta, no_menu, ordem) VALUES
    ('Horário de funcionamento', '{horario,horarios,aberto,abertos,abre,fecha,"que horas"}',
     'Estamos abertos de segunda a sábado, das 9h às 19h. Ao domingo estamos fechados.', TRUE, 1),
    ('Morada', '{morada,onde,localizacao,"como chegar"}',
     'Ficamos na Rua das Flores, 25, no Porto. Há estacionamento à porta.', TRUE, 2),
    ('Entregas', '{entrega,entregas,envio,enviam,portes,transporte}',
     'Entregamos em todo o país em 2 a 4 dias úteis. Os portes são grátis acima de 40 €; abaixo disso custam 4,50 €.', TRUE, 3),
    ('Pagamentos', '{pagamento,pagamentos,pagar,mbway,"mb way",multibanco,cartao,paypal}',
     'Aceitamos MB Way, cartão e transferência bancária. Na loja também aceitamos numerário.', TRUE, 4),
    ('Trocas e devoluções', '{devolucao,devolver,troca,trocar,garantia,reembolso}',
     'Podes devolver até 14 dias depois de receberes a encomenda, desde que o artigo esteja em bom estado. Se a planta chegar danificada, envia-nos uma fotografia e trocamos sem custos.', TRUE, 5),
    ('Encomendas', '{encomenda,encomendar,reservar,reserva,comprar}',
     'Para encomendar, diz-nos os artigos e a quantidade. A equipa confirma a disponibilidade e envia o pedido de pagamento.', TRUE, 6),
    ('Preços', '{preco,precos,quanto,custa,custam,valor}',
     'Os preços dependem da planta e do vaso. Diz-nos o que procuras e a equipa envia os valores.', FALSE, 7),
    ('Cuidados com as plantas', '{rega,regar,cuidados,sol,luz,"folhas amarelas"}',
     'Regra geral: rega quando a terra estiver seca ao toque e evita o sol direto nas folhas. Diz-nos qual é a planta e a equipa dá dicas mais específicas.', FALSE, 8),
    ('Agradecimento', '{obrigado,obrigada,agradecido,valeu}',
     'De nada! Se precisares de mais alguma coisa, é só escrever.', FALSE, 9);

  INSERT INTO contactos (id, canal, externo_id, nome) VALUES
    (1, 'telegram',  '100200301', 'Joana Ribeiro'),
    (2, 'whatsapp',  '351912345678', 'Carlos Mendes'),
    (3, 'instagram', '17841400000001', 'ana.vasconcelos'),
    (4, 'whatsapp',  '351934567890', 'Sofia Lopes'),
    (5, 'telegram',  '100200305', 'Miguel Pinto');
  PERFORM setval('contactos_id_seq', 5);

  INSERT INTO conversas (id, contacto_id, estado, nao_lidas, falhas_seguidas, ultima_em) VALUES
    (1, 1, 'bot',     0, 0, NOW() - INTERVAL '35 minutes'),
    (2, 2, 'humano',  1, 0, NOW() - INTERVAL '12 minutes'),
    (3, 3, 'bot',     0, 0, NOW() - INTERVAL '3 hours'),
    (4, 4, 'fechada', 0, 0, NOW() - INTERVAL '1 day'),
    (5, 5, 'bot',     1, 1, NOW() - INTERVAL '2 hours');
  PERFORM setval('conversas_id_seq', 5);

  INSERT INTO mensagens (conversa_id, origem, texto, envio, criado_em) VALUES
    (1, 'cliente', 'Boa tarde', NULL, NOW() - INTERVAL '37 minutes'),
    (1, 'bot', E'Olá! Sou o assistente da Casa Verde. Em que posso ajudar?\n\n1. Horário de funcionamento\n2. Morada\n3. Entregas\n4. Pagamentos\n5. Trocas e devoluções\n6. Encomendas\n\nEscreve o número ou a tua pergunta. Para falar com uma pessoa, escreve "humano".', 'simulado', NOW() - INTERVAL '37 minutes'),
    (1, 'cliente', 'Fazem entregas para Lisboa?', NULL, NOW() - INTERVAL '35 minutes'),
    (1, 'bot', 'Entregamos em todo o país em 2 a 4 dias úteis. Os portes são grátis acima de 40 €; abaixo disso custam 4,50 €.', 'simulado', NOW() - INTERVAL '35 minutes'),

    (2, 'cliente', 'A minha jiboia tem folhas amarelas, o que faço?', NULL, NOW() - INTERVAL '40 minutes'),
    (2, 'bot', 'Regra geral: rega quando a terra estiver seca ao toque e evita o sol direto nas folhas. Diz-nos qual é a planta e a equipa dá dicas mais específicas.', 'simulado', NOW() - INTERVAL '40 minutes'),
    (2, 'cliente', 'Quero falar com uma pessoa', NULL, NOW() - INTERVAL '25 minutes'),
    (2, 'bot', 'Já avisei a equipa. Uma pessoa responde-te assim que possível, normalmente no mesmo dia útil.', 'simulado', NOW() - INTERVAL '25 minutes'),
    (2, 'cliente', 'Podem ver uma fotografia da planta?', NULL, NOW() - INTERVAL '12 minutes'),

    (3, 'cliente', 'Quanto custa a monstera?', NULL, NOW() - INTERVAL '3 hours 5 minutes'),
    (3, 'bot', 'Os preços dependem da planta e do vaso. Diz-nos o que procuras e a equipa envia os valores.', 'simulado', NOW() - INTERVAL '3 hours 5 minutes'),
    (3, 'cliente', 'obrigada!', NULL, NOW() - INTERVAL '3 hours'),
    (3, 'bot', 'De nada! Se precisares de mais alguma coisa, é só escrever.', 'simulado', NOW() - INTERVAL '3 hours'),

    (4, 'cliente', 'Qual é o horário?', NULL, NOW() - INTERVAL '1 day 1 hour'),
    (4, 'bot', 'Estamos abertos de segunda a sábado, das 9h às 19h. Ao domingo estamos fechados.', 'simulado', NOW() - INTERVAL '1 day 1 hour'),
    (4, 'cliente', 'Obrigada!', NULL, NOW() - INTERVAL '1 day'),
    (4, 'bot', 'De nada! Se precisares de mais alguma coisa, é só escrever.', 'simulado', NOW() - INTERVAL '1 day'),

    (5, 'cliente', 'asdfgh', NULL, NOW() - INTERVAL '2 hours'),
    (5, 'bot', E'Não percebi bem a tua pergunta.\n\n1. Horário de funcionamento\n2. Morada\n3. Entregas\n4. Pagamentos\n5. Trocas e devoluções\n6. Encomendas\n\nEscreve o número ou a tua pergunta. Para falar com uma pessoa, escreve "humano".', 'simulado', NOW() - INTERVAL '2 hours');
END $$;
