/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeftRight,
  Rocket,
  FileSpreadsheet
} from "lucide-react";
import confetti from "canvas-confetti";
import { ENV } from "@/config/env";

const API_URL = ENV.NEXT_PUBLIC_API_URL;

// --- Interfaces ---
interface Pendencia {
  e2e: string;
  tipo: "C" | "D";
  valor: number;
  falta: "CORE" | "JD";
}

interface ProcessamentoRes {
  success: boolean;
  message?: string;
  pendencias: Pendencia[];
  jd_sheet: {
    C: { qtd: number; val: number };
    D: { qtd: number; val: number };
  };
}

export default function ConciliacaoPage() {
  // --- ESTADOS ---
  const [isLoading, setIsLoading] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState("Processando");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [dataRef, setDataRef] = useState("");

  const [res, setRes] = useState<ProcessamentoRes | null>(null);
  const [formDataValues, setFormDataValues] = useState<any>(null);

  const [filterE2E, setFilterE2E] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterOri, setFilterOri] = useState("");
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [titlesVisible, setTitlesVisible] = useState(true);

  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- EFEITO INICIAL ---
  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDataRef(yesterday.toISOString().split("T")[0]);
  }, []);

  // --- MONITORAMENTO DE PROGRESSO (POLLING) ---
  useEffect(() => {
    if (isLoading && taskId) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(
            `${API_URL}/api/conciliacao/progress/${taskId}`
          );
          if (!r.ok) throw new Error("Falha ao consultar progresso");

          const d = await r.json();
          setProgress(d.porcentagem || 0);
          setLoaderTitle(d.etapa || "Processando...");

          if (d.porcentagem === 100) {
            handleFinalizarDownload(taskId);
          }
        } catch (e) {
          console.error("Erro no polling:", e);
          interromperProcessamento();
        }
      }, 2000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading, taskId]);

  // --- AÇÕES ---
  const interromperProcessamento = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTaskId(null);
    setTimeout(() => setIsLoading(false), 3000);
  };

  const handleFinalizarDownload = async (id: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setLoaderTitle("Sincronizando arquivo...");
    setProgress(100);

    // Função interna de retentativa
    const dispararRetentativas = async (tentativasRestantes: number) => {
      if (tentativasRestantes <= 0) {
        limparProcessamento();
        return;
      }

      try {
        // Fazemos um check rápido (HEAD) para ver se a rota já retorna 200 OK
        const check = await fetch(
          `${API_URL}/api/conciliacao/baixar-arquivo/${id}`,
          {
            method: "HEAD",
          }
        );

        if (check.ok) {
          // Sucesso! O arquivo está pronto.
          executarDownloadInvisivel(id);
        } else {
          // Ainda não está pronto (404), aguarda 2s e tenta de novo
          console.log(
            `Arquivo não pronto. Tentativas restantes: ${tentativasRestantes}`
          );
          setTimeout(() => dispararRetentativas(tentativasRestantes - 1), 2000);
        }
      } catch (err) {
        setTimeout(() => dispararRetentativas(tentativasRestantes - 1), 2000);
      }
    };

    const executarDownloadInvisivel = (id: string) => {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#f59e0b"],
      });

      // Criamos um link temporário oculto para disparar o download
      const link = document.createElement("a");
      link.href = `${API_URL}/api/conciliacao/baixar-arquivo/${id}`;
      link.setAttribute("download", `Auditoria_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setLoaderTitle("Concluído!");
      limparProcessamento();
    };

    // Inicia o ciclo de tentativas (ex: 6 tentativas de 2s = 12 segundos no total)
    dispararRetentativas(30);
  };

  const limparProcessamento = () => {
    // 1. Para o polling imediatamente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 2. Aguarda 3 segundos para o usuário ver o estado de "Concluído"
    setTimeout(() => {
      setIsLoading(false);
      setTaskId(null);
      setProgress(0);
      setLoaderTitle("Processando"); // Reseta o título para a próxima vez
    }, 3000);
  };

  const handleProcessar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoaderTitle("Processando Conciliação");
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    try {
      const response = await fetch(`${API_URL}/api/conciliacao/processar`, {
        method: "POST",
        body: fd,
      });
      const data = await response.json();
      if (data.success) {
        setRes(data);
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

    if (
      !(fd.get("file_jd") as File)?.size ||
      !(fd.get("file_core") as File)?.size
    ) {
      alert("Selecione os dois arquivos CSV para gerar o Excel.");
      return;
    }

    setIsLoading(true);
    setLoaderTitle("Iniciando geração do Excel...");
    setProgress(0);

    try {
      const response = await fetch(`${API_URL}/api/conciliacao/gerar-excel`, {
        method: "POST",
        body: fd,
      });

      const data = await response.json();
      if (data.success) {
        setTaskId(data.taskId); // Ativa o useEffect de polling
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      alert(err.message || "Erro ao iniciar geração.");
      setIsLoading(false);
    }
  };

  const handleToggleSwap = () => {
    // 1. Inicia o fade out dos títulos
    setTitlesVisible(false);

    // 2. Inverte a posição dos cards
    setIsSwapped(!isSwapped);

    // 3. Após metade da animação de slide (350ms), inicia o fade in
    setTimeout(() => {
      setTitlesVisible(true);
    }, 350);
  };

  // --- CÁLCULOS E FILTROS ---
  const fmtCur = (v: number) =>
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtNum = (v: number) => v.toLocaleString("pt-BR");
  const parseMoeda = (v: string) =>
    parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

  const metrics = useMemo(() => {
    if (!formDataValues) return null;
    const jd_qc =
      (parseInt(formDataValues.m_jd_qtd_c) || 0) +
      (parseInt(formDataValues.m_jd_qtd_dev_c) || 0);
    const jd_vc = parseMoeda(formDataValues.m_jd_val_c || "0");
    const jd_qd =
      (parseInt(formDataValues.m_jd_qtd_d) || 0) +
      (parseInt(formDataValues.m_jd_qtd_dev_d) || 0);
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
        vd: jd_vd - core_vd,
      },
    };
  }, [formDataValues]);

  const filteredAudit = useMemo(() => {
    if (!res) return [];
    return res.pendencias.filter((p) => {
      const matchE2E = p.e2e.toUpperCase().includes(filterE2E.toUpperCase());
      const matchTipo = filterTipo === "" || p.tipo === filterTipo;
      const matchOri = filterOri === "" || p.falta === filterOri;
      return matchE2E && matchTipo && matchOri;
    });
  }, [res, filterE2E, filterTipo, filterOri]);

  const jiraData = useMemo(() => {
    if (!res || !metrics) return null;

    const dataSel = dataRef.split("-").reverse().join("/");

    // Agrupamento de E2Es (Baseado no scripts.js original)
    const grupos = [
      {
        titulo: "E2E faltante na JD Crédito",
        lista: res.pendencias.filter((p) => p.falta === "JD" && p.tipo === "C"),
      },
      {
        titulo: "E2E faltante na JD Débito",
        lista: res.pendencias.filter((p) => p.falta === "JD" && p.tipo === "D"),
      },
      {
        titulo: "E2E faltante no Core Crédito",
        lista: res.pendencias.filter(
          (p) => p.falta === "CORE" && p.tipo === "C"
        ),
      },
      {
        titulo: "E2E faltante no Core Débito",
        lista: res.pendencias.filter(
          (p) => p.falta === "CORE" && p.tipo === "D"
        ),
      },
    ];

    // Texto para o Clipboard (Jira Wiki Markup)
    let textoClipboard = `*Conciliação referente ao dia ${dataSel}*\n\n`;

    const addAlerta = (diffQ: number, diffV: number, tipo: string) => {
      if (Math.abs(diffQ) > 0 || Math.abs(diffV) > 0.01) {
        const local = diffQ > 0 ? "Core" : "JD";
        textoClipboard += `* Falta ${Math.abs(
          diffQ
        )} transação de ${tipo} no ${local}.\n`;
        textoClipboard += `  Diferença no Valor da conta ${tipo} é de R$ ${fmtCur(
          Math.abs(diffV)
        )}.\n`;
      }
    };

    addAlerta(metrics.diff.qc, metrics.diff.vc, "Crédito");
    addAlerta(metrics.diff.qd, metrics.diff.vd, "Débito");

    textoClipboard += `\n*CORE*\nC: ${fmtNum(metrics.core.qc)} | R$ ${fmtCur(
      metrics.core.vc
    )}\nD: ${fmtNum(metrics.core.qd)} | R$ ${fmtCur(metrics.core.vd)}\n`;
    textoClipboard += `\n*JD*\nC: ${fmtNum(metrics.jd.qc)} | R$ ${fmtCur(
      metrics.jd.vc
    )}\nD: ${fmtNum(metrics.jd.qd)} | R$ ${fmtCur(metrics.jd.vd)}\n`;

    grupos.forEach((g) => {
      if (g.lista.length > 0) {
        textoClipboard += `\n*${g.titulo} (${g.lista.length})*\n${g.lista
          .map((p) => p.e2e)
          .join("\n")}\n`;
      }
    });

    return { dataSel, grupos, textoClipboard };
  }, [res, metrics, dataRef]);

  const copiarParaJira = () => {
    if (jiraData) {
      navigator.clipboard.writeText(jiraData.textoClipboard);
      alert("Texto copiado para o JIRA!");
    }
  };

  function InputOriginal({
    label,
    name,
    placeholder = "0",
  }: {
    label: string;
    name: string;
    placeholder?: string;
  }) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight block">
          {label}
        </label>
        <input
          name={name}
          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 md:px-8 text-gray-800">
      {/* LOADER PERSISTENTE PARA POLLING */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <h4 className="font-bold text-lg mb-2">{loaderTitle}</h4>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
              <div
                className="bg-blue-600 h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
              {progress}% concluído
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h1 className="flex items-center justify-center gap-3 text-4xl font-extrabold text-[#212529] mb-10 tracking-tight">
          <span className="text-4xl">📊</span> Conciliação JD vs Core
        </h1>

        <form ref={formRef} onSubmit={handleProcessar} className="space-y-6">
          {/* SELETOR DE DATA CENTRALIZADO */}
          <div className="flex justify-center">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm text-center">
              <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 tracking-widest">
                Data do Movimento
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataRef}
                  onChange={(e) => setDataRef(e.target.value)}
                  className="w-full bg-[#f1f3f5] border-none rounded-xl py-3 px-4 font-bold text-center text-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
          {/* GRID DE CARDS JD E CORE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start overflow-hidden lg:overflow-visible pb-4">
            {/* BOTÃO DE INVERSÃO (POSICIONADO ENTRE OS CARDS) */}
            <button
              type="button"
              onClick={() => setIsSwapped(!isSwapped)}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30 bg-[#212529] text-white p-3 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all hidden lg:flex items-center justify-center border-4 border-[#f8f9fa]"
            >
              <ArrowLeftRight size={20} />
            </button>
            {/* CARD JD (ESQUERDA) */}
            <div
              className={`
      bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#0d6efd] 
      transition-all duration-700 ease-in-out z-10
      ${isSwapped ? "lg:translate-x-[calc(100%+2rem)]" : "translate-x-0"}
    `}
            >
              <h6 className="font-extrabold text-[#0d6efd] mb-6 text-sm uppercase tracking-wider">
                Dados JD (CSV)
              </h6>

              {/* Custom File Input Estilizado */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6 bg-white">
                <label className="bg-[#f8f9fa] border-r border-gray-200 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-100">
                  Escolher arquivo
                  <input
                    type="file"
                    name="file_jd"
                    accept=".csv"
                    className="hidden"
                  />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">
                  Nenhum arquivo escolhido
                </span>
              </div>

              <div className="grid grid-cols-3 gap-x-4 gap-y-5">
                <InputOriginal label="Qtd Crédito" name="m_jd_qtd_c" />
                <InputOriginal label="Qtd Dev Cred" name="m_jd_qtd_dev_c" />
                <InputOriginal
                  label="Valor Crédito"
                  name="m_jd_val_c"
                  placeholder="0,00"
                />
                <InputOriginal label="Qtd Débito" name="m_jd_qtd_d" />
                <InputOriginal label="Qtd Dev Deb" name="m_jd_qtd_dev_d" />
                <InputOriginal
                  label="Valor Débito"
                  name="m_jd_val_d"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* CARD CORE */}
            <div
              className={`
      bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#212529] 
      transition-all duration-700 ease-in-out z-10
      ${isSwapped ? "lg:-translate-x-[calc(100%+2rem)]" : "translate-x-0"}
    `}
            >
              <h6 className={`
    font-extrabold text-[#212529] mb-6 text-sm uppercase tracking-wider
    transition-opacity duration-300 ease-in-out
    ${titlesVisible ? 'opacity-100' : 'opacity-0'}
  `}>
    Dados Core (CSV)
  </h6>

              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6 bg-white">
                <label className="bg-[#f8f9fa] border-r border-gray-200 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-100">
                  Escolher arquivo
                  <input
                    type="file"
                    name="file_core"
                    accept=".csv"
                    className="hidden"
                  />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">
                  Nenhum arquivo escolhido
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <InputOriginal label="Qtd Crédito" name="m_core_qtd_c" />
                <InputOriginal
                  label="Valor Crédito"
                  name="m_core_val_c"
                  placeholder="0,00"
                />
                <InputOriginal label="Qtd Débito" name="m_core_qtd_d" />
                <InputOriginal
                  label="Valor Débito"
                  name="m_core_val_d"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all active:scale-95"
            >
              <Rocket size={20} /> PROCESSAR
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="bg-green-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-green-700 shadow-lg transition-all active:scale-95"
            >
              <FileSpreadsheet size={20} /> GERAR AUDITORIA
            </button>
          </div>
        </form>

        {/* RESULTADO */}
        {res && metrics && (
          <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              {/* HEADER DA SEÇÃO */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Resultado ({dataRef.split("-").reverse().join("/")})
                </h2>
                <button
                  onClick={() => setShowJiraModal(true)}
                  className="bg-[#212529] text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors"
                >
                  <span className="text-[10px]">🎫</span> JIRA
                </button>
              </div>

              {/* TABELA DE MÉTRICAS (RESUMO) */}
              <div className="overflow-hidden border border-gray-200 rounded mb-8">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#212529] text-white text-xs uppercase">
                      <th className="p-3 font-bold border-r border-gray-700">
                        Métrica
                      </th>
                      <th className="p-3 font-bold border-r border-gray-700">
                        JD
                      </th>
                      <th className="p-3 font-bold border-r border-gray-700">
                        Core
                      </th>
                      <th className="p-3 font-bold border-r border-gray-700">
                        Diferença
                      </th>
                      <th className="p-3 font-bold italic text-gray-400">
                        Ref. Planilha JD
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-gray-200">
                      <td className="p-3 text-left font-bold bg-gray-50 border-r">
                        Crédito (Qtd)
                      </td>
                      <td className="p-3 border-r">{fmtNum(metrics.jd.qc)}</td>
                      <td className="p-3 border-r">
                        {fmtNum(metrics.core.qc)}
                      </td>
                      <td
                        className={`p-3 border-r font-bold ${metrics.diff.qc !== 0 ? "bg-red-100 text-red-600" : ""
                          }`}
                      >
                        {fmtNum(metrics.diff.qc)}
                      </td>
                      <td className="p-3 text-gray-500 italic">
                        {fmtNum(res.jd_sheet.C.qtd)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-3 text-left font-bold bg-gray-50 border-r">
                        Crédito (Val)
                      </td>
                      <td className="p-3 border-r">{fmtCur(metrics.jd.vc)}</td>
                      <td className="p-3 border-r">
                        {fmtCur(metrics.core.vc)}
                      </td>
                      <td
                        className={`p-3 border-r font-bold ${Math.abs(metrics.diff.vc) > 0.01
                            ? "bg-[#f8d7da] text-[#842029]"
                            : ""
                          }`}
                      >
                        {fmtCur(metrics.diff.vc)}
                      </td>
                      <td className="p-3 text-gray-500 italic">
                        {fmtCur(res.jd_sheet.C.val)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-3 text-left font-bold bg-gray-50 border-r">
                        Débito (Qtd)
                      </td>
                      <td className="p-3 border-r">{fmtNum(metrics.jd.qd)}</td>
                      <td className="p-3 border-r">
                        {fmtNum(metrics.core.qd)}
                      </td>
                      <td
                        className={`p-3 border-r font-bold ${metrics.diff.qd !== 0 ? "bg-red-100 text-red-600" : ""
                          }`}
                      >
                        {fmtNum(metrics.diff.qd)}
                      </td>
                      <td className="p-3 text-gray-500 italic">
                        {fmtNum(res.jd_sheet.D.qtd)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-left font-bold bg-gray-50 border-r">
                        Débito (Val)
                      </td>
                      <td className="p-3 border-r">{fmtCur(metrics.jd.vd)}</td>
                      <td className="p-3 border-r">
                        {fmtCur(metrics.core.vd)}
                      </td>
                      <td
                        className={`p-3 border-r font-bold ${Math.abs(metrics.diff.vd) > 0.01
                            ? "bg-[#f8d7da] text-[#842029]"
                            : ""
                          }`}
                      >
                        {fmtCur(metrics.diff.vd)}
                      </td>
                      <td className="p-3 text-gray-500 italic">
                        {fmtCur(res.jd_sheet.D.val)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* FILTROS */}
              <div className="flex gap-4 mb-6">
                <input
                  placeholder="Filtrar ID..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  onChange={(e) => setFilterE2E(e.target.value)}
                />
                <select
                  className="w-48 border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                  onChange={(e) => setFilterTipo(e.target.value)}
                >
                  <option value="">Tipos</option>
                  <option value="C">Crédito</option>
                  <option value="D">Débito</option>
                </select>
                <select
                  className="w-64 border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                  onChange={(e) => setFilterOri(e.target.value)}
                >
                  <option value="">Pendências</option>
                  <option value="CORE">Falta no Core</option>
                  <option value="JD">Falta na JD</option>
                </select>
              </div>

              {/* TABELA DE PENDÊNCIAS (LISTAGEM) */}
              <div className="overflow-hidden border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#212529] text-white text-xs uppercase">
                      <th className="p-3 text-left font-bold">E2E ID</th>
                      <th className="p-3 text-center font-bold">Tipo</th>
                      <th className="p-3 text-center font-bold">Valor</th>
                      <th className="p-3 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((p, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="p-3 font-bold text-[#d63384] break-all">
                          {p.e2e}
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-[#0dcaf0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {p.tipo === "C" ? "CRÉDITO" : "DÉBITO"}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">
                          R$ {fmtCur(p.valor)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase ${p.falta === "JD"
                                ? "bg-[#ffc107]"
                                : "bg-red-500 text-white"
                              }`}
                          >
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
      {/* MODAL RESUMO JIRA (Design image_363e5c.png) */}
      {showJiraModal && jiraData && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#212529] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                🎫 Resumo JIRA
              </h3>
              <button
                onClick={() => setShowJiraModal(false)}
                className="hover:text-gray-400 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <h5 className="text-[#0d6efd] font-bold text-lg border-b pb-2">
                Conciliação referente ao dia {jiraData.dataSel}
              </h5>

              {/* Alertas Vermelhos */}
              <div className="text-red-600 font-bold text-sm space-y-1">
                {Math.abs(metrics!.diff.vc) > 0.01 && (
                  <p>
                    • Falta {Math.abs(metrics!.diff.qc)} transação de Crédito no{" "}
                    {metrics!.diff.qc > 0 ? "Core" : "JD"}.<br />
                    <span className="ml-3">
                      Diferença no Valor da conta Crédito é de R${" "}
                      {fmtCur(Math.abs(metrics!.diff.vc))}.
                    </span>
                  </p>
                )}
                {Math.abs(metrics!.diff.vd) > 0.01 && (
                  <p>
                    • Falta {Math.abs(metrics!.diff.qd)} transação de Débito no{" "}
                    {metrics!.diff.qd > 0 ? "Core" : "JD"}.<br />
                    <span className="ml-3">
                      Diferença no Valor da conta Débito é de R${" "}
                      {fmtCur(Math.abs(metrics!.diff.vd))}.
                    </span>
                  </p>
                )}
              </div>

              {/* Tabelas CORE / JD */}
              {["CORE", "JD"].map((label) => (
                <div key={label}>
                  <strong className="text-sm block mb-1 uppercase tracking-wider">
                    {label}
                  </strong>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="border p-1.5 text-left">Tipo</th>
                        <th className="border p-1.5 text-center">Qtd</th>
                        <th className="border p-1.5 text-right">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border p-1.5">C</td>
                        <td className="border p-1.5 text-center">
                          {fmtNum(
                            label === "CORE" ? metrics!.core.qc : metrics!.jd.qc
                          )}
                        </td>
                        <td className="border p-1.5 text-right">
                          {fmtCur(
                            label === "CORE" ? metrics!.core.vc : metrics!.jd.vc
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="border p-1.5">D</td>
                        <td className="border p-1.5 text-center">
                          {fmtNum(
                            label === "CORE" ? metrics!.core.qd : metrics!.jd.qd
                          )}
                        </td>
                        <td className="border p-1.5 text-right">
                          {fmtCur(
                            label === "CORE" ? metrics!.core.vd : metrics!.jd.vd
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Listas de E2Es Faltantes */}
              {jiraData.grupos.map(
                (g, idx) =>
                  g.lista.length > 0 && (
                    <div key={idx} className="space-y-1">
                      <strong className="text-xs uppercase">
                        {g.titulo} ({g.lista.length})
                      </strong>
                      <div className="bg-gray-50 border rounded p-2 max-h-24 overflow-y-auto">
                        {g.lista.map((p) => (
                          <div
                            key={p.e2e}
                            className="text-[10px] font-mono text-[#d63384] font-bold"
                          >
                            {p.e2e}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}

              <p className="text-gray-500 text-xs italic pt-4">
                Aperte no botão abaixo para copiar o texto pronto para o JIRA.
              </p>
            </div>

            {/* Footer */}
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
      )}
    </main>
  );
}

function InputMini({ label, name }: { label: string; name: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-gray-400 uppercase">
        {label}
      </label>
      <input
        name={name}
        className="w-full border-gray-100 rounded p-1 text-xs font-bold focus:ring-1 focus:ring-blue-500"
        placeholder="0"
      />
    </div>
  );
}
