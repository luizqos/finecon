/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ArrowLeftRight,
  Rocket,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import confetti from "canvas-confetti";
import { ENV } from "@/config/env";
import { formatarData } from "@/api/utils/formatters";
import { fmtCur, fmtNum } from "@/libs/utils";
import { toast } from "@/libs/toast";
import { ProcessamentoRes } from "@/interfaces/processamento";
import { InputOriginal } from "@/components/InputOriginal";
import { ProcessingLoader } from "@/components/ProcessingLoader";

const API_URL = ENV.NEXT_PUBLIC_API_URL;
const API_FILENAME_OUTPUT = ENV.NEXT_PUBLIC_API_FILENAME_OUTPUT;

export default function ConciliacaoPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState("Processando");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [dataRef, setDataRef] = useState("");
  const [fileJdName, setFileJdName] = useState("Nenhum arquivo escolhido");
  const [fileCoreName, setFileCoreName] = useState("Nenhum arquivo escolhido");

  const [res, setRes] = useState<ProcessamentoRes | null>(null);
  const [formDataValues, setFormDataValues] = useState<Record<string, any> | null>(null);

  const [filterE2E, setFilterE2E] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterOri, setFilterOri] = useState("");
  const [showJiraModal, setShowJiraModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDataRef(yesterday.toISOString().split("T")[0]);
  }, []);

  const interromperProcessamento = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTaskId(null);
    setTimeout(() => setIsLoading(false), 3000);
  }, []);

  const limparProcessamento = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimeout(() => {
      setIsLoading(false);
      setTaskId(null);
      setProgress(0);
      setLoaderTitle("Processando");
    }, 3000);
  }, []);

  const handleFinalizarDownload2 = useCallback(async (id: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setLoaderTitle("Preparando transferência...");
    setProgress(100);

    const downloadUrl = `${API_URL}/api/conciliacao/baixar-arquivo/${id}`;
    const maxTentativas = 15;
    let sucesso = false;

    for (let i = 0; i < maxTentativas; i++) {
      try {
        const check = await fetch(downloadUrl, { method: "HEAD" });
        if (check.ok) {
          sucesso = true;
          break;
        }
      } catch (err) {
        console.warn("Ficheiro ainda não disponível...");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (sucesso) {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Erro ao baixar o arquivo");

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        const nomeFormatado = `${API_FILENAME_OUTPUT} - ${formatarData()}.xlsx`;
        a.download = nomeFormatado;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#22c55e", "#3b82f6", "#f59e0b"],
        });

        setLoaderTitle("Download concluído!");
      } catch (err) {
        console.error(err);
      }
    } else {
      toast("error", "O tempo de espera esgotou. Tente gerar o arquivo novamente.");
    }
    limparProcessamento();
  }, [limparProcessamento]);

  const handleFinalizarDownload = useCallback(async (id: string) => {
    setLoaderTitle("Preparando transferência...");
    setProgress(100);

    const downloadUrl = `${API_URL}/api/conciliacao/baixar-arquivo/${id}`;
    const maxTentativas = 15;
    let sucesso = false;

    for (let i = 0; i < maxTentativas; i++) {
      try {
       const check = await fetch(downloadUrl, { method: "HEAD" });
        if (check.ok) {
          sucesso = true;
          break;
        }
      } catch (err) {
        console.warn("Tentativa de conexão falhou, tentando novamente...");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (sucesso) {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Erro ao baixar o arquivo");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const nomeFormatado = `${API_FILENAME_OUTPUT} - ${formatarData()}.xlsx`;
        a.download = nomeFormatado;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#22c55e", "#3b82f6", "#f59e0b"],
        });

        setLoaderTitle("Download concluído!");
      } catch (err) {
        console.error(err);
        toast("error", "Erro ao processar o arquivo baixado.");
      }
    } else {
      toast("error", "O tempo de espera esgotou ou o servidor falhou ao gerar o arquivo.");
    }
    limparProcessamento();
  }, [limparProcessamento]);

  useEffect(() => {
    if (isLoading && taskId) {
      const currentTaskId = taskId;

      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API_URL}/api/conciliacao/progress/${currentTaskId}`);
          if (!r.ok) {
            throw new Error("Tarefa não encontrada ou erro no servidor");
          }

          const d = await r.json();
          setProgress(d.porcentagem || 0);
          setLoaderTitle(d.etapa || "Processando...");

          if (d.porcentagem === 100) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setTaskId(null);
            handleFinalizarDownload(currentTaskId);
          }
        } catch (e) {
          console.error("Erro no polling:", e);
          interromperProcessamento();
        }
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLoading, taskId, handleFinalizarDownload, interromperProcessamento]);

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
        toast("error", "Verifique os dados informados.");
      }
    } catch (err) {
      toast("info", "Erro ao processar ficheiros.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'jd' | 'core') => {
    const file = e.target.files?.[0];
    const fileName = file ? file.name : "Nenhum arquivo escolhido";
    if (type === 'jd') setFileJdName(fileName);
    else setFileCoreName(fileName);
  };

  const handleDownloadExcel = async () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    if (!(fd.get("file_jd") as File)?.size || !(fd.get("file_core") as File)?.size) {
      toast("info", "Informe o arquivo CSV.");
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
      if (data.success) setTaskId(data.taskId);
      else throw new Error(data.message);
    } catch (err: any) {
      toast("error", err.message || "Erro ao iniciar geração.");
      setIsLoading(false);
    }
  };

  const parseMoeda = (v: string) =>
    parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

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

    const grupos = [
      { titulo: "E2E faltante na JD Crédito", lista: res.pendencias.filter((p) => p.falta === "JD" && p.tipo === "C") },
      { titulo: "E2E faltante na JD Débito", lista: res.pendencias.filter((p) => p.falta === "JD" && p.tipo === "D") },
      { titulo: "E2E faltante no Core Crédito", lista: res.pendencias.filter((p) => p.falta === "CORE" && p.tipo === "C") },
      { titulo: "E2E faltante no Core Débito", lista: res.pendencias.filter((p) => p.falta === "CORE" && p.tipo === "D") },
    ];

    const temDivergencia =
      Math.abs(metrics.diff.qc) > 0 ||
      Math.abs(metrics.diff.vc) > 0.01 ||
      Math.abs(metrics.diff.qd) > 0 ||
      Math.abs(metrics.diff.vd) > 0.01;

    let textoClipboard = `*Conciliação referente ao dia ${dataSel}*\n\n`;

    if (!temDivergencia) {
      textoClipboard += `✅ *Conciliação realizada com sucesso! Não foram encontradas divergências.*\n`;
    } else {
      const addAlerta = (diffQ: number, diffV: number, tipo: string) => {
        if (Math.abs(diffQ) > 0 || Math.abs(diffV) > 0.01) {
          const local = diffQ > 0 ? "Core" : "JD";
          textoClipboard += `* Falta ${Math.abs(diffQ)} transação de ${tipo} no ${local}.\n`;
          textoClipboard += `  Diferença no Valor da conta ${tipo} é de R$ ${fmtCur(Math.abs(diffV))}.\n`;
        }
      };
      addAlerta(metrics.diff.qc, metrics.diff.vc, "Crédito");
      addAlerta(metrics.diff.qd, metrics.diff.vd, "Débito");
    }

    textoClipboard += `\n*CORE*\nC: ${fmtNum(metrics.core.qc)} | R$ ${fmtCur(metrics.core.vc)}\nD: ${fmtNum(metrics.core.qd)} | R$ ${fmtCur(metrics.core.vd)}\n`;
    textoClipboard += `\n*JD*\nC: ${fmtNum(metrics.jd.qc)} | R$ ${fmtCur(metrics.jd.vc)}\nD: ${fmtNum(metrics.jd.qd)} | R$ ${fmtCur(metrics.jd.vd)}\n`;

    grupos.forEach((g) => {
      if (g.lista.length > 0) {
        textoClipboard += `\n*${g.titulo} (${g.lista.length})*\n${g.lista.map((p) => p.e2e).join("\n")}\n`;
      }
    });

    return { dataSel, grupos, textoClipboard, temDivergencia };
  }, [res, metrics, dataRef]);

  const copiarParaJira = () => {
    if (jiraData) {
      navigator.clipboard.writeText(jiraData.textoClipboard);
      toast("success", "Texto copiado para o JIRA!");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 md:px-8 text-gray-800">
      <ProcessingLoader
        isLoading={isLoading}
        title={loaderTitle}
        progress={progress}
      />
      <div className="max-w-6xl mx-auto">
        <h1 className="flex items-center justify-center gap-3 text-4xl font-extrabold text-[#212529] mb-10 tracking-tight">
          <span className="text-4xl">📊</span> Conciliação JD vs Core
        </h1>

        <form ref={formRef} onSubmit={handleProcessar} className="space-y-6">
          <div className="flex justify-center">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm text-center">
              <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 tracking-widest">Data do Movimento</label>
              <input
                type="date"
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                className="w-full bg-[#f1f3f5] border-none rounded-xl py-3 px-4 font-bold text-center text-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start pb-4">
            <button
              type="button"
              onClick={() => setIsSwapped(!isSwapped)}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30 bg-[#212529] text-white p-3 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all hidden lg:flex items-center justify-center border-4 border-[#f8f9fa]"
            >
              <ArrowLeftRight size={20} />
            </button>

            {/* CARD JD */}
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#0d6efd] transition-all duration-700 ease-in-out z-10 ${isSwapped ? "lg:translate-x-[calc(100%+2rem)]" : "translate-x-0"}`}>
              <h6 className="font-extrabold text-[#0d6efd] mb-6 text-sm uppercase tracking-wider">Dados JD (CSV)</h6>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6 bg-white">
                <label className="bg-[#f8f9fa] border-r border-gray-200 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-100">
                  Escolher arquivo
                  <input type="file" name="file_jd" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e, 'jd')} />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">{fileJdName}</span>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-5">
                <InputOriginal label="Qtd Crédito" name="m_jd_qtd_c" />
                <InputOriginal label="Qtd Dev Cred" name="m_jd_qtd_dev_c" />
                <InputOriginal label="Valor Crédito" name="m_jd_val_c" placeholder="0,00" />
                <InputOriginal label="Qtd Débito" name="m_jd_qtd_d" />
                <InputOriginal label="Qtd Dev Deb" name="m_jd_qtd_dev_d" />
                <InputOriginal label="Valor Débito" name="m_jd_val_d" placeholder="0,00" />
              </div>
            </div>

            {/* CARD CORE */}
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#212529] transition-all duration-700 ease-in-out z-10 ${isSwapped ? "lg:-translate-x-[calc(100%+2rem)]" : "translate-x-0"}`}>
              <h6 className="font-extrabold text-[#212529] mb-6 text-sm uppercase tracking-wider">Dados Core (CSV)</h6>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6 bg-white">
                <label className="bg-[#f8f9fa] border-r border-gray-200 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-100">
                  Escolher arquivo
                  <input type="file" name="file_core" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e, 'core')} />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">{fileCoreName}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <InputOriginal label="Qtd Crédito" name="m_core_qtd_c" />
                <InputOriginal label="Valor Crédito" name="m_core_val_c" placeholder="0,00" />
                <InputOriginal label="Qtd Débito" name="m_core_qtd_d" />
                <InputOriginal label="Valor Débito" name="m_core_val_d" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all active:scale-95">
              <Rocket size={20} /> PROCESSAR
            </button>
            <button type="button" onClick={handleDownloadExcel} className="bg-green-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-green-700 shadow-lg transition-all active:scale-95">
              <FileSpreadsheet size={20} /> GERAR AUDITORIA
            </button>
          </div>
        </form>

        {/* RESULTADO */}
        {res && metrics && (
          <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Resultado ({dataRef.split("-").reverse().join("/")})</h2>
                <button onClick={() => setShowJiraModal(true)} className="bg-[#212529] text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors">
                  <span className="text-[10px]">🎫</span> JIRA
                </button>
              </div>

              {/* MÉTRICAS */}
              <div className="overflow-x-auto border border-gray-200 rounded mb-8">
                <table className="w-full text-center border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#212529] text-white text-xs uppercase">
                      <th className="p-3 font-bold border-r border-gray-700 text-left">Métrica</th>
                      <th className="p-3 font-bold border-r border-gray-700">JD</th>
                      <th className="p-3 font-bold border-r border-gray-700">Core</th>
                      <th className="p-3 font-bold border-r border-gray-700">Diferença</th>
                      <th className="p-3 font-bold italic text-gray-400">Ref. Planilha JD</th>
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
                        <td className="p-3 text-left font-bold bg-gray-50 border-r">{row.label}</td>
                        <td className="p-3 border-r">{row.isCur ? fmtCur(row.jd) : fmtNum(row.jd)}</td>
                        <td className="p-3 border-r">{row.isCur ? fmtCur(row.core) : fmtNum(row.core)}</td>
                        <td className={`p-3 border-r font-bold ${Math.abs(row.diff) > 0.01 ? "bg-red-100 text-red-600" : ""}`}>
                          {row.isCur ? fmtCur(row.diff) : fmtNum(row.diff)}
                        </td>
                        <td className="p-3 text-gray-500 italic">{row.isCur ? fmtCur(row.ref) : fmtNum(row.ref)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <input placeholder="Filtrar ID..." className="flex-1 min-w-[200px] border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" onChange={(e) => setFilterE2E(e.target.value)} />
                <select className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" onChange={(e) => setFilterTipo(e.target.value)}>
                  <option value="">Tipos</option>
                  <option value="C">Crédito</option>
                  <option value="D">Débito</option>
                </select>
                <select className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" onChange={(e) => setFilterOri(e.target.value)}>
                  <option value="">Pendências</option>
                  <option value="CORE">Falta no Core</option>
                  <option value="JD">Falta na JD</option>
                </select>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="w-full text-sm min-w-[600px]">
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
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-bold text-[#d63384] break-all">{p.e2e}</td>
                        <td className="p-3 text-center">
                          <span className="bg-[#0dcaf0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
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
        )}
      </div>
      {showJiraModal && jiraData && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[#212529] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">🎫 Resumo JIRA</h3>
              <button onClick={() => setShowJiraModal(false)} className="hover:text-gray-400 text-2xl">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <h5 className="text-[#0d6efd] font-bold text-lg border-b pb-2">Conciliação referente ao dia {jiraData.dataSel}</h5>
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
                  {Math.abs(metrics!.diff.vc) > 0.01 && (
                    <p className="text-sm">
                      • Falta <b>{Math.abs(metrics!.diff.qc)}</b> transação de Crédito no <b>{metrics!.diff.qc > 0 ? "Core" : "JD"}</b>.<br />
                      <span className="ml-3 text-xs">Diferença de Valor: R$ {fmtCur(Math.abs(metrics!.diff.vc))}.</span>
                    </p>
                  )}
                  {Math.abs(metrics!.diff.vd) > 0.01 && (
                    <p className="text-sm">
                      • Falta <b>{Math.abs(metrics!.diff.qd)}</b> transação de Débito no <b>{metrics!.diff.qd > 0 ? "Core" : "JD"}</b>.<br />
                      <span className="ml-3 text-xs">Diferença de Valor: R$ {fmtCur(Math.abs(metrics!.diff.vd))}.</span>
                    </p>
                  )}
                </div>
              )}
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
                          <td className="p-1.5 text-center">{fmtNum(label === "CORE" ? metrics!.core.qc : metrics!.jd.qc)}</td>
                          <td className="p-1.5 text-right">R$ {fmtCur(label === "CORE" ? metrics!.core.vc : metrics!.jd.vc)}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-1.5 font-bold">D</td>
                          <td className="p-1.5 text-center">{fmtNum(label === "CORE" ? metrics!.core.qd : metrics!.jd.qd)}</td>
                          <td className="p-1.5 text-right">R$ {fmtCur(label === "CORE" ? metrics!.core.vd : metrics!.jd.vd)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              {jiraData.grupos.map((g, idx) => g.lista.length > 0 && (
                <div key={idx} className="space-y-1">
                  <strong className="text-[10px] text-gray-500 uppercase tracking-widest">{g.titulo} ({g.lista.length})</strong>
                  <div className="bg-gray-50 border rounded p-2 max-h-24 overflow-y-auto">
                    {g.lista.map((p) => <div key={p.e2e} className="text-[10px] font-mono text-[#d63384] font-bold">{p.e2e}</div>)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button onClick={copiarParaJira} className="bg-[#0d6efd] text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors shadow-lg">
                Copiar para o JIRA
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}