import { useState, useRef, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UPLINK_STORAGE_KEY = "@puresky_uplink_active";
const LAST_PING_KEY = "@puresky_last_ping_ts";

interface UseUplinkToggleReturn {
  isUplinkActive: boolean;
  showVisualIndicator: boolean;
  isLoading: boolean;
  handleTap: () => void;
  toggleUplink: () => void;
}

/**
 * Hook para gerir toggle persistente do uplink (5 toques para ligar/desligar)
 */
export const useUplinkToggle = (
  onToggle?: (isActive: boolean, wasManual: boolean) => void,
): UseUplinkToggleReturn => {
  const [tapCount, setTapCount] = useState(0);
  const [isUplinkActive, setIsUplinkActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showVisualIndicator, setShowVisualIndicator] = useState(false);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualIndicatorTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    loadUplinkState();
  }, []);

  const loadUplinkState = async () => {
    try {
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

  const saveUplinkState = async (newState: boolean) => {
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

    if (newState) {
      AsyncStorage.removeItem(LAST_PING_KEY).catch(() => {});
      console.log(
        "🧹 LAST_PING_KEY limpo - próximo update envia imediatamente",
      );
    }

    setShowVisualIndicator(true);
    if (visualIndicatorTimeoutRef.current)
      clearTimeout(visualIndicatorTimeoutRef.current);
    visualIndicatorTimeoutRef.current = setTimeout(
      () => setShowVisualIndicator(false),
      1000,
    );

    onToggle?.(newState, true);
    console.log(newState ? "🟢 Uplink ATIVADO" : "🔴 Uplink DESATIVADO");
  }, [isUplinkActive, onToggle]);

  const handleTap = useCallback(() => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapCount(0), 2000);

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
    toggleUplink,
  };
};
