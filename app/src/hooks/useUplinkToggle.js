import { useState, useRef, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UPLINK_STORAGE_KEY = "@puresky_uplink_active";
const LAST_PING_KEY = "@puresky_last_ping_ts";

/**
 * Hook para gerir toggle persistente do uplink (5 toques para ligar/desligar)
 * @param {Function} onToggle - Callback chamado quando estado muda com (isActive, wasManualToggle)
 * @returns {Object} Estado e handler do uplink
 */
export const useUplinkToggle = (onToggle) => {
  const [tapCount, setTapCount] = useState(0);
  const [isUplinkActive, setIsUplinkActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const tapTimeoutRef = useRef(null);
  const visualIndicatorTimeoutRef = useRef(null);
  const [showVisualIndicator, setShowVisualIndicator] = useState(false);

  // Carregar estado persistente ao inicializar
  useEffect(() => {
    loadUplinkState();
  }, []);

  const loadUplinkState = async () => {
    try {
      // TODO: Utilizar MMKV que é mais rápido
      const savedState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
      if (savedState !== null) {
        const isActive = savedState === "true";
        setIsUplinkActive(isActive);
        console.log(
          "📦 Estado do uplink carregado:",
          isActive ? "ATIVO" : "INATIVO",
        );
      }
    } catch (error) {
      console.error("❌ Erro ao carregar estado do uplink:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUplinkState = async (newState) => {
    try {
      await AsyncStorage.setItem(UPLINK_STORAGE_KEY, String(newState));
      console.log(
        "💾 Estado do uplink guardado:",
        newState ? "ATIVO" : "INATIVO",
      );
    } catch (error) {
      console.error("❌ Erro ao guardar estado do uplink:", error);
    }
  };

  const toggleUplink = useCallback(() => {
    const newState = !isUplinkActive;
    setIsUplinkActive(newState);
    saveUplinkState(newState);

    // Quando uplink é ligado, limpar timestamp para que o 1º ping vá imediatamente
    if (newState) {
      AsyncStorage.removeItem(LAST_PING_KEY).catch(() => {});
      console.log("🧹 LAST_PING_KEY limpo - próximo update envia imediatamente");
    }

    // Mostrar indicador visual (texto vermelho)
    setShowVisualIndicator(true);
    if (visualIndicatorTimeoutRef.current) {
      clearTimeout(visualIndicatorTimeoutRef.current);
    }
    visualIndicatorTimeoutRef.current = setTimeout(() => {
      setShowVisualIndicator(false);
    }, 1000);

    // Notificar mudança
    if (onToggle) {
      onToggle(newState, true); // true = foi toggle manual
    }

    console.log(newState ? "🟢 Uplink ATIVADO" : "🔴 Uplink DESATIVADO");
  }, [isUplinkActive, onToggle]);

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

    // Toggle após 5 taps
    if (newTapCount === 5) {
      setTapCount(0);
      toggleUplink();
    }
  }, [tapCount, toggleUplink]);

  return {
    isUplinkActive,
    showVisualIndicator,
    isLoading,
    handleTap,
    toggleUplink, // Expor para toggle programático
  };
};
