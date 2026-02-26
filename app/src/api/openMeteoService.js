// Serviço para integração com Open-Meteo API
const OPEN_METEO_BASE_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

/**
 * Obtém o índice de qualidade do ar (AQI) para coordenadas específicas
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise<number>} - Valor do European AQI
 */
export const fetchAirQuality = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `${OPEN_METEO_BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=european_aqi`,
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.current?.european_aqi || 0;
  } catch (error) {
    console.error("Error fetching air quality:", error);
    throw error;
  }
};
