import { useEffect, useState } from "react";

/**
 * Mobil cihaz algılama — dokunmatik (coarse pointer) temelli.
 * Masaüstü penceresi dar olsa bile ölçekleme yapmaz; yalnızca telefon/tablet.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}
