import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { fetchAirQuality } from "../api/openMeteoService";

/**
 * Hook para gerir estado e lógica de qualidade do ar
 * @returns {Object} Estado e dados de qualidade do ar
 */
export const useAirQuality = () => {
  const [aqi, setAqi] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initializeAirQuality = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Solicitar permissões de localização
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        throw new Error("Permissão de localização negada");
      }

      // Obter localização atual
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;
      setLocation({ latitude, longitude });

      // Fetch AQI
      const aqiValue = await fetchAirQuality(latitude, longitude);
      setAqi(aqiValue);

      return { latitude, longitude, aqi: aqiValue };
    } catch (err) {
      console.error("Error initializing air quality:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isMounted) {
        await initializeAirQuality();
      }
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
