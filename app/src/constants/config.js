// Configurações da aplicação
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
export const BACKEND_URL = API_URL; // Alias para compatibilidade

// Gerar device_id único e persistente
export const DEVICE_ID = `device_${Math.random().toString(36).substring(2, 15)}`;

// Nome da tarefa de background
export const BACKGROUND_TASK_NAME = "background-air-sync";
