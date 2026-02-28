import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import { Home, Map } from "lucide-react-native";
import HomeScreen from "../screens/HomeScreen";
import HistoryMapScreen from "../screens/HistoryMapScreen";

// Use native UITabBarController on iOS (liquid glass on iOS 26+)
// Fall back to JS implementation on Android/web
const Tab =
  Platform.OS === "ios"
    ? createNativeBottomTabNavigator()
    : createBottomTabNavigator();

export default function Navigation() {
  const isIOS = Platform.OS === "ios";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0A84FF",
        tabBarInactiveTintColor: "#8E8E93",
        ...(isIOS
          ? {}
          : {
              tabBarStyle: {
                backgroundColor: "#1C1C1E",
                borderTopColor: "#2C2C2E",
              },
              tabBarLabelStyle: { fontSize: 12 },
            }),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Início",
          tabBarIcon: isIOS
            ? { type: "sfSymbol", name: "house.fill" }
            : ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryMapScreen}
        options={{
          tabBarLabel: "Histórico",
          tabBarIcon: isIOS
            ? { type: "sfSymbol", name: "map.fill" }
            : ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

