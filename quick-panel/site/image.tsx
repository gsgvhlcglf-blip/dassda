import type { ImgHTMLAttributes } from "react";
import type {} from "./types";
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};
export default function PreviewImage({
  src,
  fill,
  priority: _,
  unoptimized: __,
  style,
  ...props
}: Props) {
  const resolved = window.__KZ_SITE__.assets[src] || src;
  return (
    <img
      {...props}
      src={resolved}
      loading="eager"
      style={{
        ...(fill
          ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
          : {}),
        ...style,
      }}
    />
  );
}
