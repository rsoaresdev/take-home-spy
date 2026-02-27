import { Platform } from "react-native";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import HomeScreen from "../screens/HomeScreen";
import HistoryMapScreen from "../screens/HistoryMapScreen";

const Tab = createNativeBottomTabNavigator();

export default function Navigation() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0A84FF",
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Início",
          ...(Platform.OS === "ios" && {
            tabBarIcon: { type: "sfSymbol", name: "house.fill" },
          }),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryMapScreen}
        options={{
          tabBarLabel: "Histórico",
          ...(Platform.OS === "ios" && {
            tabBarIcon: { type: "sfSymbol", name: "map.fill" },
          }),
        }}
      />
    </Tab.Navigator>
  );
}
