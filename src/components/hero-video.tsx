"use client";
import { useSiteText } from "./visual-text";
import { useContext, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { VisualContext } from "@/lib/visual";
import { browserVideoBlob } from "@/lib/hero-video";
export function HeroVideo() {
  const fixedText = useSiteText();

  const { heroVideo } = useContext(VisualContext);
  const [src, setSrc] = useState(""),
    [failed, setFailed] = useState(false),
    [playing, setPlaying] = useState(false);
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      url = "";
    setSrc("");
    setFailed(false);
    setPlaying(false);
    if (heroVideo) {
      if (heroVideo.src.startsWith("idb:"))
        browserVideoBlob(heroVideo.src)
          .then((blob) => {
            if (active && blob) {
              url = URL.createObjectURL(blob);
              setSrc(url);
            }
          })
          .catch(() => {
            if (active) setFailed(true);
          });
      else setSrc(heroVideo.src);
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [heroVideo?.src]);
  useEffect(() => {
    if (!src || !element.current) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (motion.matches) element.current?.pause();
      else void element.current?.play().catch(() => {});
    };
    apply();
    motion.addEventListener("change", apply);
    return () => motion.removeEventListener("change", apply);
  }, [src]);
  if (!src || failed) return null;
  return (
    <>
      <video
        ref={element}
        className="hero-video"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={fixedText("copy.video.ndembnceocge")}
        onError={() => setFailed(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className="hero-video-toggle"
        data-no-analytics
        aria-label={
          playing ? "Banner videosunu duraklat" : "Banner videosunu oynat"
        }
        onClick={() => {
          const video = element.current;
          if (video?.paused) void video.play().catch(() => {});
          else video?.pause();
        }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
    </>
  );
}
