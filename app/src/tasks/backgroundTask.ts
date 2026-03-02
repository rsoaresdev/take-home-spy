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

// In-memory lock: prevents concurrent task executions from racing past the
// AsyncStorage throttle check before any one of them can write the timestamp.
let isSending = false;

/**
 * Background task via startLocationUpdatesAsync.
 * É o único mecanismo que funciona com a app minimizada no iOS.
 */
export const defineBackgroundTask = (): void => {
  TaskManager.defineTask(
    BACKGROUND_TASK_NAME,
    async ({
      data,
      error,
    }: TaskManager.TaskManagerTaskBody<{
      locations: Location.LocationObject[];
    }>) => {
      if (error) {
        // kCLErrorDomain Code=0 é transitório - ignorar silenciosamente
        if ((error as any).code === 0) return;
        console.error("❌ BG task error:", error);
        return;
      }

      const locations = (data as any)?.locations as
        | Location.LocationObject[]
        | undefined;
      if (!locations?.length) return;

      // Fast in-memory guard: if another execution is already in-flight, skip.
      if (isSending) return;

      const now = Date.now();
      try {
        const last = await AsyncStorage.getItem(LAST_PING_KEY);
        if (last && now - parseInt(last, 10) < THROTTLE_MS) return;
      } catch (_) {}

      isSending = true;
      try {
        const uplinkState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
        if (uplinkState !== "true") return;

        const { latitude, longitude } = locations[0].coords;
        console.log(
          `📍 BG location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        );
        const aqiValue = await fetchAirQuality(latitude, longitude);
        await sendAirQualityReport(latitude, longitude, aqiValue);
        await AsyncStorage.setItem(LAST_PING_KEY, String(now));
        console.log(
          `✅ BG sync: AQI ${aqiValue} @ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("⚠️ BG task erro:", message);
      } finally {
        isSending = false;
      }
    },
  );

  console.log("✅ Background task definida:", BACKGROUND_TASK_NAME);
};

/**
 * Inicia localização em background.
 */
export const startBackgroundLocationTracking = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("⚠️ Permissão de background negada.");
      return;
    }
    console.log("✅ Permissão de background:", status);

    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      console.log("ℹ️ A re-registar background task...");
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
    }

    // Do NOT clear LAST_PING_KEY here — preserving the throttle timestamp
    // prevents iOS from delivering all buffered/queued locations on startup.

    await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20,
      deferredUpdatesInterval: MIN_INTERVAL_MS,
      deferredUpdatesDistance: 20,
      timeInterval: MIN_INTERVAL_MS,
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
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
export const stopBackgroundLocationTracking = async (): Promise<void> => {
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
