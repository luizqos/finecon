/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import { ENV } from "@/config/env";
import { formatarData } from "@/api/utils/formatters";
import { fmtCur, fmtNum } from "@/libs/utils";
import { toast } from "@/libs/toast";
import { ProcessamentoRes } from "@/interfaces/processamento";
import { Console } from "console";

const API_URL = ENV.NEXT_PUBLIC_API_URL;
const API_FILENAME_OUTPUT = ENV.NEXT_PUBLIC_API_FILENAME_OUTPUT;

export function useConciliacao() {
  const [jdForm, setJdForm] = useState({
    m_jd_qtd_c: "",
    m_jd_qtd_dev_c: "",
    m_jd_val_c: "",
    m_jd_qtd_d: "",
    m_jd_qtd_dev_d: "",
    m_jd_val_d: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState("Processando");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [dataRef, setDataRef] = useState("");
  const [fileJdName, setFileJdName] = useState("Nenhum arquivo escolhido");
  const [fileCoreName, setFileCoreName] = useState("Nenhum arquivo escolhido");

  const [res, setRes] = useState<ProcessamentoRes | null>(null);
  const [formDataValues, setFormDataValues] = useState<Record<
    string,
    any
  > | null>(null);

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

  const handleFinalizarDownload = useCallback(
    async (id: string) => {
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
            if (check.ok) {
              sucesso = true;
              break;
            }
          } catch (err) {
            console.warn(`Tentativa ${i}: Aguardando...`);
          }
          if (i < 15) {
            setLoaderTitle(`Aguardando arquivo (${i}/15)...`);
            await new Promise((r) => setTimeout(r, 10000));
          }
        }

        if (sucesso) {
          const response = await fetch(downloadUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${API_FILENAME_OUTPUT} - ${formatarData()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          setLoaderTitle("Download concluído!");
        } else {
          toast("error", "Tempo esgotou ao gerar arquivo.");
        }
      } catch (error) {
        toast("error", "Ocorreu um erro ao baixar o arquivo.");
      } finally {
        isVerificandoRef.current = false;
        limparProcessamento();
      }
    },
    [limparProcessamento]
  );

  useEffect(() => {
    if (isLoading && taskId) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(
            `${API_URL}/api/conciliacao/progress/${taskId}`
          );
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setJdForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImportPDFOld = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setLoaderTitle("Lendo PDF...");
      setProgress(10);

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const arrayBuffer = await file.arrayBuffer();
        setProgress(30);

        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          useWorkerFetch: true,
          isEvalSupported: false,
        });

        const pdf = await loadingTask.promise;
        let fullText = "";
        setProgress(50);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(" ");

          const partialProgress = 50 + (i / pdf.numPages) * 40;
          setProgress(Math.round(partialProgress));
        }

        console.log('FullText', fullText);
        const qtdMatch = fullText.match(/DÉBITOS.*?(\d+)\s+0\s+\d+\s+(\d+)/);
        const devMatch = fullText.match(
          /DEVOLUÇÃO DÉBITOS.*?(\d+)\s+0\s+\d+\s+(\d+)/
        );
        const valMatch = fullText.match(
          /R\$\s?([\d.,]+)\s+R\$\s?0,00\s+R\$\s?[\d.,]+\s+R\$\s?([\d.,]+)/
        );
        console.log('qtdMatch', qtdMatch, 'devMatch', devMatch, 'valMatch', valMatch);

        if (qtdMatch && valMatch && devMatch) {
          setJdForm({
            m_jd_qtd_d: qtdMatch[1],
            m_jd_qtd_c: qtdMatch[2],
            m_jd_qtd_dev_d: devMatch[1],
            m_jd_qtd_dev_c: devMatch[2],
            m_jd_val_d: valMatch[1],
            m_jd_val_c: valMatch[2],
          });

          const dataMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dataMatch) {
            const [d, m, y] = dataMatch[1].split("/");
            setDataRef(`${y}-${m}-${d}`);
          }

          setProgress(100);
          setLoaderTitle("Dados extraídos!");
          toast("success", "Dados JD preenchidos via PDF!");
        } else {
          toast("error", "Não foi possível mapear os campos.");
        }
      } catch (error: any) {
        console.error("Erro PDF:", error);
        toast("error", `Falha ao ler PDF: ${error.message}`);
      } finally {
        setTimeout(() => {
          setIsLoading(false);
          setProgress(0);
        }, 800);
      }
    },
    [setIsLoading, setLoaderTitle, setProgress, setDataRef, setJdForm]
  );

  const handleImportPDF = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setLoaderTitle("Extraindo dados do PDF...");
      setProgress(10);

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          useWorkerFetch: true,
          isEvalSupported: false,
        });

        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // Unir com espaço simples e remover quebras de linha extras para normalizar o texto
          fullText += content.items
            .map((item: any) => item.str)
            .join(" ")
            .replace(/\s+/g, " ");
          setProgress(Math.round(10 + (i / pdf.numPages) * 80));
        }

        /**
         * NOVA LÓGICA DE EXTRAÇÃO:
         * Em vez de procurar "0", buscamos a sequência de números que compõe a tabela.
         * O relatório JDPI possui 6 colunas na tabela de totais (3 para Débito, 3 para Crédito).
         */

        // 1. Extrair Quantidades (Procura por DÉBITOS e pega os próximos 6 números inteiros)
        const qtdRegex =
          /DÉBITOS.*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
        const qtdMatch = fullText.match(qtdRegex);

        // 2. Extrair Devoluções (Procura por DEVOLUÇÃO DÉBITOS e pega os próximos 6 números) [cite: 10]
        const devRegex =
          /DEVOLUÇÃO DÉBITOS.*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
        const devMatch = fullText.match(devRegex);

        // 3. Extrair Valores Monetários (Procura por R$ e pega a sequência de 6 valores)
        // Captura o padrão R$ 1.234,56 ou R$ 1234.56
        const valRegex = /(?:R\$\s?([\d.,]+)\s?){6}/;
        const valMatch = fullText.match(valRegex);

        // Se o valMatch acima falhar, tentamos uma busca mais específica após a palavra DEVOLUÇÃO CRÉDITOS
        const valTableMatch = fullText.match(
          /DEVOLUÇÃO CRÉDITOS.*?R\$\s?([\d.,]+).*?R\$\s?[\d.,]+.*?R\$\s?[\d.,]+.*?R\$\s?([\d.,]+)/
        );

        if (qtdMatch && devMatch) {
          setJdForm({
            m_jd_qtd_d: qtdMatch[1], // 1º valor: Efetivados Débito (ex: 1852) [cite: 9]
            m_jd_qtd_c: qtdMatch[4], // 4º valor: Efetivados Crédito (ex: 14165) [cite: 9]
            m_jd_qtd_dev_d: devMatch[1], // 1º valor: Devolução Débito (ex: 23) [cite: 10]
            m_jd_qtd_dev_c: devMatch[4], // 4º valor: Devolução Crédito (ex: 3) [cite: 10]
            // Valores monetários:
            m_jd_val_d: valTableMatch ? valTableMatch[1] : "", // R$ 1.478.083,89
            m_jd_val_c: valTableMatch ? valTableMatch[2] : "", // R$ 6.643.182,07
          });

          // Sincronizar Data [cite: 3, 5]
          const dataMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dataMatch) {
            const [d, m, y] = dataMatch[1].split("/");
            setDataRef(`${y}-${m}-${d}`);
          }

          toast("success", "Dados extraídos com precisão!");
        } else {
          toast("error", "Não foi possível processar a estrutura deste PDF.");
        }
      } catch (error: any) {
        console.error("Erro na extração:", error);
        toast("error", "Erro ao ler o arquivo PDF.");
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    },
    [setDataRef]
  );

  const handleDownloadExcel = async (formElement: HTMLFormElement | null) => {
    if (!formElement) return;
    const fd = new FormData(formElement);
    if (
      !(fd.get("file_jd") as File)?.size ||
      !(fd.get("file_core") as File)?.size
    ) {
      toast("info", "Informe os arquivos CSV.");
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
    parseFloat(v?.replace(/\./g, "").replace(",", ".")) || 0;

  const metrics = useMemo(() => {
    if (!formDataValues) return null;
    const jd_qc =
      (parseInt(formDataValues.m_jd_qtd_c) || 0) +
      (parseInt(formDataValues.m_jd_qtd_dev_c) || 0);
    const jd_vc = parseMoeda(formDataValues.m_jd_val_c);
    const jd_qd =
      (parseInt(formDataValues.m_jd_qtd_d) || 0) +
      (parseInt(formDataValues.m_jd_qtd_dev_d) || 0);
    const jd_vd = parseMoeda(formDataValues.m_jd_val_d);
    const core_qc = parseInt(formDataValues.m_core_qtd_c) || 0;
    const core_vc = parseMoeda(formDataValues.m_core_val_c);
    const core_qd = parseInt(formDataValues.m_core_qtd_d) || 0;
    const core_vd = parseMoeda(formDataValues.m_core_val_d);

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
    }

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

    return { dataSel, grupos, textoClipboard, temDivergencia };
  }, [res, metrics, dataRef]);

  return {
    jdForm,
    handleInputChange,
    handleImportPDF,
    states: {
      isLoading,
      loaderTitle,
      progress,
      isSwapped,
      dataRef,
      fileJdName,
      fileCoreName,
      res,
      metrics,
      filteredAudit,
      showJiraModal,
      filterE2E,
      filterTipo,
      filterOri,
      jiraData,
    },
    actions: {
      setIsSwapped,
      setDataRef,
      setFileJdName,
      setFileCoreName,
      handleProcessar,
      handleDownloadExcel,
      setShowJiraModal,
      setFilterE2E,
      setFilterTipo,
      setFilterOri,
      handleFileChange: (e: any, type: string) => {
        const file = e.target.files?.[0];
        const name = file ? file.name : "Nenhum arquivo escolhido";
        type === "jd" ? setFileJdName(name) : setFileCoreName(name);
      },
    },
  };
}
