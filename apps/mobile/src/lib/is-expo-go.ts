import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Expo Go (SDK 53+) no longer bundles the native Android notifications module at all - calling
 * anything in `expo-notifications` there throws ("removed from Expo Go... use a development
 * build"). This lets call sites fall back to something Expo-Go-safe (e.g. Alert.alert) instead
 * of crashing, while a real dev/production build still gets full native notifications.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
