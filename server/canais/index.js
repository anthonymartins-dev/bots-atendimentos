const telegram = require('./telegram');
const whatsapp = require('./whatsapp');
const instagram = require('./instagram');
const simulador = require('./simulador');

// Todos os canais seguem o mesmo molde: { nome, limite, configurado(), enviar(), extrair() }.
// O resto da aplicação não sabe nada sobre cada rede.
module.exports = { telegram, whatsapp, instagram, simulador };
