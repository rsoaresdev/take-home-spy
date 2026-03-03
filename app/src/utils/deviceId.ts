import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "@puresky_device_id";

/**
 * Cache em memória para evitar leituras repetidas ao AsyncStorage
 * na mesma sessão.
 */
let _cachedDeviceId: string | null = null;

/**
 * Gera um ID aleatório no formato 'device_xxxxxxxxxxxxxxx'
 */
function _generateDeviceId(): string {
  const a = Math.random().toString(36).substring(2, 10);
  const b = Math.random().toString(36).substring(2, 10);
  return `device_${a}${b}`;
}

/**
 * Devolve o device_id persistente.
 *
 * - Na primeira execução: gera um novo ID e guarda no AsyncStorage.
 * - Nas execuções seguintes: carrega o mesmo ID do AsyncStorage.
 * - Enquanto a app estiver em memória: usa o valor em cache (sem IO).
 */
export const getDeviceId = async (): Promise<string> => {
  // Devolve do cache em memória se disponível
  if (_cachedDeviceId) return _cachedDeviceId;

  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      _cachedDeviceId = stored;
      return stored;
    }

    // Gerar e guardar novo ID
    const newId = _generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    _cachedDeviceId = newId;
    console.log("📱 Novo device_id gerado e guardado:", newId);
    return newId;
  } catch (err) {
    // Fallback síncrono se o AsyncStorage falhar (ex: testes, web)
    if (!_cachedDeviceId) {
      _cachedDeviceId = _generateDeviceId();
    }
    console.warn("⚠️ Falha ao aceder ao AsyncStorage para device_id:", err);
    return _cachedDeviceId;
  }
};
