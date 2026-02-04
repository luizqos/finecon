/* eslint-disable react-hooks/refs */
"use client";

import React, { useState } from "react";
import { ArrowLeftRight, Rocket, FileSpreadsheet } from "lucide-react";
import { useConciliacao } from "@/hooks/useConciliacao";

import { InputOriginal } from "@/components/InputOriginal";
import { ProcessingLoader } from "@/components/ProcessingLoader";
import { JiraModal } from "@/components/JiraModal";
import { ResultsSection } from "@/components/ResultsSection";

export default function ConciliacaoPage() {
  const { state, refs, actions, calculatedData } = useConciliacao();
  const [isSwapped, setIsSwapped] = useState(false);
  const [fileNames, setFileNames] = useState({ jd: "Nenhum...", core: "Nenhum..." });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'jd' | 'core') => {
    const name = e.target.files?.[0]?.name || "Nenhum arquivo escolhido";
    setFileNames(prev => ({ ...prev, [type]: name }));
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 md:px-8 text-gray-800">
      <ProcessingLoader isLoading={state.isLoading} title={state.loaderTitle} progress={state.progress} />

      <div className="max-w-6xl mx-auto">
        <h1 className="text-center text-4xl font-extrabold text-[#212529] mb-10 tracking-tight">
          📊 Conciliação JD vs Core
        </h1>

        <form 
          ref={refs.formRef} 
          onSubmit={actions.handleProcessar} 
          className="space-y-6"
        >
          <div className="flex justify-center">
            <div className="bg-white p-5 rounded-2xl shadow-sm border w-full max-w-sm text-center">
              <label className="block text-[11px] font-black text-gray-500 uppercase mb-3">Data do Movimento</label>
              <input
                type="date"
                value={state.dataRef}
                onChange={(e) => actions.setDataRef(e.target.value)}
                className="w-full bg-[#f1f3f5] border-none rounded-xl py-3 px-4 font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start">
            <button
              type="button"
              onClick={() => setIsSwapped(!isSwapped)}
              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30 bg-[#212529] text-white p-3 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all hidden lg:flex items-center justify-center border-4 border-[#f8f9fa]"
            >
              <ArrowLeftRight size={20} />
            </button>
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#0d6efd] transition-all duration-700 ${isSwapped ? "lg:translate-x-[calc(100%+2rem)]" : ""}`}>
              <h6 className="font-extrabold text-[#0d6efd] mb-6 text-sm uppercase">Dados JD (CSV)</h6>
              <div className="flex items-center border rounded-lg overflow-hidden mb-6">
                <label className="bg-[#f8f9fa] border-r px-4 py-2 text-sm cursor-pointer">
                  Escolher arquivo
                  <input type="file" name="file_jd" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e, 'jd')} />
                </label>
                <span className="px-4 text-sm text-gray-400 italic">{fileNames.jd}</span>
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
            <div className={`bg-white p-8 rounded-2xl shadow-sm border-l-[6px] border-[#212529] transition-all duration-700 ${isSwapped ? "lg:-translate-x-[calc(100%+2rem)]" : ""}`}>
              <h6 className="font-extrabold text-[#212529] mb-6 text-sm uppercase">Dados Core (CSV)</h6>
              <div className="flex items-center border rounded-lg overflow-hidden mb-6">
                <label className="bg-[#f8f9fa] border-r px-4 py-2 text-sm cursor-pointer">
                  Escolher arquivo
                  <input type="file" name="file_core" accept=".csv" className="hidden" onChange={(e) => handleFileChange(e, 'core')} />
                </label>
                <span className="px-4 text-sm text-gray-400 italic">{fileNames.core}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputOriginal label="Qtd Crédito" name="m_core_qtd_c" />
                <InputOriginal label="Valor Crédito" name="m_core_val_c" placeholder="0,00" />
                <InputOriginal label="Qtd Débito" name="m_core_qtd_d" />
                <InputOriginal label="Valor Débito" name="m_core_val_d" placeholder="0,00" />
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2">
              <Rocket size={20} /> PROCESSAR
            </button>
            <button 
              type="button" 
              onClick={actions.handleDownloadExcel} 
              className="bg-green-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2"
            >
              <FileSpreadsheet size={20} /> GERAR AUDITORIA
            </button>
          </div>
        </form>

        {state.res && calculatedData.metrics && (
          <ResultsSection 
            res={state.res} 
            metrics={calculatedData.metrics} 
            dataRef={state.dataRef} 
            onOpenJira={() => actions.setShowJiraModal(true)} 
          />
        )}
      </div>

      <JiraModal 
        isOpen={state.showJiraModal} 
        onClose={() => actions.setShowJiraModal(false)} 
        jiraData={calculatedData.jiraData} 
        metrics={calculatedData.metrics} 
        onCopy={actions.copiarParaJira} 
      />
    </main>
  );
}