import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino();

const MAX_AGE_MINUTES = Number(process.env.CLEANUP_MAX_AGE_MINUTES) || 60;
const MAX_AGE_MS = MAX_AGE_MINUTES * 60 * 1000;

const CHECK_INTERVAL_MINUTES = Number(process.env.CLEANUP_INTERVAL_MINUTES) || 30;
const CHECK_INTERVAL_MS = CHECK_INTERVAL_MINUTES * 60 * 1000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

async function cleanOldFiles() {
  logger.info(`🧹 [${new Date().toLocaleString()}] Iniciando limpeza. Alvo: arquivos com +${MAX_AGE_MINUTES}min`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    logger.warn('⚠️ Pasta de uploads não encontrada. Pulando...');
    return;
  }

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      if (file === '.gitkeep') return;

      const filePath = path.join(UPLOADS_DIR, file);
      
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Removido: ${file} (Idade: ${Math.round(age / 60000)} min)`);
        }
      } catch (err) {
        logger.error(`❌ Erro ao processar arquivo ${file}: ${err}`);
      }
    });

    logger.info(`✅ Limpeza concluída. ${deletedCount} arquivos removidos.`);
  } catch (err) {
    logger.error(`❌ Erro ao ler diretório: ${err}`);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || require.main === module) {
  cleanOldFiles();

  setInterval(() => {
    cleanOldFiles();
  }, CHECK_INTERVAL_MS);

  logger.info(`🚀 Monitor de limpeza ativo! Verificação a cada ${CHECK_INTERVAL_MINUTES} minutos.`);
}

export { cleanOldFiles };