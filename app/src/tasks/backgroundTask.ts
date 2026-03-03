import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKGROUND_TASK_NAME } from "../constants/config";
import { sendAirQualityReport } from "../api/spyService";

const UPLINK_STORAGE_KEY = "@puresky_uplink_active";
const LAST_PING_KEY = "@puresky_last_ping_ts";
const MIN_INTERVAL_MS = 60_000;
// Margem de 5s para absorver jitter de timing e não descartar pings válidos de 60s
const THROTTLE_MS = MIN_INTERVAL_MS - 5_000;

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

      const now = Date.now();
      try {
        const last = await AsyncStorage.getItem(LAST_PING_KEY);
        if (last && now - parseInt(last, 10) < THROTTLE_MS) return;
      } catch (_) {}

      try {
        const uplinkState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
        if (uplinkState !== "true") return;

        // Usar a localização mais recente (último elemento — array ordenado do mais antigo para o mais recente)
        const { latitude, longitude } = locations[locations.length - 1].coords;
        console.log(
          `📍 BG location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        );
        // AQI é obtido pelo backend para não bloquear a thread em background no iOS
        await sendAirQualityReport(latitude, longitude);
        await AsyncStorage.setItem(LAST_PING_KEY, String(now));
        console.log(
          `✅ BG sync @ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("⚠️ BG task erro:", message);
      }
    },
  );

  console.log("✅ Background task definida:", BACKGROUND_TASK_NAME);
};

// Handle do intervalo de fallback em foreground (ativo quando a permissão de background não está disponível)
let _foregroundIntervalId: ReturnType<typeof setInterval> | null = null;

function _stopForegroundFallback(): void {
  if (_foregroundIntervalId) {
    clearInterval(_foregroundIntervalId);
    _foregroundIntervalId = null;
    console.log("🛑 Foreground fallback parado");
  }
}

/**
 * Fallback quando a permissão de background é negada.
 * Usa setInterval + getCurrentPositionAsync enquanto a app está em foreground.
 */
async function _startForegroundFallback(): Promise<void> {
  _stopForegroundFallback();
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("⚠️ Permissão de foreground negada — tracking inativo.");
      return;
    }

    const send = async () => {
      try {
        const uplinkState = await AsyncStorage.getItem(UPLINK_STORAGE_KEY);
        if (uplinkState !== "true") return;

        const now = Date.now();
        const last = await AsyncStorage.getItem(LAST_PING_KEY);
        if (last && now - parseInt(last, 10) < THROTTLE_MS) return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        console.log(`📍 FG fallback: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        await sendAirQualityReport(latitude, longitude);
        await AsyncStorage.setItem(LAST_PING_KEY, String(now));
        console.log(`✅ FG fallback sync @ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } catch (err) {
        console.warn("⚠️ FG fallback erro:", err instanceof Error ? err.message : String(err));
      }
    };

    // Enviar imediatamente na primeira ativação e depois repetir no intervalo definido
    await send();
    _foregroundIntervalId = setInterval(send, MIN_INTERVAL_MS);
    console.log("🚀 Foreground fallback iniciado (interval:", MIN_INTERVAL_MS, "ms)");
  } catch (error) {
    console.error("❌ Erro ao iniciar foreground fallback:", error);
  }
}

/**
 * Inicia localização em background.
 * Se a permissão de background for negada (ou Expo Go), ativa o foreground fallback.
 */
export const startBackgroundLocationTracking = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("⚠️ Permissão de background negada — a ativar foreground fallback.");
      await _startForegroundFallback();
      return;
    }
    console.log("✅ Permissão de background:", status);

    _stopForegroundFallback();

    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      console.log("ℹ️ A re-registar background task...");
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
    }

    // NÃO limpar LAST_PING_KEY aqui — preservar o timestamp do throttle
    // evita que o iOS entregue todas as localizações em fila no arranque.

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
    // Último recurso: ativar o foreground fallback
    await _startForegroundFallback();
  }
};

/**
 * Parar o tracking (background + foreground fallback)
 */
export const stopBackgroundLocationTracking = async (): Promise<void> => {
  if (Platform.OS === "web") return;
  _stopForegroundFallback();
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
