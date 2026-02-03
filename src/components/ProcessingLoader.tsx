interface LoaderProps {
  isLoading: boolean;
  title: string;
  progress: number;
}

export function ProcessingLoader({ isLoading, title, progress }: LoaderProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <h4 className="font-bold text-lg mb-2">{title}</h4>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
          <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{progress}% concluído</p>
      </div>
    </div>
  );
}