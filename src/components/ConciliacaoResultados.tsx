import { fmtCur, fmtNum } from "@/libs/utils";

interface ResultadosProps {
  dataRef: string;
  metrics: any;
  res: any;
  filteredAudit: any[];
  onOpenJira: () => void;
  filters: {
    setE2E: (v: string) => void;
    setTipo: (v: string) => void;
    setOri: (v: string) => void;
  }
}

export function ConciliacaoResultados({ dataRef, metrics, res, filteredAudit, onOpenJira, filters }: ResultadosProps) {
  return (
    <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Resultado ({dataRef.split("-").reverse().join("/")})</h2>
          <button onClick={onOpenJira} className="bg-[#212529] text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors">
            <span className="text-[10px]">🎫</span> JIRA
          </button>
        </div>

        {/* Tabela de Métricas */}
        <div className="overflow-x-auto border border-gray-200 rounded mb-8">
          <table className="w-full text-center border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#212529] text-white text-xs uppercase">
                <th className="p-3 text-left">Métrica</th>
                <th className="p-3">JD</th>
                <th className="p-3">Core</th>
                <th className="p-3">Diferença</th>
                <th className="p-3 italic text-gray-400">Ref. Planilha JD</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { label: "Crédito (Qtd)", jd: metrics.jd.qc, core: metrics.core.qc, diff: metrics.diff.qc, ref: res.jd_sheet.C.qtd, isCur: false },
                { label: "Crédito (Val)", jd: metrics.jd.vc, core: metrics.core.vc, diff: metrics.diff.vc, ref: res.jd_sheet.C.val, isCur: true },
                { label: "Débito (Qtd)", jd: metrics.jd.qd, core: metrics.core.qd, diff: metrics.diff.qd, ref: res.jd_sheet.D.qtd, isCur: false },
                { label: "Débito (Val)", jd: metrics.jd.vd, core: metrics.core.vd, diff: metrics.diff.vd, ref: res.jd_sheet.D.val, isCur: true },
              ].map((row, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-3 text-left font-bold bg-gray-50">{row.label}</td>
                  <td className="p-3">{row.isCur ? fmtCur(row.jd) : fmtNum(row.jd)}</td>
                  <td className="p-3">{row.isCur ? fmtCur(row.core) : fmtNum(row.core)}</td>
                  <td className={`p-3 font-bold ${Math.abs(row.diff) > 0.01 ? "bg-red-100 text-red-600" : ""}`}>
                    {row.isCur ? fmtCur(row.diff) : fmtNum(row.diff)}
                  </td>
                  <td className="p-3 text-gray-500 italic">{row.isCur ? fmtCur(row.ref) : fmtNum(row.ref)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Filtros e Lista de Pendências */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input placeholder="Filtrar ID..." className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" onChange={(e) => filters.setE2E(e.target.value)} />
          <select className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" onChange={(e) => filters.setTipo(e.target.value)}>
            <option value="">Tipos</option>
            <option value="C">Crédito</option>
            <option value="D">Débito</option>
          </select>
          <select className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" onChange={(e) => filters.setOri(e.target.value)}>
            <option value="">Pendências</option>
            <option value="CORE">Falta no Core</option>
            <option value="JD">Falta na JD</option>
          </select>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-[#212529] text-white text-xs uppercase">
                <th className="p-3 text-left">E2E ID</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3 text-center">Valor</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-bold text-[#d63384] break-all">{p.e2e}</td>
                  <td className="p-3 text-center">
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.tipo === "C" ? "bg-green-500" : "bg-red-500"}`}>
                      {p.tipo === "C" ? "CRÉDITO" : "DÉBITO"}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold">R$ {fmtCur(p.valor)}</td>
                  <td className="p-3 text-center">
                    <span className={`text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase ${p.falta === "JD" ? "bg-[#ffc107]" : "bg-red-500 text-white"}`}>
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