"use client";

import React, { useRef } from "react";
import { ArrowLeftRight, Rocket, FileSpreadsheet } from "lucide-react";
import { useConciliacao } from "@/hooks/useConciliacao";
import { InputOriginal } from "@/components/InputOriginal";
import { ProcessingLoader } from "@/components/ProcessingLoader";
import { ConciliacaoResultados } from "@/components/ConciliacaoResultados";
import { ModalJira } from "@/components/ModalJira";

export default function ConciliacaoPage() {
  const { states, actions } = useConciliacao();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 md:px-8 text-gray-800">
      <ProcessingLoader
        isLoading={states.isLoading}
        title={states.loaderTitle}
        progress={states.progress}
      />

      <div className="max-w-6xl mx-auto">
        <h1 className="flex items-center justify-center gap-3 text-4xl font-extrabold text-[#212529] mb-10 tracking-tight">
          <span className="text-4xl">📊</span> Conciliação JD vs Core
        </h1>

        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); actions.handleProcessar(e.currentTarget); }} className="space-y-6">
          <div className="flex justify-center">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm text-center">
              <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 tracking-widest">Data do Movimento</label>
              <input
                type="date"
                value={states.dataRef}
                onChange={(e) => actions.setDataRef(e.target.value)}
                className="w-full bg-[#f1f3f5] border-none rounded-xl py-3 px-4 font-bold text-center text-gray-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start pb-4">
            <button
              type="button"
              onClick={() => actions.setIsSwapped(!states.isSwapped)}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30 bg-[#212529] text-white p-3 rounded-full hidden lg:flex items-center justify-center border-4 border-[#f8f9fa]"
            >
              <ArrowLeftRight size={20} />
            </button>

            {/* CARD JD */}
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#0d6efd] transition-all duration-700 ${states.isSwapped ? "lg:translate-x-[calc(100%+2rem)]" : "translate-x-0"}`}>
              <h6 className="font-extrabold text-[#0d6efd] mb-6 text-sm uppercase tracking-wider">Dados JD (CSV)</h6>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6">
                <label className="bg-[#f8f9fa] px-4 py-2 text-sm font-medium cursor-pointer">
                  Escolher arquivo
                  <input type="file" name="file_jd" accept=".csv" className="hidden" onChange={(e) => actions.handleFileChange(e, 'jd')} />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">{states.fileJdName}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputOriginal label="Qtd Crédito" name="m_jd_qtd_c" />
                <InputOriginal label="Qtd Dev Cred" name="m_jd_qtd_dev_c" />
                <InputOriginal label="Valor Crédito" name="m_jd_val_c" placeholder="0,00" />
                <InputOriginal label="Qtd Débito" name="m_jd_qtd_d" />
                <InputOriginal label="Qtd Dev Deb" name="m_jd_qtd_dev_d" />
                <InputOriginal label="Valor Débito" name="m_jd_val_d" placeholder="0,00" />
              </div>
            </div>

            {/* CARD CORE */}
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#212529] transition-all duration-700 ${states.isSwapped ? "lg:-translate-x-[calc(100%+2rem)]" : "translate-x-0"}`}>
              <h6 className="font-extrabold text-[#212529] mb-6 text-sm uppercase tracking-wider">Dados Core (CSV)</h6>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-6">
                <label className="bg-[#f8f9fa] px-4 py-2 text-sm font-medium cursor-pointer">
                  Escolher arquivo
                  <input type="file" name="file_core" accept=".csv" className="hidden" onChange={(e) => actions.handleFileChange(e, 'core')} />
                </label>
                <span className="px-4 py-2 text-sm text-gray-400 italic">{states.fileCoreName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputOriginal label="Qtd Crédito" name="m_core_qtd_c" />
                <InputOriginal label="Valor Crédito" name="m_core_val_c" placeholder="0,00" />
                <InputOriginal label="Qtd Débito" name="m_core_qtd_d" />
                <InputOriginal label="Valor Débito" name="m_core_val_d" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2">
              <Rocket size={20} /> PROCESSAR
            </button>
            <button type="button" onClick={() => actions.handleDownloadExcel(formRef.current)} className="bg-green-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2">
              <FileSpreadsheet size={20} /> GERAR AUDITORIA
            </button>
          </div>
        </form>

        {states.res && states.metrics && (
          <ConciliacaoResultados
            dataRef={states.dataRef}
            metrics={states.metrics}
            res={states.res}
            filteredAudit={states.filteredAudit}
            onOpenJira={() => actions.setShowJiraModal(true)}
            filters={{
              setE2E: actions.setFilterE2E,
              setTipo: actions.setFilterTipo,
              setOri: actions.setFilterOri
            }}
          />
        )}
      </div>
      <ModalJira
        isOpen={states.showJiraModal}
        onClose={() => actions.setShowJiraModal(false)}
        jiraData={states.jiraData}
        metrics={states.metrics}
      />
    </main>
  );
}