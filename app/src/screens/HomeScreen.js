import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAirQuality } from "../hooks/useAirQuality";
import { useUplinkToggle } from "../hooks/useUplinkToggle";
import { useToast } from "../hooks/useToast";
import Toast from "../components/Toast";
import {
  getGradientColors,
  formatAqiValue,
  getAqiDescription,
} from "../utils/aqiUtils";
import { fetchAirQuality } from "../api/openMeteoService";
import { sendAirQualityReport } from "../api/spyService";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const { aqi, location, refreshAirQuality } = useAirQuality();
  const [refreshing, setRefreshing] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const gradientColors = getGradientColors(aqi);
  const aqiDisplay = formatAqiValue(aqi);
  const aqiDescription = getAqiDescription(aqi);

  // Handler para toggle do uplink
  const handleUplinkToggle = useCallback(
    (isActive, wasManual) => {
      if (wasManual) {
        if (isActive) {
          showToast("📡 Uplink Ativado", "success");
        } else {
          showToast("🔐 Uplink Desativado", "info");
        }
      }
    },
    [showToast],
  );

  const { showVisualIndicator, handleTap } =
    useUplinkToggle(handleUplinkToggle);

  // Handler para pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      showToast("🔄 A forçar atualização...", "info");

      // Forçar nova leitura de GPS
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = currentLocation.coords;

      // Obter novo AQI
      const newAqi = await fetchAirQuality(latitude, longitude);

      // Enviar ping manual imediato
      await sendAirQualityReport(latitude, longitude, newAqi);

      showToast("✅ Dados atualizados!", "success");

      // Refresh do hook
      if (refreshAirQuality) {
        await refreshAirQuality();
      }

      console.log("✅ Pull-to-refresh completo:", {
        latitude,
        longitude,
        aqi: newAqi,
      });
    } catch (error) {
      console.error("❌ Erro no pull-to-refresh:", error);
      showToast("❌ Erro ao atualizar", "error");
    } finally {
      setRefreshing(false);
    }
  }, [refreshAirQuality, showToast]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />

      {/* Gradiente de fundo baseado no AQI */}
      <LinearGradient
        colors={gradientColors}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ScrollView com RefreshControl */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.6)"
            colors={["rgba(255,255,255,0.6)"]}
          />
        }
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Top bar */}
          <Animated.View
            entering={FadeInUp.duration(500)}
            style={{
              paddingHorizontal: 24,
              paddingTop: 8,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 10,
                letterSpacing: 6,
                textTransform: "uppercase",
                fontWeight: "600",
              }}
            >
              PureSky
            </Text>
          </Animated.View>

          {/* Área principal */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 32,
            }}
          >
            {/* Anel decorativo + AQI */}
            <AnimatedPressable
              entering={ZoomIn.duration(700).springify()}
              onPress={handleTap}
              style={{ alignItems: "center", justifyContent: "center" }}
            >
              {/* Anel exterior */}
              <View
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Anel interior */}
                <View
                  style={{
                    width: 208,
                    height: 208,
                    borderRadius: 104,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.12)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 96,
                      fontWeight: "900",
                      color: showVisualIndicator ? "#ef4444" : "white",
                      lineHeight: 100,
                      textAlign: "center",
                      letterSpacing: -4,
                    }}
                  >
                    {aqiDisplay || "--"}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      fontSize: 10,
                      letterSpacing: 5,
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    índice
                  </Text>
                </View>
              </View>
            </AnimatedPressable>

            {/* Badge de qualidade */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(500)}
              style={{
                marginTop: 28,
                paddingVertical: 8,
                paddingHorizontal: 24,
                borderRadius: 100,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 15,
                  fontWeight: "600",
                  letterSpacing: 0.5,
                }}
              >
                {aqiDescription}
              </Text>
            </Animated.View>

            {/* Barra de escala AQI */}
            <Animated.View
              entering={FadeInUp.delay(350).duration(500)}
              style={{ width: "100%", marginTop: 32 }}
            >
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.min(100, ((aqi || 0) / 200) * 100)}%`,
                    backgroundColor: "rgba(255,255,255,0.45)",
                    borderRadius: 2,
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 6,
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 9,
                    letterSpacing: 2,
                  }}
                >
                  BOM
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 9,
                    letterSpacing: 2,
                  }}
                >
                  MODERADO
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 9,
                    letterSpacing: 2,
                  }}
                >
                  MAU
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* Rodapé com localização */}
          <Animated.View
            entering={FadeInUp.delay(450).duration(500)}
            style={{
              paddingHorizontal: 24,
              paddingBottom: 16,
              alignItems: "center",
              gap: 10,
            }}
          >
            {location ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {location.latitude.toFixed(4)}° N ·{" "}
                {location.longitude.toFixed(4)}° W
              </Text>
            ) : (
              <Text
                style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: 11,
                  fontStyle: "italic",
                }}
              >
                A procurar sinal GPS...
              </Text>
            )}
            <Text
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 9,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              ⬇ ARRASTE PARA ATUALIZAR
            </Text>
          </Animated.View>
        </SafeAreaView>
      </ScrollView>

      {/* Toast Customizado - key força remount a cada novo toast */}
      <Toast
        key={toast.key}
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  );
}
