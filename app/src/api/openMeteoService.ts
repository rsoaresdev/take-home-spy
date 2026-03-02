const OPEN_METEO_BASE_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

interface OpenMeteoResponse {
  current?: {
    european_aqi?: number;
  };
}

/**
 * Obtém o índice de qualidade do ar (AQI) para coordenadas específicas
 */
export const fetchAirQuality = async (
  latitude: number,
  longitude: number,
): Promise<number> => {
  const response = await fetch(
    `${OPEN_METEO_BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=european_aqi`,
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  return data?.current?.european_aqi ?? 0;
};
