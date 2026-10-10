import { finding, result } from "./result.mjs";
export const reducedMotion = (data) => result("reduced-motion", data.animations ? [finding(data, "main.invitation", "Анимация продолжает работать при настройке уменьшения движения.", "error", data.animations, 0)] : []);
