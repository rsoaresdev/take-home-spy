import { API_URL, DEVICE_ID } from "../constants/config";
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
  const deviceInfo = getDeviceInfo();

  const response = await fetch(`${API_URL}/api/v1/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: DEVICE_ID,
      device_info: deviceInfo,
      latitude,
      longitude,
      ...(aqiValue !== undefined && { aqi_value: aqiValue }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const data: PingResponse = await response.json();
  console.log("Data sent successfully:", data);
  return data;
};
