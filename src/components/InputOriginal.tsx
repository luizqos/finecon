interface InputProps {
  label: string;
  name: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InputOriginal({ label, name, placeholder = "0", value, onChange }: InputProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight block">
        {label}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}