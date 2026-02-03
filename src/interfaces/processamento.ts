import { Pendencia } from "./pendencia";

export interface ProcessamentoRes {
  success: boolean;
  message?: string;
  pendencias: Pendencia[];
  jd_sheet: {
    C: { qtd: number; val: number };
    D: { qtd: number; val: number };
  };
}
