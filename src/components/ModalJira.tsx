import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { fmtCur, fmtNum } from "@/libs/utils";
import { toast } from "@/libs/toast";

interface ModalJiraProps {
  isOpen: boolean;
  onClose: () => void;
  jiraData: {
    dataSel: string;
    grupos: { titulo: string; lista: any[] }[];
    textoClipboard: string;
    temDivergencia: boolean;
  } | null;
  metrics: any;
}

export function ModalJira({ isOpen, onClose, jiraData, metrics }: ModalJiraProps) {
  if (!isOpen || !jiraData) return null;

  const copiarParaJira = () => {
    navigator.clipboard.writeText(jiraData.textoClipboard);
    toast("success", "Texto copiado para o JIRA!");
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#212529] text-white p-4 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">🎫 Resumo JIRA</h3>
          <button onClick={onClose} className="hover:text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <h5 className="text-[#0d6efd] font-bold text-lg border-b pb-2">
            Conciliação referente ao dia {jiraData.dataSel}
          </h5>

          {!jiraData.temDivergencia ? (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="text-green-600" size={24} />
              <div>
                <p className="font-black text-sm uppercase tracking-tight">Conciliação Concluída!</p>
                <p className="text-xs opacity-90">Não foram encontradas divergências de quantidade ou valor.</p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={20} className="text-red-600" />
                <span className="font-black text-xs uppercase">Divergências Identificadas</span>
              </div>
              {Math.abs(metrics.diff.vc) > 0.01 && (
                <p className="text-sm">
                  • Falta <b>{Math.abs(metrics.diff.qc)}</b> transação de Crédito no <b>{metrics.diff.qc > 0 ? "Core" : "JD"}</b>.<br />
                  <span className="ml-3 text-xs">Diferença de Valor: R$ {fmtCur(Math.abs(metrics.diff.vc))}.</span>
                </p>
              )}
              {Math.abs(metrics.diff.vd) > 0.01 && (
                <p className="text-sm">
                  • Falta <b>{Math.abs(metrics.diff.qd)}</b> transação de Débito no <b>{metrics.diff.qd > 0 ? "Core" : "JD"}</b>.<br />
                  <span className="ml-3 text-xs">Diferença de Valor: R$ {fmtCur(Math.abs(metrics.diff.vd))}.</span>
                </p>
              )}
            </div>
          )}

          {/* Tabelas de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["CORE", "JD"].map((label) => (
              <div key={label} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 border-b">
                  <strong className="text-[10px] uppercase tracking-widest text-gray-600">{label}</strong>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 bg-gray-50/50">
                      <th className="p-1.5 text-left font-medium">Tipo</th>
                      <th className="p-1.5 text-center font-medium">Qtd</th>
                      <th className="p-1.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-1.5 font-bold">C</td>
                      <td className="p-1.5 text-center">{fmtNum(label === "CORE" ? metrics.core.qc : metrics.jd.qc)}</td>
                      <td className="p-1.5 text-right">R$ {fmtCur(label === "CORE" ? metrics.core.vc : metrics.jd.vc)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-1.5 font-bold">D</td>
                      <td className="p-1.5 text-center">{fmtNum(label === "CORE" ? metrics.core.qd : metrics.jd.qd)}</td>
                      <td className="p-1.5 text-right">R$ {fmtCur(label === "CORE" ? metrics.core.vd : metrics.jd.vd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Listagem de Grupos */}
          {jiraData.grupos.map((g, idx) => g.lista.length > 0 && (
            <div key={idx} className="space-y-1">
              <strong className="text-[10px] text-gray-500 uppercase tracking-widest">{g.titulo} ({g.lista.length})</strong>
              <div className="bg-gray-50 border rounded p-2 max-h-24 overflow-y-auto">
                {g.lista.map((p) => (
                  <div key={p.e2e} className="text-[10px] font-mono text-[#d63384] font-bold">{p.e2e}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button 
            onClick={copiarParaJira} 
            className="bg-[#0d6efd] text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Copiar para o JIRA
          </button>
        </div>
      </div>
    </div>
  );
}