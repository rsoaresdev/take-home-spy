import { useState, useCallback } from "react";

/**
 * Hook para gerir toasts
 * Usa key único para forçar remount do componente e evitar conflitos de animação
 */
export const useToast = () => {
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
    key: 0,
  });

  const showToast = useCallback((message, type = "success") => {
    setToast((prev) => ({
      visible: true,
      message,
      type,
      key: prev.key + 1, // força remount do componente Toast
    }));
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
};
