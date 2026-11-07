export const publicPhotoTransforms = {
  card: {
    width: 800,
    height: 440,
    crop: "fill",
    gravity: "auto",
    quality: "auto",
  },
  profile: {
    width: 480,
    height: 480,
    crop: "fill",
    gravity: "auto",
    quality: "auto",
  },
} as const;

export function sizedTutorPhotoUrl(
  url: string,
  size: keyof typeof publicPhotoTransforms,
) {
  return url.startsWith("/api/media/")
    ? `${url}${url.includes("?") ? "&" : "?"}size=${size}`
    : url;
}
