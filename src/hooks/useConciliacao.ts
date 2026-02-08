/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import { ENV } from "@/config/env";
import { formatarData } from "@/api/utils/formatters";
import { fmtCur, fmtNum } from "@/libs/utils";
import { toast } from "@/libs/toast";
import { ProcessamentoRes } from "@/interfaces/processamento";

const API_URL = ENV.NEXT_PUBLIC_API_URL;
const API_FILENAME_OUTPUT = ENV.NEXT_PUBLIC_API_FILENAME_OUTPUT;

export function useConciliacao() {
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

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isVerificandoRef = useRef(false);

    useEffect(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setDataRef(yesterday.toISOString().split("T")[0]);
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

    const handleFinalizarDownload = useCallback(async (id: string) => {
        if (isVerificandoRef.current) return;
        isVerificandoRef.current = true;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        setLoaderTitle("Preparando transferência...");
        setProgress(100);

        const checkUrl = `${API_URL}/api/conciliacao/verificar-arquivo?taskId=${id}`;
        const downloadUrl = `${API_URL}/api/conciliacao/baixar-arquivo/${id}`;

        try {
            let sucesso = false;
            for (let i = 1; i <= 15; i++) {
                try {
                    const check = await fetch(checkUrl, { method: "HEAD" });
                    if (check.ok) { sucesso = true; break; }
                } catch (err) { console.warn(`Tentativa ${i}: Aguardando...`); }
                if (i < 15) {
                    setLoaderTitle(`Aguardando arquivo (${i}/15)...`);
                    await new Promise(r => setTimeout(r, 10000));
                }
            }

            if (sucesso) {
                const response = await fetch(downloadUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${API_FILENAME_OUTPUT} - ${formatarData()}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                setLoaderTitle("Download concluído!");
            } else {
                toast("error", "Tempo esgotou ao gerar arquivo.");
            }
        } catch (error) {
            toast("error", "Erro ao baixar o arquivo.");
        } finally {
            isVerificandoRef.current = false;
            limparProcessamento();
        }
    }, [limparProcessamento]);

    useEffect(() => {
        if (isLoading && taskId) {
            intervalRef.current = setInterval(async () => {
                try {
                    const r = await fetch(`${API_URL}/api/conciliacao/progress/${taskId}`);
                    const d = await r.json();
                    if (d.porcentagem >= 100) handleFinalizarDownload(taskId);
                    else {
                        setProgress(d.porcentagem || 0);
                        setLoaderTitle(d.etapa || "Processando...");
                    }
                } catch (e) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setTaskId(null);
                    setIsLoading(false);
                }
            }, 2000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isLoading, taskId, handleFinalizarDownload]);

    const handleProcessar = async (formElement: HTMLFormElement) => {
        setIsLoading(true);
        setLoaderTitle("Processando Conciliação");
        const fd = new FormData(formElement);
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

    const handleDownloadExcel = async (formElement: HTMLFormElement | null) => {
        if (!formElement) return;
        const fd = new FormData(formElement);
        if (!(fd.get("file_jd") as File)?.size || !(fd.get("file_core") as File)?.size) {
            toast("info", "Informe os arquivos CSV.");
            return;
        }
        setIsLoading(true);
        setLoaderTitle("Iniciando geração do Excel...");
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

    const parseMoeda = (v: string) => parseFloat(v?.replace(/\./g, "").replace(",", ".")) || 0;

    const metrics = useMemo(() => {
        if (!formDataValues) return null;
        const jd_qc = (parseInt(formDataValues.m_jd_qtd_c) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_c) || 0);
        const jd_vc = parseMoeda(formDataValues.m_jd_val_c);
        const jd_qd = (parseInt(formDataValues.m_jd_qtd_d) || 0) + (parseInt(formDataValues.m_jd_qtd_dev_d) || 0);
        const jd_vd = parseMoeda(formDataValues.m_jd_val_d);
        const core_qc = parseInt(formDataValues.m_core_qtd_c) || 0;
        const core_vc = parseMoeda(formDataValues.m_core_val_c);
        const core_qd = parseInt(formDataValues.m_core_qtd_d) || 0;
        const core_vd = parseMoeda(formDataValues.m_core_val_d);

        return {
            jd: { qc: jd_qc, vc: jd_vc, qd: jd_qd, vd: jd_vd },
            core: { qc: core_qc, vc: core_vc, qd: core_qd, vd: core_vd },
            diff: { qc: jd_qc - core_qc, vc: jd_vc - core_vc, qd: jd_qd - core_qd, vd: jd_vd - core_vd },
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
        const temDivergencia = Math.abs(metrics.diff.qc) > 0 || Math.abs(metrics.diff.vc) > 0.01 || Math.abs(metrics.diff.qd) > 0 || Math.abs(metrics.diff.vd) > 0.01;

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

    return {
        states: { isLoading, loaderTitle, progress, isSwapped, dataRef, fileJdName, fileCoreName, res, metrics, filteredAudit, showJiraModal, filterE2E, filterTipo, filterOri, jiraData },
        actions: {
            setIsSwapped, setDataRef, setFileJdName, setFileCoreName, handleProcessar, handleDownloadExcel, setShowJiraModal, setFilterE2E, setFilterTipo, setFilterOri, handleFileChange: (e: any, type: string) => {
                const file = e.target.files?.[0];
                const name = file ? file.name : "Nenhum arquivo escolhido";
                type === 'jd' ? setFileJdName(name) : setFileCoreName(name);
            }
        }
    };
}