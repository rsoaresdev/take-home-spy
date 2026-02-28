import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Platform,
  Pressable,
  FlatList,
  PanResponder,
  Dimensions,
  StyleSheet,
  BackHandler,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import MapView, { Marker, Polyline } from "react-native-maps";
import LeafletMap from "../components/LeafletMap";
import * as Location from "expo-location";
import { setStatusBarStyle } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { BACKEND_URL } from "../constants/config";

/**
 * HistoryMapScreen - Mapa com histórico de tracking
 * Mostra todos os pontos de telemetria registados no backend
 */
export default function HistoryMapScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const mapRef = useRef(null);   // iOS only (react-native-maps)
  const leafletRef = useRef(null); // Android only (WebView+Leaflet)

  const animateMap = useCallback((latitude, longitude) => {
    if (Platform.OS === "android") {
      leafletRef.current?.animateTo(latitude, longitude, 15);
    } else if (mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
      // Se já tem dados, faz refresh silencioso (sem spinner a cobrir o mapa)
      if (history.length > 0) {
        fetchHistory(false);
      } else {
        fetchHistory(true);
      }
    }, [history.length]),
  );
  const DRAWER_HEIGHT = Dimensions.get("window").height * 0.7;
  const DISMISS_THRESHOLD = 120;
  const slideAnim = useSharedValue(DRAWER_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, slideAnim.value) }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const openModal = useCallback(() => {
    setModalVisible(true);
    slideAnim.value = DRAWER_HEIGHT;
    slideAnim.value = withSpring(0, { damping: 28, stiffness: 220 });
    backdropOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  const closeModal = useCallback(() => {
    slideAnim.value = withTiming(DRAWER_HEIGHT, { duration: 250 });
    backdropOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(setModalVisible)(false);
    });
  }, []);

  // PanResponder for swipe-down-to-dismiss on the drawer handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.value = gestureState.dy;
          backdropOpacity.value = Math.max(
            0,
            1 - gestureState.dy / DRAWER_HEIGHT,
          );
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
          closeModal();
        } else {
          slideAnim.value = withSpring(0, { damping: 28, stiffness: 220 });
          backdropOpacity.value = withTiming(1, { duration: 150 });
        }
      },
    }),
  ).current;

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Android back button closes drawer
  useEffect(() => {
    if (!modalVisible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeModal();
      return true;
    });
    return () => sub.remove();
  }, [modalVisible, closeModal]);

  const getCoords = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    // lastKnown is instant; fall back to fresh fix if unavailable
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last?.coords) return last.coords;
    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
    })
      .then((l) => l.coords)
      .catch(() => null);
  };

  const getCurrentLocation = async () => {
    try {
      const coords = await getCoords();
      if (coords)
        setCurrentLocation({ latitude: coords.latitude, longitude: coords.longitude });
    } catch (err) {
      console.warn("Sem localização disponível:", err.message);
    }
  };

  const fetchHistory = async (showFullLoader = true) => {
    try {
      if (showFullLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      console.log(
        "🔍 A procurar histórico de:",
        `${BACKEND_URL}/api/v1/history`,
      );
      const response = await fetch(`${BACKEND_URL}/api/v1/history`);

      if (!response.ok) {
        throw new Error(`Backend retornou status ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Histórico recebido:", data.length, "registos");
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      // Só mostra erro fatal no ecrã se for o carregamento inicial
      if (showFullLoader) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const centerOnCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // 1. Pan instantly with last known (iOS-safe, no GPS wait)
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last?.coords) {
        const pos = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        setCurrentLocation(pos);
        animateMap(pos.latitude, pos.longitude);
      }

      // 2. Refine with fresh fix in the background
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
      }).catch(() => null);
      if (fresh?.coords) {
        const pos = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
        setCurrentLocation(pos);
        animateMap(pos.latitude, pos.longitude);
      }
    } catch (err) {
      console.warn("Erro ao centrar:", err.message);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-950 px-8">
        <ActivityIndicator size="large" color="#475569" />
        <Text className="mt-5 text-sm text-slate-500 tracking-wide">
          A carregar histórico...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-950 px-8">
        <Text className="text-4xl mb-3">⚠️</Text>
        <Text className="text-lg font-bold text-red-400 mb-2">Erro</Text>
        <Text className="text-sm text-slate-500 text-center leading-5">
          {error}
        </Text>
        <Pressable
          className="mt-6 bg-slate-800 rounded-xl px-6 py-3 border border-slate-700"
          onPress={() => fetchHistory(true)}
        >
          <Text className="text-sm font-semibold text-slate-300">
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-950 px-8">
        <Text className="text-4xl mb-3">📍</Text>
        <Text className="text-lg font-bold text-slate-500 mb-2">
          Sem histórico
        </Text>
        <Text className="text-sm text-slate-600 text-center">
          Nenhum registo encontrado
        </Text>
      </View>
    );
  }

  const getMarkerColor = (aqi) => {
    if (aqi <= 50) return "#22c55e"; // Bom
    if (aqi <= 100) return "#eab308"; // Moderado
    if (aqi <= 150) return "#f97316"; // Pouco saudável
    if (aqi <= 200) return "#ef4444"; // Má
    return "#7c2d12"; // Perigoso
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateLong = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const renderListItem = ({ item, index }) => (
    <Pressable
      className="bg-slate-800/50 rounded-2xl p-4 mb-2.5 border border-white/[0.06] active:bg-slate-700/50"
      onPress={() => {
        animateMap(item.latitude, item.longitude);
        closeModal();
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-2">
          <View
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: getMarkerColor(item.aqi_value) }}
          />
          <Text className="text-base font-bold text-white">
            AQI {item.aqi_value}
          </Text>
        </View>
        <View className="bg-slate-700/50 rounded-lg px-2 py-0.5">
          <Text className="text-[10px] text-slate-500 font-semibold">
            #{index + 1}
          </Text>
        </View>
      </View>
      <Text className="text-[13px] text-slate-400 mb-1.5">
        {formatDateLong(item.created_at)}
      </Text>
      <Text
        className="text-xs text-slate-500 mb-1"
        style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
      >
        📍 {item.latitude.toFixed(5)}°, {item.longitude.toFixed(5)}°
      </Text>
      <Text
        className="text-[11px] text-slate-600"
        style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
      >
        🔧 {item.device_id}
      </Text>
    </Pressable>
  );

  // Usar currentLocation como default se existir, senão usar história
  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : history.length > 0
      ? {
          latitude:
            history.reduce((sum, item) => sum + item.latitude, 0) /
            history.length,
          longitude:
            history.reduce((sum, item) => sum + item.longitude, 0) /
            history.length,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }
      : {
          latitude: 39.5,
          longitude: -8.0,
          latitudeDelta: 5,
          longitudeDelta: 5,
        };

  // Coordenadas para polyline (rota)
  const polylineCoords = history.map((item) => ({
    latitude: item.latitude,
    longitude: item.longitude,
  }));

  return (
    <View className="flex-1 bg-slate-950">
      {/* Indicador de refresh silencioso (não cobre o mapa) */}
      {refreshing && (
        <View
          style={{
            position: "absolute",
            top: 16,
            alignSelf: "center",
            zIndex: 10,
            backgroundColor: "rgba(2,6,23,0.85)",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <ActivityIndicator size="small" color="#475569" />
          <Text style={{ color: "#94a3b8", fontSize: 12 }}>A atualizar...</Text>
        </View>
      )}
      {Platform.OS === "android" ? (
        <LeafletMap
          ref={leafletRef}
          history={history}
          initialRegion={initialRegion}
          style={{ flex: 1 }}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          mapType="standard"
          showsUserLocation
          showsMyLocationButton={false}
        >
          {history.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#475569"
              strokeWidth={1.5}
              lineDashPattern={[6, 4]}
            />
          )}
          {history.map((item, index) => (
            <Marker
              key={item.id || index}
              coordinate={{
                latitude: item.latitude,
                longitude: item.longitude,
              }}
              pinColor={getMarkerColor(item.aqi_value)}
              title={`AQI: ${item.aqi_value}`}
              description={`📅 ${formatDate(item.created_at)}`}
            />
          ))}
        </MapView>
      )}

      {/* Controlos flutuantes */}
      <View
        className="absolute right-4 gap-2.5"
        style={{ bottom: Platform.OS === "ios" ? 100 : 80 }}
      >
        <Pressable
          className="w-12 h-12 rounded-2xl bg-slate-950/90 border border-white/[0.08] justify-center items-center active:bg-slate-800/90"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 10,
          }}
          onPress={centerOnCurrentLocation}
        >
          <Text className="text-lg">📍</Text>
        </Pressable>

        <Pressable
          className="w-12 h-12 rounded-2xl bg-slate-950/90 border border-white/[0.08] justify-center items-center active:bg-slate-800/90"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 10,
          }}
          onPress={openModal}
        >
          <Text className="text-lg">📋</Text>
        </Pressable>
      </View>

      {/* Backdrop + Drawer - rendered directly (no Modal) to avoid Android addViewAt crash */}
      {modalVisible && (
        <>
          {/* Semi-transparent backdrop */}
          <Animated.View
            style={[
              {
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(0,0,0,0.6)",
                zIndex: 20,
              },
              animatedBackdropStyle,
            ]}
            pointerEvents={modalVisible ? "auto" : "none"}
          >
            <Pressable style={{ flex: 1 }} onPress={closeModal} />
          </Animated.View>

          {/* Drawer */}
          <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: DRAWER_HEIGHT,
                backgroundColor: "#020617",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.08)",
                overflow: "hidden",
                zIndex: 21,
              },
              animatedDrawerStyle,
            ]}
          >
            {/* Drag handle + header — both draggable */}
            <View {...panResponder.panHandlers}>
              <View className="items-center pt-3 pb-2">
                <View className="w-10 h-1 rounded-full bg-slate-700" />
              </View>

              <View className="flex-row justify-between items-center px-5 py-2 border-b border-white/[0.06]">
                <Text className="text-lg font-bold text-white">Histórico</Text>
              </View>
            </View>

            <FlatList
              data={history}
              keyExtractor={(item, index) =>
                item.id?.toString() || index.toString()
              }
              renderItem={renderListItem}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}
