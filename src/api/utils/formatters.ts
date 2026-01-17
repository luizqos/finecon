export const limparTexto = (txt: any): string => {
  if (txt === null || txt === undefined) return "";
  const str = String(txt);
  return str
    .replace(/\uFEFF/g, '')
    .replace(/"/g, '')
    .trim()
    .toUpperCase();
};

export const formatarValor = (v: string): number => {
  if (!v) return 0;
  const cleaned = v.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};
