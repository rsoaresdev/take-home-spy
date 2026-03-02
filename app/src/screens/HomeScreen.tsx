import { useState, useCallback, ReactElement } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import Animated, { FadeInUp, ZoomIn, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
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

export default function HomeScreen(): ReactElement {
  const { aqi, location, refreshAirQuality } = useAirQuality();
  const [refreshing, setRefreshing] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const gradientColors = getGradientColors(aqi);
  const aqiDisplay = formatAqiValue(aqi);
  const aqiDescription = getAqiDescription(aqi);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
    }, []),
  );

  const handleUplinkToggle = useCallback(
    (isActive: boolean, wasManual: boolean) => {
      if (wasManual) {
        showToast(
          isActive ? "📡 Uplink Ativado" : "🔐 Uplink Desativado",
          isActive ? "success" : "info",
        );
      }
    },
    [showToast],
  );

  const { showVisualIndicator, handleTap } =
    useUplinkToggle(handleUplinkToggle);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      showToast("🔄 A forçar atualização...", "info");

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = currentLocation.coords;
      const newAqi = await fetchAirQuality(latitude, longitude);
      await sendAirQualityReport(latitude, longitude, newAqi);
      showToast("✅ Dados atualizados!", "success");

      await refreshAirQuality?.();
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
    <View className="flex-1">
      <LinearGradient
        colors={gradientColors}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

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
        <SafeAreaView className="flex-1">
          <Animated.View
            entering={FadeInUp.duration(500)}
            className="px-6 pt-2 flex-row justify-between items-center"
          >
            <Text className="text-white/50 text-[10px] tracking-[6px] uppercase font-semibold">
              PureSky
            </Text>
          </Animated.View>

          <View className="flex-1 items-center justify-center px-8">
            <AnimatedPressable
              entering={ZoomIn.duration(700).springify()}
              onPress={handleTap}
              className="items-center justify-center"
            >
              <View className="w-60 h-60 rounded-full border border-white/[0.08] items-center justify-center">
                <View className="w-52 h-52 rounded-full border border-white/[0.12] items-center justify-center bg-black/[0.12]">
                  <Text
                    className={`text-[96px] font-black leading-[100px] text-center ${
                      showVisualIndicator ? "text-red-500" : "text-white"
                    }`}
                    style={{ letterSpacing: -4 }}
                  >
                    {aqiDisplay || "--"}
                  </Text>
                  <Text className="text-white/50 text-[10px] tracking-[5px] uppercase mt-0.5">
                    índice
                  </Text>
                </View>
              </View>
            </AnimatedPressable>

            <Animated.View
              entering={FadeInUp.delay(200).duration(500)}
              className="mt-7 py-2.5 px-7 rounded-full bg-white/10 border border-white/[0.18]"
            >
              <Text className="text-white text-[15px] font-semibold tracking-wide">
                {aqiDescription}
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(350).duration(500)}
              className="w-full mt-8"
            >
              <View className="h-1 rounded-full bg-white/10 overflow-hidden">
                <View
                  className="h-full bg-white/40 rounded-full"
                  style={{
                    width: `${Math.min(100, ((aqi ?? 0) / 200) * 100)}%`,
                  }}
                />
              </View>
              <View className="flex-row justify-between mt-1.5">
                <Text className="text-white/40 text-[9px] tracking-[2px]">
                  BOM
                </Text>
                <Text className="text-white/40 text-[9px] tracking-[2px]">
                  MODERADO
                </Text>
                <Text className="text-white/40 text-[9px] tracking-[2px]">
                  MAU
                </Text>
              </View>
            </Animated.View>
          </View>

          <Animated.View
            entering={FadeInUp.delay(450).duration(500)}
            className="px-6 pb-20 items-center gap-2.5"
          >
            {location ? (
              <Text
                className="text-white/50 text-[10px] tracking-[3px] uppercase"
                style={{ fontFamily: "monospace" }}
              >
                {location.latitude.toFixed(4)}° N ·{" "}
                {location.longitude.toFixed(4)}° W
              </Text>
            ) : (
              <Animated.Text
                entering={FadeIn.duration(600)}
                className="text-white/20 text-[11px] italic"
              >
                A procurar sinal GPS...
              </Animated.Text>
            )}
            <Text className="text-white/30 text-[9px] tracking-[4px] uppercase">
              ⬇ ARRASTE PARA ATUALIZAR
            </Text>
          </Animated.View>
        </SafeAreaView>
      </ScrollView>

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
