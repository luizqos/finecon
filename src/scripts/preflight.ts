import fs from 'fs';
import path from 'path';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_API_FILENAME_OUTPUT'
];

function runPreflight() {
  console.log('🚀 Iniciando Pre-flight Check...');
  
  // process.cwd() garante que buscaremos na raiz do projeto, independente de estar em /src
  const envPath = path.resolve(process.cwd(), '.env.local');

  // 1. Verifica se o arquivo .env.local existe na raiz
  if (!fs.existsSync(envPath)) {
    console.error('❌ ERRO CRÍTICO: Arquivo .env.local não encontrado na raiz do projeto!');
    console.error('Certifique-se de que o arquivo existe antes de iniciar o servidor.');
    process.exit(1);
  }

  // 2. Valida o conteúdo das variáveis
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const missingVars = REQUIRED_ENV_VARS.filter(v => {
    // Regex para verificar se a variável está definida e tem um valor
    const regex = new RegExp(`^${v}=.+`, 'm');
    return !regex.test(envContent);
  });

  if (missingVars.length > 0) {
    console.error('❌ ERRO: As seguintes variáveis de ambiente não foram configuradas:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log('✅ Validação de ambiente concluída com sucesso!');
}

runPreflight();