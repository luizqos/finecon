export const limparTexto = (txt: string): string => {
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

export const formatarData = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');

  return `${dd}${mm}${yyyy} ${HH}${MM}${SS}`;
};