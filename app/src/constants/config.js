// Configurações da aplicação
import { Platform } from "react-native";

const resolveApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
  // Android emulator doesn't resolve 'localhost' to the host machine - use 10.0.2.2 instead
  if (Platform.OS === "android" && url.includes("localhost")) {
    return url.replace("localhost", "10.0.2.2");
  }
  return url;
};

export const API_URL = resolveApiUrl();
export const BACKEND_URL = API_URL; // Alias para compatibilidade

// Gerar device_id único e persistente
export const DEVICE_ID = `device_${Math.random().toString(36).substring(2, 15)}`;

// Nome da tarefa de background
export const BACKGROUND_TASK_NAME = "background-air-sync";
