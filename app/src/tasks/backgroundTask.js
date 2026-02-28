import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKGROUND_TASK_NAME } from "../constants/config";
import { fetchAirQuality } from "../api/openMeteoService";
import { sendAirQualityReport } from "../api/spyService";

const UPLINK_STORAGE_KEY = "@puresky_uplink_active";
const LAST_PING_KEY = "@puresky_last_ping_ts";
const MIN_INTERVAL_MS = 60_000;
// Allow a 5s grace window so timing jitter doesn't cause a valid 60s delivery to be skipped
const THROTTLE_MS = MIN_INTERVAL_MS - 5_000;

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

    // Throttle: skip if less than THROTTLE_MS since last successful ping
    const now = Date.now();
    try {
      const last = await AsyncStorage.getItem(LAST_PING_KEY);
      if (last && now - parseInt(last, 10) < THROTTLE_MS) {
        console.log(`⏱️ BG throttle: ${Math.round((now - parseInt(last, 10)) / 1000)}s desde último ping, a aguardar...`);
        return;
      }
    } catch (_) {}

    try {
      const uplinkState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
      if (uplinkState !== "true") return; // uplink off, silencioso

      const { latitude, longitude } = data.locations[0].coords;
      console.log(`📍 BG location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
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

    // Limpar timestamp antigo para que o primeiro update após re-arranque vá sempre
    await AsyncStorage.removeItem(LAST_PING_KEY).catch(() => {});

    // Sempre re-registar para garantir que os parâmetros estão atualizados
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      console.log("ℹ️ A re-registar background task com novos parâmetros...");
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 0,
      // iOS: batches deferred updates every MIN_INTERVAL_MS
      deferredUpdatesInterval: MIN_INTERVAL_MS,
      deferredUpdatesDistance: 0,
      // Android: minimum time between location updates (deferredUpdatesInterval is iOS-only)
      timeInterval: MIN_INTERVAL_MS,
      showsBackgroundLocationIndicator: false,
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
