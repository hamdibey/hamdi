import { useApp } from "../store/useApp";
import { api } from "./api";

/** Masa oyunu penceresinde miyiz? (Electron program modu) */
function inElectron(): boolean {
  return typeof window !== "undefined" && !!window.vkElectron?.isElectron;
}

/** Masadan çık: masadan kalk — ELECTRON'da masa penceresi DOĞRUDAN kapanır
 * (lobiye geri dönme / "salona dön" yeni penceresi yok). Web'de fallback çalışır. */
export async function masadanCik(fallback?: () => void) {
  const id = useApp.getState().activeTable;
  if (id != null) {
    void api.leaveTable(id).catch(() => {});
    useApp.getState().setActiveTable(null);
  }
  if (inElectron()) {
    // Masa penceresi anında kapansın — kullanıcı lobiye dönmek zorunda değil
    void window.vkElectron?.close();
    return;
  }
  fallback?.();
}
