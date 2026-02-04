/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import confetti from "canvas-confetti";
import { ENV } from "@/config/env";
import { formatarData } from "@/api/utils/formatters";
import { fmtCur } from "@/libs/utils";
import { toast } from "@/libs/toast";
import { ProcessamentoRes } from "@/interfaces/processamento";

const API_URL = ENV.NEXT_PUBLIC_API_URL;
const API_FILENAME_OUTPUT = ENV.NEXT_PUBLIC_API_FILENAME_OUTPUT;

export function useConciliacao() {
  const [isLoading, setIsLoading] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState("Processando");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [res, setRes] = useState<ProcessamentoRes | null>(null);
  const [formDataValues, setFormDataValues] = useState<Record<string, any> | null>(null);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [dataRef, setDataRef] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDataRef(yesterday.toISOString().split("T")[0]);
  }, []);

  const limparProcessamento = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setTimeout(() => {
      setIsLoading(false);
      setTaskId(null);
      setProgress(0);
    }, 3000);
  }, []);

  const handleFinalizarDownload = useCallback(async (id: string) => {
    setLoaderTitle("Preparando transferência...");
    const downloadUrl = `${API_URL}/api/conciliacao/baixar-arquivo/${id}`;
    
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${API_FILENAME_OUTPUT} - ${formatarData()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setLoaderTitle("Download concluído!");
    } catch (err) {
      toast("error", "Erro ao baixar arquivo.");
    }
    limparProcessamento();
  }, [limparProcessamento]);

  useEffect(() => {
    if (isLoading && taskId) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API_URL}/api/conciliacao/progress/${taskId}`);
          if (!r.ok) throw new Error();
          const d = await r.json();
          setProgress(d.porcentagem || 0);
          setLoaderTitle(d.etapa || "Processando...");
          if (d.porcentagem === 100) handleFinalizarDownload(taskId);
        } catch (e) {
          limparProcessamento();
        }
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLoading, taskId, handleFinalizarDownload, limparProcessamento]);

  const handleProcessar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    try {
      const response = await fetch(`${API_URL}/api/conciliacao/processar`, { method: "POST", body: fd });
      const data = await response.json();
      if (data.success) {
        setRes(data);
        setFormDataValues(Object.fromEntries(fd));
      } else {
        toast("error", "Verifique os dados informados.");
      }
    } catch (err) {
      toast("error", "Erro no processamento.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    if (!(fd.get("file_jd") as File)?.size || !(fd.get("file_core") as File)?.size) {
      toast("info", "Informe os arquivos CSV.");
      return;
    }
    setIsLoading(true);
    setProgress(0);
    try {
      const response = await fetch(`${API_URL}/api/conciliacao/gerar-excel`, { method: "POST", body: fd });
      const data = await response.json();
      if (data.success) setTaskId(data.taskId);
      else throw new Error(data.message);
    } catch (err: any) {
      toast("error", err.message || "Erro ao iniciar geração.");
      setIsLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (!formDataValues) return null;
    const parseM = (v: string) => parseFloat(v?.replace(/\./g, "").replace(",", ".")) || 0;
    const jd_qc = (parseInt(formDataValues.m_jd_qtd_c) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_c) || 0);
    const jd_vc = parseM(formDataValues.m_jd_val_c);
    const jd_qd = (parseInt(formDataValues.m_jd_qtd_d) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_d) || 0);
    const jd_vd = parseM(formDataValues.m_jd_val_d);
    const core_qc = parseInt(formDataValues.m_core_qtd_c) || 0;
    const core_vc = parseM(formDataValues.m_core_val_c);
    const core_qd = parseInt(formDataValues.m_core_qtd_d) || 0;
    const core_vd = parseM(formDataValues.m_core_val_d);

    return {
      jd: { qc: jd_qc, vc: jd_vc, qd: jd_qd, vd: jd_vd },
      core: { qc: core_qc, vc: core_vc, qd: core_qd, vd: core_vd },
      diff: { qc: jd_qc - core_qc, vc: jd_vc - core_vc, qd: jd_qd - core_qd, vd: jd_vd - core_vd }
    };
  }, [formDataValues]);

  const jiraData = useMemo(() => {
    if (!res || !metrics) return null;
    const dataSel = dataRef.split("-").reverse().join("/");
    const filterP = (f: string, t: string) => res.pendencias.filter(p => p.falta === f && p.tipo === t);
    
    const grupos = [
      { titulo: "E2E faltante na JD Crédito", lista: filterP("JD", "C") },
      { titulo: "E2E faltante na JD Débito", lista: filterP("JD", "D") },
      { titulo: "E2E faltante no Core Crédito", lista: filterP("CORE", "C") },
      { titulo: "E2E faltante no Core Débito", lista: filterP("CORE", "D") }
    ];

    const temDivergencia = Math.abs(metrics.diff.qc) > 0 || Math.abs(metrics.diff.vc) > 0.01 || Math.abs(metrics.diff.qd) > 0 || Math.abs(metrics.diff.vd) > 0.01;

    let textoClipboard = `*Conciliação referente ao dia ${dataSel}*\n\n`;
    if (!temDivergencia) {
      textoClipboard += `✅ *Conciliação realizada com sucesso!*\n`;
    } else {
      if (Math.abs(metrics.diff.vc) > 0.01) textoClipboard += `* Falta Crédito no ${metrics.diff.vc > 0 ? "Core" : "JD"}: R$ ${fmtCur(Math.abs(metrics.diff.vc))}\n`;
      if (Math.abs(metrics.diff.vd) > 0.01) textoClipboard += `* Falta Débito no ${metrics.diff.vd > 0 ? "Core" : "JD"}: R$ ${fmtCur(Math.abs(metrics.diff.vd))}\n`;
    }

    return { dataSel, grupos, temDivergencia, textoClipboard };
  }, [res, metrics, dataRef]);

  const copiarParaJira = useCallback(() => {
    if (jiraData) {
      navigator.clipboard.writeText(jiraData.textoClipboard);
      toast("success", "Copiado para o JIRA!");
    }
  }, [jiraData]);

  return {
    state: { isLoading, loaderTitle, progress, res, showJiraModal, dataRef },
    refs: { formRef },
    actions: { handleProcessar, handleDownloadExcel, setDataRef, setShowJiraModal, copiarParaJira },
    calculatedData: { metrics, jiraData }
  };
}