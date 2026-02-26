import { useState, useRef, useCallback } from "react";

/**
 * Hook para gerir o secret trigger (5 toques)
 * @returns {Object} Estado e handler do secret trigger
 */
export const useSecretTrigger = (onActivate) => {
  const [tapCount, setTapCount] = useState(0);
  const [isSecretActive, setIsSecretActive] = useState(false);
  const tapTimeoutRef = useRef(null);

  const handleTap = useCallback(() => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // Limpar timeout anterior
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Reset após 2 segundos de inatividade
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2000);

    // Ativar secret mode após 5 taps
    if (newTapCount === 5) {
      console.log("Status: Uplink established");
      setIsSecretActive(true);
      setTapCount(0);

      // Notificar ativação
      if (onActivate) {
        onActivate();
      }

      // Desativar após 1 segundo (apenas visual, sem notificação)
      setTimeout(() => {
        setIsSecretActive(false);
      }, 1000);
    }
  }, [tapCount, onActivate]);

  return {
    isSecretActive,
    handleTap,
  };
};
