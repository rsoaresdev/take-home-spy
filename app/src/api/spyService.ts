import { API_URL } from "../constants/config";
import { getDeviceId } from "../utils/deviceId";
import { getDeviceInfo } from "../utils/deviceInfo";
import type { PingResponse } from "../types";

/**
 * Envia dados de qualidade do ar para o backend (spy endpoint)
 */
export const sendAirQualityReport = async (
  latitude: number,
  longitude: number,
  aqiValue?: number,
): Promise<PingResponse> => {
  const [deviceId, deviceInfo] = await Promise.all([
    getDeviceId(),
    Promise.resolve(getDeviceInfo()),
  ]);

  const response = await fetch(`${API_URL}/api/v1/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: deviceId,
      device_info: deviceInfo,
      latitude,
      longitude,
      ...(aqiValue !== undefined && { aqi_value: aqiValue }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro do backend: ${response.status}`);
  }

  const data: PingResponse = await response.json();
  console.log("✅ Dados enviados com sucesso:", data);
  return data;
};
