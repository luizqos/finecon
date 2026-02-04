/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, Key } from "react";
import { fmtCur, fmtNum } from "@/libs/utils";

interface ResultsSectionProps {
  res: any;
  metrics: any;
  dataRef: string;
  onOpenJira: () => void;
}

export function ResultsSection({ res, metrics, dataRef, onOpenJira }: ResultsSectionProps) {
  const [filterE2E, setFilterE2E] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterOri] = useState("");

  const filteredAudit = useMemo(() => {
    if (!res) return [];
    return res.pendencias.filter((p: any) => {
      const matchE2E = p.e2e.toUpperCase().includes(filterE2E.toUpperCase());
      const matchTipo = filterTipo === "" || p.tipo === filterTipo;
      const matchOri = filterOri === "" || p.falta === filterOri;
      return matchE2E && matchTipo && matchOri;
    });
  }, [res, filterE2E, filterTipo, filterOri]);

  const rows = [
    { label: "Crédito (Qtd)", jd: metrics.jd.qc, core: metrics.core.qc, diff: metrics.diff.qc, ref: res.jd_sheet.C.qtd, isCur: false },
    { label: "Crédito (Val)", jd: metrics.jd.vc, core: metrics.core.vc, diff: metrics.diff.vc, ref: res.jd_sheet.C.val, isCur: true },
    { label: "Débito (Qtd)", jd: metrics.jd.qd, core: metrics.core.qd, diff: metrics.diff.qd, ref: res.jd_sheet.D.qtd, isCur: false },
    { label: "Débito (Val)", jd: metrics.jd.vd, core: metrics.core.vd, diff: metrics.diff.vd, ref: res.jd_sheet.D.val, isCur: true },
  ];

  return (
    <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Resultado ({dataRef.split("-").reverse().join("/")})</h2>
          <button onClick={onOpenJira} className="bg-[#212529] text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2">
            🎫 JIRA
          </button>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded mb-8">
          <table className="w-full text-center border-collapse">
            <thead className="bg-[#212529] text-white text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Métrica</th>
                <th className="p-3">JD</th>
                <th className="p-3">Core</th>
                <th className="p-3">Diferença</th>
                <th className="p-3">Ref. JD</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-3 text-left font-bold bg-gray-50">{row.label}</td>
                  <td className="p-3">{row.isCur ? fmtCur(row.jd) : fmtNum(row.jd)}</td>
                  <td className="p-3">{row.isCur ? fmtCur(row.core) : fmtNum(row.core)}</td>
                  <td className={`p-3 font-bold ${Math.abs(row.diff) > 0.01 ? "text-red-600 bg-red-50" : ""}`}>
                    {row.isCur ? fmtCur(row.diff) : fmtNum(row.diff)}
                  </td>
                  <td className="p-3 text-gray-400 italic">{row.isCur ? fmtCur(row.ref) : fmtNum(row.ref)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <input placeholder="Filtrar ID..." className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" onChange={(e) => setFilterE2E(e.target.value)} />
          <select className="border border-gray-300 rounded px-3 py-2 text-sm" onChange={(e) => setFilterTipo(e.target.value)}>
            <option value="">Tipos</option>
            <option value="C">Crédito</option>
            <option value="D">Débito</option>
          </select>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#212529] text-white text-xs uppercase">
                <th className="p-3 text-left">E2E ID</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3 text-center">Valor</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.map((p: { e2e: string, tipo: string, valor: number, falta: string }, i: Key | null | undefined) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-bold text-[#d63384] break-all">{p.e2e}</td>
                  <td className="p-3 text-center">{p.tipo === "C" ? "CRÉDITO" : "DÉBITO"}</td>
                  <td className="p-3 text-center">R$ {fmtCur(p.valor)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.falta === "JD" ? "bg-yellow-400" : "bg-red-500 text-white"}`}>
                      FALTA NA {p.falta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}