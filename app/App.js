import { useEffect } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import Navigation from "./src/components/Navigation";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "./src/tasks/backgroundTask";
import "./global.css";

export default function App() {
  useEffect(() => {
    console.log("🎯 A iniciar background tracking...");
    startBackgroundLocationTracking();
    return () => {
      console.log("🛑 A parar background tracking...");
      stopBackgroundLocationTracking();
    };
  }, []);

  return (
    <NavigationContainer>
      <View className="flex-1 bg-black">
        <Navigation />
      </View>
    </NavigationContainer>
  );
}
