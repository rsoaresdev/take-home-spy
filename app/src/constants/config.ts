import { Platform } from "react-native";

const resolveApiUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
  // O emulador Android não resolve 'localhost' para a máquina host — usar 10.0.2.2
  if (Platform.OS === "android" && url.includes("localhost")) {
    return url.replace("localhost", "10.0.2.2");
  }
  return url;
};

export const API_URL: string = resolveApiUrl();
export const BACKEND_URL: string = API_URL; // Alias para compatibilidade

// Gerar device_id único e persistente
export const DEVICE_ID: string = `device_${Math.random().toString(36).substring(2, 15)}`;

// Nome da tarefa de background
export const BACKGROUND_TASK_NAME = "background-air-sync" as const;
