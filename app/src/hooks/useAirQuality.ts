import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { fetchAirQuality } from "../api/openMeteoService";
import type { AirQualityState, Coordinates } from "../types";

interface UseAirQualityReturn extends AirQualityState {
  refreshAirQuality: () => Promise<{
    latitude: number;
    longitude: number;
    aqi: number;
  }>;
}

/**
 * Hook para gerir estado e lógica de qualidade do ar
 */
export const useAirQuality = (): UseAirQualityReturn => {
  const [aqi, setAqi] = useState<number | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeAirQuality = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Permissão de localização negada");
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;
      setLocation({ latitude, longitude });

      const aqiValue = await fetchAirQuality(latitude, longitude);
      setAqi(aqiValue);

      return { latitude, longitude, aqi: aqiValue };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Error initializing air quality:", err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) await initializeAirQuality();
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [initializeAirQuality]);

  return {
    aqi,
    location,
    loading,
    error,
    refreshAirQuality: initializeAirQuality,
  };
};
