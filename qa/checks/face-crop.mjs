import { finding, result } from "./result.mjs";
export const faceCrop = (data) => result("face-crop", data.photos.filter((photo) => !photo.protected).map((photo) => finding(data, photo.selector, "Защищённая область фотографии обрезана или не задана.")), data.photos.length);
