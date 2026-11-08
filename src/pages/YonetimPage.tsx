import { useCallback, useEffect, useState } from "react";
import { useApp } from "../store/useApp";
import { api, getToken } from "../lib/api";
import type { ApiSalonUser } from "../lib/api";
import { salonTitle } from "../lib/kira";
import { klasikConfirm } from "../lib/klasikDialog";
import { has } from "../lib/ranks";
import { YonetimIcerik } from "./SalonRoomPage";

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

/** Salon yönetim paneli — ELECTRON'da AYRI pencere olarak açılır.
 * Salon verisini kendisi çeker; yönetici sohbeti + genel sohbet kontrolleri. */
export function YonetimPage({ salon, floor, slot }: { salon: string; floor: number; slot: number }) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const [users, setUsers] = useState<ApiSalonUser[]>([]);
  const [salonName, setSalonName] = useState<string | null>(null);
  const [chatLocked, setChatLocked] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [u, c] = await Promise.all([
        api.salonUsers(salon),
        api.salonChat(salon).catch(() => ({ locked: false })),
      ]);
      setUsers(u.users);
      setSalonName(u.salonName || null);
      setChatLocked(!!(c as { locked?: boolean }).locked);
    } catch {
      /* bağlantı hatası göz ardı */
    }
  }, [salon]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  const myRole = users.find((u) => u.nick === me?.nick)?.role ?? "member";
  const myPower: "full" | "mute" | undefined =
    (me != null && has(me.rank, "yetkili")) || myRole === "siteowner" || myRole === "owner" || myRole === "admin" || myRole === "superop"
      ? "full"
      : myRole === "yonetici"
      ? "mute"
      : undefined;
  const staffCount = users.filter((u) => u.role !== "member").length;
  const title = salonTitle(floor, slot, salonName);

  const sohbetTemizle = async () => {
    // Electron'da window.confirm ÇALIŞMAZ — klasik onay penceresi kullanılır
    if (!(await klasikConfirm("Genel sohbetteki tüm mesajlar silinsin mi?"))) return;
    try {
      await api.salonChatAction(salon, "clear");
      showToast("Genel sohbet temizlendi.");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sohbet temizlenemedi.");
    }
  };
  const sohbetKilit = async () => {
    try {
      const r = await api.salonChatAction(salon, chatLocked ? "unlock" : "lock");
      setChatLocked(r.locked);
      showToast(r.locked ? "Genel sohbet kapatıldı — yalnızca salon yöneticileri yazabilir." : "Genel sohbet açıldı — herkes yazabilir.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem yapılamadı.");
    }
  };
  const sohbetKayit = async () => {
    try {
      await api.salonChatLog(salon);
      showToast("Sohbet kaydı hazır.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sohbet kaydı alınamadı.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2" style={{ fontFamily: TAHOMA }}>
      <div className="w-full max-w-[800px] max-h-full bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold select-none">
        <span className="truncate">🛡️ [ Yönetim Paneli — {title} ]</span>
        <span className="flex gap-1">
          <button onClick={() => void load()} className="px-1.5 bg-[#d4d0c8] text-black leading-4 hover:bg-[#e0dcd4]">⟳</button>
          {typeof window !== "undefined" && window.vkElectron?.isElectron ? (
            <button onClick={() => void window.vkElectron.close()} className="px-1.5 bg-[#d4d0c8] text-black leading-4 hover:bg-[#e0dcd4]">×</button>
          ) : null}
        </span>
      </div>
      <div className="px-2 py-1 text-[11px] text-[#404040] bg-[#e8e4dc] border-b border-[#a0a0a0]">
        <b>Salon yöneticileri paneli</b> — bu panel yalnızca salon yöneticilerine açılır; buradaki sohbeti yalnızca yönetici kademesi görür. Aşağıdaki kontroller <b>genel sohbeti</b> yönetir.
        {myPower === undefined && <span className="text-[#cc0000] font-bold"> (Yetkiniz yok — yalnız görüntüleme.)</span>}
      </div>
      <YonetimIcerik
        salon={salon}
        title={title}
        myPower={myPower ?? "mute"}
        staffCount={staffCount}
        users={users}
        chatLocked={chatLocked}
        onTemizle={() => void sohbetTemizle()}
        onKilit={() => void sohbetKilit()}
        onKayit={() => void sohbetKayit()}
      />
      </div>
    </div>
  );
}
