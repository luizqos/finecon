/**
 * Valida se as variáveis de ambiente obrigatórias estão presentes.
 * Lança um erro descritivo caso alguma falte.
 */
const validateEnv = () => {
  const requiredEnvs = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_FILENAME_OUTPUT: process.env.API_FILENAME_OUTPUT
  };

  const missing = Object.entries(requiredEnvs)
    .filter(([value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `❌ Variáveis de ambiente faltando: ${missing.join(", ")}. 
      Verifique o arquivo .env.local ou as configurações do servidor.`
    );
  }

  return requiredEnvs as Record<keyof typeof requiredEnvs, string>;
};

export const ENV = validateEnv();