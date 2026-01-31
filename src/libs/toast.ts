import { showToast } from "nextjs-toast-notify";

// Tipagem para os status permitidos
type ToastStatus = "success" | "error" | "warning" | "info";

const defaultOptions = {
    duration: 4000,
    progress: true,
    position: "top-right" as const,
    transition: "bounceIn" as const,
    icon: '',
    sound: true,
};

// Mapa de mensagens padrão para cada status
const defaultMessages: Record<ToastStatus, string> = {
    success: "Sucesso",
    error: "Ocorreu um erro!",
    warning: "Atenção",
    info: "Informação",
};

export const toast = (status: ToastStatus, message?: string, customOptions = {}) => {
    const toastFn = showToast[status];

    return toastFn(message || defaultMessages[status], {
        ...defaultOptions,
        ...customOptions,
    });
};