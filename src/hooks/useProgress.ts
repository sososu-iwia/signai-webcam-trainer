import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe } from "../services/progress";
export const useProgress = () => useSyncExternalStore(subscribe, getSnapshot);
