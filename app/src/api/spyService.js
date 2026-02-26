import { API_URL, DEVICE_ID } from "../constants/config";
import { getDeviceInfo } from "../utils/deviceInfo";

/**
 * Envia dados de qualidade do ar para o backend (spy endpoint)
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @param {number} aqiValue - Valor do AQI
 * @returns {Promise<void>}
 */
export const sendAirQualityReport = async (latitude, longitude, aqiValue) => {
  try {
    const deviceInfo = getDeviceInfo();

    const response = await fetch(`${API_URL}/api/v1/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: DEVICE_ID,
        device_info: deviceInfo,
        latitude,
        longitude,
        aqi_value: aqiValue,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data sent successfully:", data);

    return data;
  } catch (error) {
    console.error("Error sending air quality report:", error);
    throw error;
  }
};
