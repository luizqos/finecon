import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino();

const MAX_AGE_MINUTES = Number(process.env.CLEANUP_MAX_AGE_MINUTES) || 60;
const MAX_AGE_MS = MAX_AGE_MINUTES * 60 * 1000;

const CHECK_INTERVAL_MINUTES = Number(process.env.CLEANUP_INTERVAL_MINUTES) || 30;
const CHECK_INTERVAL_MS = CHECK_INTERVAL_MINUTES * 60 * 1000;

const UPLOADS_DIR = process.env.CLEANUP_UPLOADS_DIR 
  ? path.resolve(process.env.CLEANUP_UPLOADS_DIR)
  : path.resolve(process.cwd(), 'uploads');

async function cleanOldFiles() {
  const nowStr = new Date().toLocaleString();
  logger.info(`🧹 [${nowStr}] Iniciando limpeza. Alvo: arquivos com +${MAX_AGE_MINUTES}min`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    logger.warn(`⚠️ Pasta não encontrada: ${UPLOADS_DIR}. Pulando...`);
    return;
  }

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const nowMs = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      if (file === '.gitkeep') return;

      const filePath = path.join(UPLOADS_DIR, file);
      
      try {
        const stats = fs.statSync(filePath);
        const age = nowMs - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Removido: ${file} (Idade: ${Math.round(age / 60000)} min)`);
        }
      } catch (err: any) {
        logger.error(`❌ Erro ao processar arquivo ${file}: ${err.message}`);
      }
    });

    logger.info(`✅ Limpeza concluída. ${deletedCount} arquivos removidos.`);
  } catch (err: any) {
    logger.error(`❌ Erro ao ler diretório: ${err.message}`);
  }
}

if (require.main === module) {
  cleanOldFiles();
  setInterval(() => {
    cleanOldFiles();
  }, CHECK_INTERVAL_MS);

  logger.info(`🚀 Monitor de limpeza ativo em loop (a cada ${CHECK_INTERVAL_MINUTES} min)`);
}

export { cleanOldFiles };