// Cria as tabelas e carrega os dados de demonstração na base indicada por DATABASE_URL.
//   npm run db:preparar            só cria o que falta (não apaga nada)
//   npm run db:preparar -- --repor apaga TUDO nessa base e recarrega a demonstração
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta a variável DATABASE_URL');
  const repor = process.argv.includes('--repor');
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    if (repor) {
      await cliente.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('Dados antigos apagados.');
    }
    for (const ficheiro of ['schema.sql', 'seed.sql']) {
      await cliente.query(fs.readFileSync(path.join(__dirname, ficheiro), 'utf8'));
      console.log(`${ficheiro} aplicado.`);
    }
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error('Erro:', erro.message);
  process.exit(1);
});
