import { registerRootComponent } from "expo";
import { defineBackgroundTask } from "./src/tasks/backgroundTask";
import App from "./App";

// CRÍTICO: Registar background task ANTES de qualquer renderização
defineBackgroundTask();
console.log("Background task registada.");

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
