import { ReactElement, useEffect } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Navigation from "./src/components/Navigation";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "./src/tasks/backgroundTask";
import "./global.css";

export default function App(): ReactElement {
  useEffect(() => {
    console.log("🎯 A iniciar background tracking...");
    startBackgroundLocationTracking();
    return () => {
      console.log("🛑 A parar background tracking...");
      stopBackgroundLocationTracking();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <View className="flex-1 bg-black">
          <Navigation />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
