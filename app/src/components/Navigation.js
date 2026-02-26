import { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import HistoryMapScreen from "../screens/HistoryMapScreen";

export default function Navigation() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <View className="flex-1 bg-black">
      {/* Conteúdo */}
      <View className="flex-1">
        {activeTab === "home" ? <HomeScreen /> : <HistoryMapScreen />}
      </View>

      {/* Tab Bar */}
      <View
        className="flex-row bg-slate-800 border-t border-slate-600/20"
        style={{
          height: Platform.OS === "ios" ? 80 : 60,
          paddingBottom: Platform.OS === "ios" ? 20 : 0,
        }}
      >
        <TouchableOpacity
          className={`flex-1 justify-center items-center py-2${
            activeTab === "home" ? " border-t-2 border-blue-500" : ""
          }`}
          onPress={() => setActiveTab("home")}
          activeOpacity={0.7}
        >
          <Text
            className={`text-2xl mb-1${
              activeTab === "home" ? " opacity-100" : " opacity-50"
            }`}
          >
            🏠
          </Text>
          <Text
            className={`text-[11px]${
              activeTab === "home"
                ? " text-blue-500 font-bold"
                : " text-slate-400 font-medium"
            }`}
          >
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 justify-center items-center py-2${
            activeTab === "history" ? " border-t-2 border-blue-500" : ""
          }`}
          onPress={() => setActiveTab("history")}
          activeOpacity={0.7}
        >
          <Text
            className={`text-2xl mb-1${
              activeTab === "history" ? " opacity-100" : " opacity-50"
            }`}
          >
            📍
          </Text>
          <Text
            className={`text-[11px]${
              activeTab === "history"
                ? " text-blue-500 font-bold"
                : " text-slate-400 font-medium"
            }`}
          >
            Histórico
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
