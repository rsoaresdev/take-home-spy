import { useEffect } from "react";
import { useUplinkToggle } from "../hooks/useUplinkToggle";
import { useToast } from "../hooks/useToast";
import Toast from "../components/Toast";

/**
 * UplinkStatusToast - Mostra toast quando uplink está ativo
 */
export default function UplinkStatusToast() {
  const { isUplinkActive, isLoading } = useUplinkToggle();
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!isLoading && isUplinkActive) {
      showToast("📡 Uplink Ativo", "success");
    }
  }, [isUplinkActive, isLoading, showToast]);

  return (
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      onHide={hideToast}
    />
  );
}
