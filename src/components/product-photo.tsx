"use client";
import { useContext, type CSSProperties, type ReactNode } from "react";
import { VisualContext } from "@/lib/visual";
import {
  defaultPhotography,
  defaultPhotoFrame,
  photoRoles,
} from "@/lib/photography";
export function ProductPhoto({
  imageKey,
  className,
  children,
}: {
  imageKey: string;
  className: string;
  children: ReactNode;
}) {
  const design = useContext(VisualContext),
    settings = design.photography || defaultPhotography,
    frame = design.photoFrames?.[imageKey] || defaultPhotoFrame;
  return (
    <div
      className={className}
      data-photography
      data-photo-role={frame.role}
      style={
        {
          "--photo-ratio":
            settings.aspect === "portrait"
              ? "4 / 5"
              : settings.aspect === "landscape"
                ? "4 / 3"
                : "1 / 1",
          "--photo-background":
            settings.background === "light"
              ? "#e8e8e3"
              : settings.background === "original"
                ? "#171915"
                : "#141615",
          "--photo-fit": settings.fit,
          "--photo-scale": ((settings.scale / 100) * frame.scale) / 100,
          "--photo-x": frame.x + "%",
          "--photo-y": frame.y + "%",
          "--photo-shift-x": (frame.x - 50) / 2 + "%",
          "--photo-shift-y": (frame.y - 50) / 2 + "%",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function PhotoCaption({ imageKey }: { imageKey: string }) {
  const design = useContext(VisualContext),
    frame = design.photoFrames?.[imageKey];
  return frame ? (
    <span className="photo-caption">{photoRoles[frame.role]}</span>
  ) : null;
}
