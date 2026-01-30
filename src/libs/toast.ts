import { showToast } from "nextjs-toast-notify";

// Definimos configurações padrão para evitar repetição
const defaultOptions = {
    duration: 4000,
    progress: true,
    position: "top-right",
    transition: "bounceIn",
    icon: '',
    sound: true,
};
export const toastSuccess = (message: string, customOptions = {}) => {
    return showToast.success(message || "Sucesso", {
        ...defaultOptions,
        ...customOptions,
    });
};

export const toastError = (message: string, customOptions = {}) => {
    return showToast.error(message || "Ocorreu erro!", {
        ...defaultOptions,
        ...customOptions,
    });
};