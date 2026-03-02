import { useState, useCallback } from "react";
import type { ToastState, ToastType } from "../types";

interface UseToastReturn {
  toast: ToastState;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

/**
 * Hook para gerir toasts
 * Usa key único para forçar remount do componente e evitar conflitos de animação
 */
export const useToast = (): UseToastReturn => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
    key: 0,
  });

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast((prev) => ({
        visible: true,
        message,
        type,
        key: prev.key + 1,
      }));
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
};
