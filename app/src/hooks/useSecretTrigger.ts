import { useState, useRef, useCallback } from "react";

interface UseSecretTriggerReturn {
  isSecretActive: boolean;
  handleTap: () => void;
}

/**
 * Hook para gerir o secret trigger (5 toques)
 */
export const useSecretTrigger = (
  onActivate?: () => void,
): UseSecretTriggerReturn => {
  const [tapCount, setTapCount] = useState(0);
  const [isSecretActive, setIsSecretActive] = useState(false);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapCount(0), 2000);

    if (newTapCount === 5) {
      console.log("Status: Uplink established");
      setIsSecretActive(true);
      setTapCount(0);
      onActivate?.();
      setTimeout(() => setIsSecretActive(false), 1000);
    }
  }, [tapCount, onActivate]);

  return { isSecretActive, handleTap };
};
