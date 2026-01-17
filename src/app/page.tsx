'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeftRight, Rocket, FileSpreadsheet, ClipboardCheck, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Interfaces para Tipagem ---
interface Pendencia {
  e2e: string;
  tipo: 'C' | 'D';
  valor: number;
  falta: 'CORE' | 'JD';
}

interface ProcessamentoRes {
  success: boolean;
  message?: string;
  pendencias: Pendencia[];
  pendencias_no_core: Pendencia[];
  pendencias_na_jd: Pendencia[];
  jd_sheet: {
    C: { qtd: number; val: number };
    D: { qtd: number; val: number };
  };
}

export default function ConciliacaoPage() {
  const API_URL = 'http://uaisotrem.ddns.net:3001';
  // --- ESTADOS ---
  const [isLoading, setIsLoading] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState("Processando");
  const [progress, setProgress] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [dataRef, setDataRef] = useState("");

  // Dados do formulário e resultados
  const [res, setRes] = useState<ProcessamentoRes | null>(null);
  const [formDataValues, setFormDataValues] = useState<any>(null);

  // Filtros
  const [filterE2E, setFilterE2E] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterOri, setFilterOri] = useState("");

  // Referência do Form
  const formRef = useRef<HTMLFormElement>(null);

  // --- EFEITOS (Equivalente ao window.onload) ---
  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDataRef(yesterday.toISOString().split('T')[0]);
  }, []);

  // --- UTILITÁRIOS ---
  const fmtCur = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = (v: number) => v.toLocaleString('pt-BR');
  const parseMoeda = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

  // --- LÓGICA DE CÁLCULO (Equivalente ao renderizar do scripts.js) ---
  const metrics = useMemo(() => {
    if (!formDataValues) return null;

    const jd_qc = (parseInt(formDataValues.m_jd_qtd_c) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_c) || 0);
    const jd_vc = parseMoeda(formDataValues.m_jd_val_c || "0");
    const jd_qd = (parseInt(formDataValues.m_jd_qtd_d) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_d) || 0);
    const jd_vd = parseMoeda(formDataValues.m_jd_val_d || "0");

    const core_qc = parseInt(formDataValues.m_core_qtd_c) || 0;
    const core_vc = parseMoeda(formDataValues.m_core_val_c || "0");
    const core_qd = parseInt(formDataValues.m_core_qtd_d) || 0;
    const core_vd = parseMoeda(formDataValues.m_core_val_d || "0");

    return {
      jd: { qc: jd_qc, vc: jd_vc, qd: jd_qd, vd: jd_vd },
      core: { qc: core_qc, vc: core_vc, qd: core_qd, vd: core_vd },
      diff: {
        qc: jd_qc - core_qc,
        vc: jd_vc - core_vc,
        qd: jd_qd - core_qd,
        vd: jd_vd - core_vd
      }
    };
  }, [formDataValues]);

  // --- AÇÕES ---
  const handleProcessar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoaderTitle("Processando conciliação");

    const fd = new FormData(e.currentTarget as HTMLFormElement);

    try {
      const response = await fetch(`${API_URL}/api/conciliacao/processar`, {
        method: 'POST',
        body: fd
      });
      const data = await response.json();

      if (data.success) {
        setRes(data);
        // Salva os valores do formulário para os cálculos do useMemo
        setFormDataValues(Object.fromEntries(fd));
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Erro ao processar ficheiros.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    
    // Validação básica de arquivos
    const fileJd = fd.get('file_jd') as File;
    const fileCore = fd.get('file_core') as File;
    if (!fileJd?.size || !fileCore?.size) {
      alert("Por favor, selecione os dois arquivos antes de gerar a auditoria.");
      return;
    }

    // 1. Gera um ID único para esta tarefa de processamento
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    fd.append('taskId', taskId); // Envia o ID para o backend associar o progresso

    setIsLoading(true);
    setLoaderTitle("Gerando arquivo de auditoria");
    setProgress(0);
    setLineCount(0);
    
    // 2. Configura o Polling para a nova rota do Node.js
    const checkProgress = setInterval(async () => {
      try {
        // Chamada para a nova rota: /api/conciliacao/progress/:taskId
        const r = await fetch(`${API_URL}/api/conciliacao/progress/${taskId}`);
        const d = await r.json();
        
        setProgress(d.porcentagem || 0);
        setLineCount(d.linhas || 0);
        setLoaderTitle(d.etapa || "Processando...");

        if (d.porcentagem >= 100) clearInterval(checkProgress);
      } catch (e) {
        console.error("Erro ao consultar progresso:", e);
      }
    }, 1000); // Intervalo de 800ms para não sobrecarregar o servidor

    try {
      // 3. Inicia a geração do Excel
      const response = await fetch(`${API_URL}/api/conciliacao/gerar-excel`, { 
        method: 'POST', 
        body: fd 
      });

      if (!response.ok) throw new Error("Erro na geração do arquivo");

      const blob = await response.blob();
      clearInterval(checkProgress);
      setProgress(100);
      setLoaderTitle("Concluído!");

      // Efeito visual de sucesso
      confetti({ 
        particleCount: 150, 
        spread: 70, 
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b']
      });

      // Gatilho de download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auditoria_Pix_${dataRef}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      clearInterval(checkProgress);
      alert("Ocorreu um erro ao gerar a auditoria. Verifique o console.");
      console.error(err);
    } finally {
      // Mantém o loader por 3 segundos para o usuário ver o "100%"
      setTimeout(() => setIsLoading(false), 3000);
    }
  };

  // --- FILTRAGEM ---
  const filteredAudit = useMemo(() => {
    if (!res) return [];

    return res.pendencias.filter(p => {
      // 1. Garante que o E2E existe e não é a palavra "e2e" (cabeçalho)
      const e2eLimpo = p.e2e?.trim().toUpperCase();
      if (!e2eLimpo || e2eLimpo === "E2E" || e2eLimpo === "E2E_ID") return false;

      // 2. Aplica os filtros da interface
      const matchE2E = p.e2e.toUpperCase().includes(filterE2E.toUpperCase());
      const matchTipo = filterTipo === "" || p.tipo === filterTipo;
      const matchOri = filterOri === "" || p.falta === filterOri;

      return matchE2E && matchTipo && matchOri;
    });
  }, [res, filterE2E, filterTipo, filterOri]);

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 md:px-8 text-gray-800">

      {/* LOADER */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <h4 className="font-bold text-lg mb-2">{loaderTitle}</h4>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            {/* <p className="text-xs text-gray-500 font-bold">{progress}% - {lineCount.toLocaleString()} linhas</p> */}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black text-center mb-8 uppercase tracking-tighter italic">
          📊 Conciliação JD vs Core
        </h1>

        <form ref={formRef} onSubmit={handleProcessar} className="space-y-6">
          {/* Data Selecionada */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-info">
              <label className="block text-center text-xs font-black text-gray-400 uppercase mb-2">Data do Movimento</label>
              <input
                type="date"
                name="data_ref"
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                className="bg-gray-50 border-0 rounded-lg font-bold text-center"
              />
            </div>
          </div>

          {/* Cards de Upload */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 relative`}>
            <button
              type="button"
              onClick={() => setIsSwapped(!isSwapped)}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full shadow-lg border hover:text-blue-600 hidden lg:block"
            >
              <ArrowLeftRight size={20} />
            </button>

            <div className={`${isSwapped ? 'lg:order-2' : 'lg:order-1'} bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600`}>
              <h6 className="font-black text-blue-600 mb-4 text-xs uppercase">Dados JD (CSV)</h6>
              <input type="file" name="file_jd" accept=".csv" className="w-full text-sm mb-4" required />
              <div className="grid grid-cols-3 gap-2">
                <InputMini label="Qtd Crédito" name="m_jd_qtd_c" />
                <InputMini label="Qtd Dev Cred" name="m_jd_qtd_dev_c" />
                <InputMini label="Val Crédito" name="m_jd_val_c" placeholder="0,00" />
                <InputMini label="Qtd Débito" name="m_jd_qtd_d" />
                <InputMini label="Qtd Dev Deb" name="m_jd_qtd_dev_d" />
                <InputMini label="Val Débito" name="m_jd_val_d" placeholder="0,00" />
              </div>
            </div>

            <div className={`${isSwapped ? 'lg:order-1' : 'lg:order-2'} bg-white p-6 rounded-xl shadow-sm border-l-4 border-gray-900`}>
              <h6 className="font-black text-gray-900 mb-4 text-xs uppercase">Dados Core (CSV)</h6>
              <input type="file" name="file_core" accept=".csv" className="w-full text-sm mb-4" required />
              <div className="grid grid-cols-2 gap-4">
                <InputMini label="Qtd Crédito" name="m_core_qtd_c" />
                <InputMini label="Val Crédito" name="m_core_val_c" placeholder="0,00" />
                <InputMini label="Qtd Débito" name="m_core_qtd_d" />
                <InputMini label="Val Débito" name="m_core_val_d" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all active:scale-95">
              <Rocket size={20} /> PROCESSAR AGORA
            </button>
            <button type="button" onClick={handleDownloadExcel} className="bg-green-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-green-700 shadow-lg transition-all active:scale-95">
              <FileSpreadsheet size={20} /> BAIXAR EXCEL
            </button>
          </div>
        </form>

        {/* RESULTADOS */}
        {res && metrics && (
          <div className="mt-12 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6 border-bottom pb-4">
                <h4 className="font-black text-xl">Resultado ({dataRef.split('-').reverse().join('/')})</h4>
                <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <ClipboardCheck size={16} /> JIRA
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white text-xs uppercase font-black">
                      <th className="p-3">Métrica</th>
                      <th className="p-3">JD</th>
                      <th className="p-3">Core</th>
                      <th className="p-3">Diferença</th>
                      <th className="p-3">Planilha JD</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-sm">
                    <tr className="border-b">
                      <td className="p-3 text-left">Crédito (Qtd)</td>
                      <td>{fmtNum(metrics.jd.qc)}</td>
                      <td>{fmtNum(metrics.core.qc)}</td>
                      <td className={metrics.diff.qc !== 0 ? "text-red-600" : "text-green-600"}>{metrics.diff.qc}</td>
                      <td className="text-gray-400 italic">{fmtNum(res.jd_sheet.C.qtd)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 text-left">Crédito (Val)</td>
                      <td>{fmtCur(metrics.jd.vc)}</td>
                      <td>{fmtCur(metrics.core.vc)}</td>
                      <td className={Math.abs(metrics.diff.vc) > 0.01 ? "text-red-600 bg-red-50" : "text-green-600"}>
                        R$ {fmtCur(metrics.diff.vc)}
                      </td>
                      <td className="text-gray-400 italic bg-gray-50">R$ {fmtCur(res.jd_sheet.C.val)}</td>
                    </tr>
                    <tr className="border-b bg-blue-50/30">
                      <td className="p-3 text-left">Débito (Qtd)</td>
                      <td>{fmtNum(metrics.jd.qd)}</td>
                      <td>{fmtNum(metrics.core.qd)}</td>
                      <td className={metrics.diff.qd !== 0 ? "text-red-600 bg-red-50" : "text-green-600"}>
                        {metrics.diff.qd}
                      </td>
                      <td className="text-gray-400 italic bg-gray-50">{fmtNum(res.jd_sheet.D.qtd)}</td>
                    </tr>
                    <tr className="border-b bg-blue-50/30">
                      <td className="p-3 text-left">Débito (Val)</td>
                      <td>{fmtCur(metrics.jd.vd)}</td>
                      <td>{fmtCur(metrics.core.vd)}</td>
                      <td className={Math.abs(metrics.diff.vd) > 0.01 ? "text-red-600 bg-red-50" : "text-green-600"}>
                        R$ {fmtCur(metrics.diff.vd)}
                      </td>
                      <td className="text-gray-400 italic bg-gray-50">R$ {fmtCur(res.jd_sheet.D.val)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Filtros da Auditoria */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 mb-4">
                <input
                  placeholder="Filtrar ID..."
                  className="border rounded-lg p-2 text-sm"
                  onChange={(e) => setFilterE2E(e.target.value)}
                />
                <select className="border rounded-lg p-2 text-sm" onChange={(e) => setFilterTipo(e.target.value)}>
                  <option value="">Todos os Tipos</option>
                  <option value="C">Crédito</option>
                  <option value="D">Débito</option>
                </select>
                <select className="border rounded-lg p-2 text-sm" onChange={(e) => setFilterOri(e.target.value)}>
                  <option value="">Todas as Pendências</option>
                  <option value="CORE">Falta no CORE</option>
                  <option value="JD">Falta na JD</option>
                </select>
              </div>

              {/* Lista de Auditoria */}
              <div className="max-h-96 overflow-y-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 font-black text-xs border-b">
                    <tr><th className="p-3 text-left">E2E ID</th><th>Tipo</th><th>Valor</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((p, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{p.e2e}</td>
                        <td className="text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black ${p.tipo === 'C' ? 'bg-cyan-100 text-cyan-700' : 'bg-orange-100 text-orange-700'}`}>
                            {p.tipo === 'C' ? 'CRÉDITO' : 'DÉBITO'}
                          </span>
                        </td>
                        <td className="text-center font-bold">R$ {fmtCur(p.valor)}</td>
                        <td className="text-center">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${p.falta === 'CORE' ? 'bg-red-600 text-white' : 'bg-yellow-400 text-black'}`}>
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
        )}
      </div>
    </main>
  );
}

// Componente Interno para Inputs
function InputMini({ label, name, placeholder = "0" }: { label: string; name: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-gray-400 uppercase leading-none">{label}</label>
      <input
        name={name}
        className="w-full border-gray-200 rounded p-1 text-xs font-bold focus:ring-1 focus:ring-blue-600"
        placeholder={placeholder}
      />
    </div>
  );
}