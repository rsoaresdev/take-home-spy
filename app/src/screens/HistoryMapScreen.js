import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { BACKEND_URL } from "../constants/config";

/**
 * HistoryMapScreen - Mapa com histórico de tracking
 * Mostra todos os pontos de telemetria registados no backend
 */
export default function HistoryMapScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const mapRef = useRef(null);
  const slideAnim = useSharedValue(500); // começa fora do ecrã (baixo)

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  const openModal = () => {
    setModalVisible(true);
    slideAnim.value = 500;
    slideAnim.value = withTiming(0, { duration: 320 });
  };

  const closeModal = () => {
    slideAnim.value = withTiming(500, { duration: 260 }, (finished) => {
      if (finished) {
        scheduleOnRN(setModalVisible, false);
      }
    });
  };

  useEffect(() => {
    fetchHistory();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error("Erro ao obter localização:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔍 A procurar histórico de:", `${BACKEND_URL}/api/v1/history`);
      const response = await fetch(`${BACKEND_URL}/api/v1/history`);

      if (!response.ok) {
        throw new Error(`Backend retornou status ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Histórico recebido:", data.length, "registos");
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const centerOnCurrentLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900 p-5">
        <ActivityIndicator size="large" color="#64748b" />
        <Text className="mt-4 text-base text-slate-400">A carregar histórico...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900 p-5">
        <Text className="text-2xl font-bold text-red-500 mb-2">⚠️ Erro</Text>
        <Text className="text-sm text-slate-400 text-center">{error}</Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900 p-5">
        <Text className="text-2xl font-bold text-slate-500 mb-2">📍 Sem histórico</Text>
        <Text className="text-sm text-slate-400 text-center">
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
    <TouchableOpacity
      className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-600/20"
      onPress={() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: item.latitude,
              longitude: item.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500,
          );
        }
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center">
          <View
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: getMarkerColor(item.aqi_value) }}
          />
          <Text className="text-base font-bold text-slate-50">AQI {item.aqi_value}</Text>
        </View>
        <Text className="text-xs text-slate-500 font-semibold">#{index + 1}</Text>
      </View>
      <Text className="text-sm text-slate-400 mb-1.5">{formatDateLong(item.created_at)}</Text>
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
    </TouchableOpacity>
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
    <View className="flex-1 bg-slate-900">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Polyline conectando todos os pontos */}
        {history.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#64748b"
            strokeWidth={2}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Marcadores para cada ponto de telemetria */}
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

      {/* Controlos flutuantes */}
      <View
        className="absolute right-5 gap-3"
        style={{ bottom: Platform.OS === "ios" ? 100 : 80 }}
      >
        <TouchableOpacity
          className="w-14 h-14 rounded-full bg-slate-950/95 border border-slate-600/30 justify-center items-center"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
          onPress={centerOnCurrentLocation}
        >
          <Text className="text-2xl">📍</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-14 h-14 rounded-full bg-slate-950/95 border border-slate-600/30 justify-center items-center"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
          onPress={openModal}
        >
          <Text className="text-2xl">📋</Text>
        </TouchableOpacity>
      </View>

      {/* Modal com lista */}
      <Modal
        visible={modalVisible}
        animationType="none"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <Animated.View
            className="bg-slate-900 rounded-tl-3xl rounded-tr-3xl border-t border-slate-600/20"
            style={[{ height: "75%" }, animatedModalStyle]}
          >
            <View className="flex-row justify-between items-center p-5 border-b border-slate-600/20">
              <Text className="text-xl font-bold text-slate-50">Histórico Completo</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text className="text-3xl text-slate-400 font-light">✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={history}
              keyExtractor={(item, index) =>
                item.id?.toString() || index.toString()
              }
              renderItem={renderListItem}
              contentContainerStyle={{ padding: 16 }}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}



