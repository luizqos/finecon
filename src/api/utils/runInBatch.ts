/**
 * Utilitário: Processa em lotes para manter o Event Loop livre para o polling de progresso.
 */
export async function executarEmLotes<T>(data: T[], batchSize: number, callback: (item: T) => void) {
  for (let i = 0; i < data.length; i += batchSize) {
    const lote = data.slice(i, i + batchSize);
    lote.forEach(callback);
    await new Promise(resolve => setImmediate(resolve));
  }
}