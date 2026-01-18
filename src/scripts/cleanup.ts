import fs from 'fs';
import path from 'path';

// Configuração: Apagar arquivos com mais de 1 hora (em milissegundos)
const MAX_AGE_MS = 60 * 60 * 1000; 
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

async function cleanOldFiles() {
  console.log(`🧹 [${new Date().toLocaleString()}] Iniciando limpeza em: ${UPLOADS_DIR}`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('⚠️ Pasta de uploads não encontrada. Pulando...');
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  const now = Date.now();
  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(UPLOADS_DIR, file);
    
    // Ignora o arquivo .gitkeep se existir
    if (file === '.gitkeep') return;

    try {
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️ Removido: ${file} (Idade: ${Math.round(age / 60000)} min)`);
      }
    } catch (err) {
      console.error(`❌ Erro ao processar arquivo ${file}:`, err);
    }
  });

  console.log(`✅ Limpeza concluída. ${deletedCount} arquivos removidos.`);
}

// Executa se chamado diretamente
if (require.main === module) {
  cleanOldFiles();
}

export { cleanOldFiles };