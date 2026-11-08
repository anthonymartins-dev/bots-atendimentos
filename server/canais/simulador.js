// Canal de teste: não fala com nenhuma rede, só guarda as mensagens.
// Serve para experimentar o bot sem contas do Telegram, WhatsApp ou Instagram.
module.exports = {
  nome: 'simulador',
  rotulo: 'Simulador',
  limite: 4096,
  configurado: () => true,
  enviar: async () => 'simulado',
};
