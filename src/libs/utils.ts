export const limparTexto = (txt: string) => 
  txt.replace(/\xEF\xBB\xBF/g, '').trim().toUpperCase();

export const formatarValor = (v: string | number) => {
  if (typeof v === 'number') return v;
  const clean = v.replace(/[.\s]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

export const fmtCur = (v: number) => 
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (v: number) => v.toLocaleString('pt-BR');