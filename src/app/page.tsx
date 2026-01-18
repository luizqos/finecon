/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeftRight,
  Rocket,
  FileSpreadsheet,
  ClipboardCheck,
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
    setLoaderTitle("Cruzando dados financeiros");
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
        <h1 className="text-3xl font-black text-center mb-8 uppercase italic tracking-tighter">
          📊 Conciliação Finecon
        </h1>

        <form ref={formRef} onSubmit={handleProcessar} className="space-y-6">
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
              <label className="block text-center text-[10px] font-black text-gray-400 uppercase mb-2">
                Data Referência
              </label>
              <input
                type="date"
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                className="bg-gray-50 border-0 rounded-lg font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            <div
              className={`${
                isSwapped ? "lg:order-2" : "lg:order-1"
              } bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600`}
            >
              <h6 className="font-black text-blue-600 mb-4 text-xs uppercase">
                Arquivo JD (CSV)
              </h6>
              <input
                type="file"
                name="file_jd"
                accept=".csv"
                className="w-full text-sm mb-4"
              />
              <div className="grid grid-cols-3 gap-2">
                <InputMini label="Qtd C" name="m_jd_qtd_c" />
                <InputMini label="Dev C" name="m_jd_qtd_dev_c" />
                <InputMini label="Val C" name="m_jd_val_c" />
                <InputMini label="Qtd D" name="m_jd_qtd_d" />
                <InputMini label="Dev D" name="m_jd_qtd_dev_d" />
                <InputMini label="Val D" name="m_jd_val_d" />
              </div>
            </div>

            <div
              className={`${
                isSwapped ? "lg:order-1" : "lg:order-2"
              } bg-white p-6 rounded-xl shadow-sm border-l-4 border-gray-900`}
            >
              <h6 className="font-black text-gray-900 mb-4 text-xs uppercase">
                Arquivo Core (CSV)
              </h6>
              <input
                type="file"
                name="file_core"
                accept=".csv"
                className="w-full text-sm mb-4"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputMini label="Qtd Crédito" name="m_core_qtd_c" />
                <InputMini label="Val Crédito" name="m_core_val_c" />
                <InputMini label="Qtd Débito" name="m_core_qtd_d" />
                <InputMini label="Val Débito" name="m_core_val_d" />
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

        {res && metrics && (
          <div className="mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Tabela de Resultados (JD vs Core) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <h4 className="font-black text-xl mb-6">Métricas de Diferença</h4>
              <table className="w-full text-center text-sm">
                <thead className="bg-gray-900 text-white font-black text-xs uppercase">
                  <tr>
                    <th className="p-3">Métrica</th>
                    <th>JD</th>
                    <th>Core</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  <tr className="border-b">
                    <td>Crédito (Val)</td>
                    <td>{fmtCur(metrics.jd.vc)}</td>
                    <td>{fmtCur(metrics.core.vc)}</td>
                    <td
                      className={
                        metrics.diff.vc !== 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      R$ {fmtCur(metrics.diff.vc)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td>Débito (Val)</td>
                    <td>{fmtCur(metrics.jd.vd)}</td>
                    <td>{fmtCur(metrics.core.vd)}</td>
                    <td
                      className={
                        metrics.diff.vd !== 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      R$ {fmtCur(metrics.diff.vd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Lista de Auditoria / Pendências */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  placeholder="Filtrar ID..."
                  className="border rounded-lg p-2 text-sm"
                  onChange={(e) => setFilterE2E(e.target.value)}
                />
                <select
                  className="border rounded-lg p-2 text-sm"
                  onChange={(e) => setFilterTipo(e.target.value)}
                >
                  <option value="">Tipos (Todos)</option>
                  <option value="C">Crédito</option>
                  <option value="D">Débito</option>
                </select>
                <select
                  className="border rounded-lg p-2 text-sm"
                  onChange={(e) => setFilterOri(e.target.value)}
                >
                  <option value="">Pendências (Todas)</option>
                  <option value="CORE">Falta no Core</option>
                  <option value="JD">Falta na JD</option>
                </select>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b font-black">
                    <tr>
                      <th className="p-3 text-left">E2E ID</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((p, i) => (
                      <tr key={i} className="border-b hover:bg-blue-50/30">
                        <td className="p-3 font-mono">{p.e2e}</td>
                        <td className="text-center">
                          {p.tipo === "C" ? "CRED" : "DEB"}
                        </td>
                        <td className="text-center font-bold">
                          R$ {fmtCur(p.valor)}
                        </td>
                        <td className="text-center font-black">{p.falta}</td>
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
