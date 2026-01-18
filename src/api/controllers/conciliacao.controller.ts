/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import csv from 'csv-parser';
import fs from 'fs';
import { limparTexto, formatarValor } from '../utils/formatters';
import path from 'path';

export const excelProgress: Record<string, { porcentagem: number; linhas: number; etapa: string }> = {};

/**
 * Utilitário: Processa em lotes para manter o Event Loop livre para o polling de progresso.
 */
async function executarEmLotes<T>(data: T[], batchSize: number, callback: (item: T) => void) {
  for (let i = 0; i < data.length; i += batchSize) {
    const lote = data.slice(i, i + batchSize);
    lote.forEach(callback);
    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Helper: Atualiza o status global.
 */
function atualizarStatus(taskId: string, porcentagem: number, linhas: number, etapa: string) {
  if (excelProgress[taskId]) {
    excelProgress[taskId] = { porcentagem, linhas, etapa };
  }
}

export const baixarArquivo = async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const status = excelProgress[taskId];

  if (!status || status.porcentagem !== 100) {
    return res.status(404).end();
  }

  const filePath = (status as any).downloadPath;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).end();
  }

  // Se for apenas uma verificação (HEAD), retornamos 200 OK sem enviar o arquivo
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  // Se for GET, envia o arquivo e limpa depois
  res.download(filePath, "Auditoria.xlsx", (err) => {
    if (!err) {
      fs.unlinkSync(filePath);
      delete excelProgress[taskId];
    }
  });
};

export const gerarExcel = async (req: Request, res: Response) => {
  const taskId = req.body.taskId || `task_${Date.now()}`;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  // 1. Inicializa o objeto de progresso
  excelProgress[taskId] = {
    porcentagem: 0,
    linhas: 0,
    etapa: "Iniciando processamento...",
  };

  // 2. Responde imediatamente ao frontend
  res.status(202).json({
    success: true,
    message: "Processamento iniciado em segundo plano",
    taskId,
  });

  // 3. Inicia o trabalho pesado em "Background" (sem await para não travar a resposta)
  (async () => {
    try {
      const jd_c: string[] = [];
      const jd_d: string[] = [];
      const core_c: string[] = [];
      const core_d: string[] = [];

      // --- ETAPA DE LEITURA (Streams) ---
      atualizarStatus(taskId, 25, 0, `Gerando arquivo`);
      await new Promise((resolve, reject) => {
        let isHeader = true;
        fs.createReadStream(files.file_jd[0].path)
          .pipe(csv({ separator: ";", headers: false }))
          .on("data", (row) => {
            if (isHeader) {
              isHeader = false;
              return;
            }
            if (
              Object.keys(row).length >= 19 &&
              limparTexto(row[18]) === "EFETIVADO"
            ) {
              const tipo = limparTexto(row[5]).includes("CREDITO") ? "C" : "D";
              const e2e = limparTexto(row[2]);
              if (tipo === "C") jd_c.push(e2e);
              else jd_d.push(e2e);
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // --- 1.2 LEITURA CORE (DETECÇÃO DINÂMICA) ---
      const contentSample = fs
        .readFileSync(files.file_core[0].path, "utf8")
        .slice(0, 1000);
      const sep = contentSample.includes(";") ? ";" : ",";

      await new Promise((resolve, reject) => {
        let isHeader = true;
        fs.createReadStream(files.file_core[0].path)
          .pipe(csv({ separator: sep, headers: false }))
          .on("data", (row) => {
            if (isHeader) {
              isHeader = false;
              return;
            }
            if (Object.keys(row).length >= 2) {
              const tipo = limparTexto(row[0]);
              const e2e = limparTexto(row[1]);
              if (tipo === "C") core_c.push(e2e);
              else if (tipo === "D") core_d.push(e2e);
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // --- ETAPA DE MONTAGEM (Lotes) ---
      const workbook = new ExcelJS.Workbook();

      const montarAbaAssincrona = async (
        titulo: string,
        listaCore: string[],
        listaJD: string[],
        base: number
      ) => {
        const sheet = workbook.addWorksheet(titulo);
        sheet.getRow(1).values = ["E2E CORE", "E2E JD", "VALIDACAO", "PROCV"];
        const maxRows = Math.max(listaCore.length, listaJD.length);
        const indices = Array.from({ length: maxRows }, (_, i) => i);

        await executarEmLotes(indices, 500, (i) => {
          const rowNum = i + 2;
          sheet.addRow([
            listaCore[i] || "",
            listaJD[i] || "",
            {
              formula: `=IF(OR(LEN(A${rowNum})>10,LEN(B${rowNum})>10),"SIM","-")`,
            },
            {
              formula: `=IF(C${rowNum}="SIM",IF(ISERROR(VLOOKUP(B${rowNum},A:A,1,FALSE)),"NÃO ENCONTRADO","OK"),"-")`,
            },
          ]);
          excelProgress[taskId].porcentagem =
            base + Math.round((i / maxRows) * 15);
        });
      };

      await montarAbaAssincrona("Credito", core_c, jd_c, 70);
      await montarAbaAssincrona("Debito", core_d, jd_d, 85);

      // --- FINALIZAÇÃO: SALVAR EM DISCO ---
      const filePath = path.resolve(process.cwd(), 'uploads', `auditoria_${taskId}.xlsx`);
      await workbook.xlsx.writeFile(filePath);

      // Atualiza status final para o polling do frontend encontrar
      excelProgress[taskId].porcentagem = 100;
      excelProgress[taskId].etapa = "Concluído";
      (excelProgress[taskId] as any).downloadPath = filePath;

      // Limpa os CSVs originais
      if (files.file_jd) fs.unlinkSync(files.file_jd[0].path);
      if (files.file_core) fs.unlinkSync(files.file_core[0].path);
    } catch (error) {
      console.error(`Erro na Task ${taskId}:`, error);
      excelProgress[taskId].etapa = "Erro no processamento";
    }
  })();
};

export const processarConciliacao = async (req: Request, res: Response) => {
  const taskId = req.body.taskId || 'default';
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
  try {
    const dadosJd: Map<string, any> = new Map();
    const dadosCore: Map<string, any> = new Map();
    const jdResumo = { C: { qtd: 0, val: 0 }, D: { qtd: 0, val: 0 } };

    // Leitura JD
    await new Promise((resolve) => {
      let isHeader = true;
      fs.createReadStream(files.file_jd[0].path)
        .pipe(csv({ separator: ';', headers: false }))
        .on('data', (row) => {
          if (isHeader) { isHeader = false; return; }
          const op = limparTexto(row[1]);
          const sit = limparTexto(row[18]);
          if ((op === 'GERAL' || op === 'DEVOLUCAO') && sit === 'EFETIVADO') {
            const e2e = limparTexto(row[2]);
            const tipo = limparTexto(row[5]).includes('CREDITO') ? 'C' : 'D';
            const val = parseFloat(row[6]) || 0;
            dadosJd.set(e2e, { t: tipo, v: val });
            jdResumo[tipo].qtd++; jdResumo[tipo].val += val;
          }
        })
        .on('end', resolve);
    });

    // Leitura CORE (com detecção de separador)
    const sample = fs.readFileSync(files.file_core[0].path, 'utf8').slice(0, 500);
    const sep = sample.includes(';') ? ';' : ',';
    await new Promise((resolve) => {
      let isHeader = true;
      fs.createReadStream(files.file_core[0].path)
        .pipe(csv({ separator: sep, headers: false }))
        .on('data', (row) => {
          if (isHeader) { isHeader = false; return; }
          const e2e = limparTexto(row[1]);
          const tipo = limparTexto(row[0]);
          const val = row[3] ? formatarValor(row[3]) : 0;
          dadosCore.set(e2e, { t: tipo, v: val });
        })
        .on('end', resolve);
    });

    // Cruzamento em Lotes
    const pNoCore: any[] = []; const pNaJd: any[] = [];
    const arrayJd = Array.from(dadosJd.entries());
    const arrayCore = Array.from(dadosCore.entries());

    await executarEmLotes(arrayJd, 1000, ([id, info]) => {
      if (!dadosCore.has(id)) pNoCore.push({ e2e: id, tipo: info.t, valor: info.v, falta: 'CORE' });
    });

    await executarEmLotes(arrayCore, 1000, ([id, info]) => {
      if (!dadosJd.has(id)) pNaJd.push({ e2e: id, tipo: info.t, valor: info.v, falta: 'JD' });
    });

    // Limpeza
    fs.unlinkSync(files.file_jd[0].path);
    fs.unlinkSync(files.file_core[0].path);

    res.json({ success: true, jd_sheet: jdResumo, pendencias: [...pNoCore, ...pNaJd] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};