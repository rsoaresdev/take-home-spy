import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Obtém informações do dispositivo
 * @returns {Object} Informações do dispositivo
 */
export const getDeviceInfo = () => {
  return {
    model: Device.modelName || "Unknown",
    brand: Device.brand || "Unknown",
    os: Platform.OS,
    osVersion: Device.osVersion || "Unknown",
    appVersion: Constants.expoConfig?.version || "1.0.0",
    platform: Platform.select({
      ios: "iOS",
      android: "Android",
      web: "Web",
      default: "Unknown",
    }),
  };
};
