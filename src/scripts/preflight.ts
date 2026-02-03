import fs from 'fs';
import path from 'path';
import pino from 'pino';
const logger = pino();

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_API_FILENAME_OUTPUT'
];

function runPreflight() {
  logger.info('🚀 Iniciando Pre-flight Check...');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    logger.error('❌ ERRO CRÍTICO: Arquivo .env.local não encontrado na raiz do projeto!');
    logger.error('Certifique-se de que o arquivo existe antes de iniciar o servidor.');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const missingVars = REQUIRED_ENV_VARS.filter(v => {
    const regex = new RegExp(`^${v}=.+`, 'm');
    return !regex.test(envContent);
  });

  if (missingVars.length > 0) {
    logger.error('❌ ERRO: As seguintes variáveis de ambiente não foram configuradas:');
    missingVars.forEach(v => logger.error(`   - ${v}`));
    process.exit(1);
  }

  logger.info('✅ Validação de ambiente concluída com sucesso!');
}

runPreflight();