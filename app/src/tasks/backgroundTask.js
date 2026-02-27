import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKGROUND_TASK_NAME } from "../constants/config";
import { fetchAirQuality } from "../api/openMeteoService";
import { sendAirQualityReport } from "../api/spyService";

const UPLINK_STORAGE_KEY = "@puresky_uplink_active";
const LAST_PING_KEY = "@puresky_last_ping_ts";
const MIN_INTERVAL_MS = 60_000; // throttle JS: mínimo 60s entre pings

/**
 * Background task via startLocationUpdatesAsync.
 * É o único mecanismo que funciona com a app minimizada no iOS.
 * deferredUpdatesInterval limita a frequência no nível nativo.
 */
export const defineBackgroundTask = () => {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
    if (error) {
      // kCLErrorDomain Code=0 (kCLErrorLocationUnknown) é transitório - ignorar silenciosamente
      if (error.code === 0) return;
      console.error("❌ BG task error:", error);
      return;
    }
    if (!data?.locations?.length) return;

    // Throttle JS: ignorar se passou menos de MIN_INTERVAL_MS desde o último ping
    const now = Date.now();
    try {
      const last = await AsyncStorage.getItem(LAST_PING_KEY);
      if (last && now - parseInt(last, 10) < MIN_INTERVAL_MS) return;
    } catch (_) {}

    try {
      const uplinkState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
      if (uplinkState !== "true") return; // uplink off, silencioso

      const { latitude, longitude } = data.locations[0].coords;
      const aqiValue = await fetchAirQuality(latitude, longitude);
      await sendAirQualityReport(latitude, longitude, aqiValue);
      await AsyncStorage.setItem(LAST_PING_KEY, String(now));

      console.log(
        `✅ BG sync: AQI ${aqiValue} @ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      );
    } catch (err) {
      const isNetworkError =
        err.message?.includes("Network request failed") ||
        err.message?.includes("network") ||
        err.message?.includes("fetch");
      if (isNetworkError) {
        // Sem rede — gravar timestamp para não voltar a tentar durante MIN_INTERVAL_MS
        await AsyncStorage.setItem(LAST_PING_KEY, String(now)).catch(() => {});
      } else {
        console.error("❌ BG task erro:", err.message);
      }
    }
  });

  console.log("✅ Background task definida:", BACKGROUND_TASK_NAME);
};

/**
 * Inicia localização em background (app minimizada + fechada no Android).
 * Usa deferredUpdatesInterval para limitar atualizações a 1/min no nível nativo.
 */
export const startBackgroundLocationTracking = async () => {
  if (Platform.OS === "web") return;

  try {
    // Pedir permissão de background (iOS mostra o picker "Always Allow")
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "⚠️ Permissão de background negada. O uplink só funcionará com a app aberta.",
      );
      return; // sem permissão "Always", iOS não entrega updates em background
    }
    console.log("✅ Permissão de background:", status);

    // Sempre re-registar para garantir que os parâmetros estão atualizados
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      console.log("ℹ️ A re-registar background task com novos parâmetros...");
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
      // Balanced = kCLLocationAccuracyHundredMeters - usa GPS,
      // mais fiável que Low para manter updates em background no iOS
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 0, // receber todas as atualizações, throttle no JS
      deferredUpdatesInterval: MIN_INTERVAL_MS,
      deferredUpdatesDistance: 0, // sem filtro de distância nos deferred updates
      showsBackgroundLocationIndicator: false,
      // CRÍTICO: impedir iOS de pausar location updates em background
      pausesLocationUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      foregroundService: {
        notificationTitle: "PureSky",
        notificationBody: "A monitorizar a qualidade do ar",
        notificationColor: "#10b981",
      },
    });

    console.log("🚀 Background location tracking iniciado");
  } catch (error) {
    console.error("❌ Erro ao iniciar background task:", error);
  }
};

/**
 * Parar o tracking
 */
export const stopBackgroundLocationTracking = async () => {
  if (Platform.OS === "web") return;
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
      console.log("🛑 Background task parada");
    }
  } catch (error) {
    console.error("❌ Erro ao parar background task:", error);
  }
};
