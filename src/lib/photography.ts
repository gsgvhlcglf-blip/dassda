export type Photography = {
  aspect: "square" | "portrait" | "landscape";
  background: "dark" | "light" | "original";
  fit: "contain" | "cover";
  scale: number;
};
export type PhotoFrame = {
  scale: number;
  x: number;
  y: number;
  role: "overview" | "texture" | "finish";
};
export const defaultPhotography: Photography = {
  aspect: "square",
  background: "dark",
  fit: "contain",
  scale: 90,
};
export const defaultPhotoFrame: PhotoFrame = {
  scale: 100,
  x: 50,
  y: 50,
  role: "overview",
};
export const photoRoles = {
  overview: "Genel görünüm",
  texture: "Doku detayı",
  finish: "Yüzey detayı",
};
