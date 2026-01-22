export const progress: Record<string, { porcentagem: number; linhas: number; etapa: string }> = {};

/**
 * Helper: Atualiza o status global.
 */

export function atualizarStatus(taskId: string, porcentagem: number, linhas: number, etapa: string) {
  if (progress[taskId]) {
    progress[taskId] = { porcentagem, linhas, etapa };
  }
}
