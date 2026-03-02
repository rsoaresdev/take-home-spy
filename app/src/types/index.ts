export interface AirQualityReport {
  id: number;
  device_id: string;
  device_info?: DeviceInfo;
  latitude: number;
  longitude: number;
  aqi_value: number;
  created_at: string;
}

export interface DeviceInfo {
  model: string;
  brand: string;
  os: "ios" | "android" | "web" | string;
  osVersion: string;
  appVersion: string;
  platform: string;
}

export interface AirQualityState {
  aqi: number | null;
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type AqiLevel = "good" | "moderate" | "bad";

export type ToastType =
  | "success"
  | "error"
  | "info"
  | "center"
  | "centerOff"
  | "default";

export interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  key: number;
}

export interface UplinkToggleState {
  isUplinkActive: boolean;
  showVisualIndicator: boolean;
  isLoading: boolean;
}

export interface PingPayload {
  device_id: string;
  device_info: DeviceInfo;
  latitude: number;
  longitude: number;
  aqi_value: number;
}

export interface PingResponse {
  status: "success" | "error";
  message: string;
  report_id: number;
}
