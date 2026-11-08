import { ProfileModal } from "../components/ProfileModal";
import { useApp } from "../store/useApp";

/** Üye profili — ELECTRON'da AYRI pencere olarak açılır (kapat = pencere kapanır).
 * `full`: modal tüm pencereyi kaplar — kenarlarda boşluk/taşma olmaz. */
export function ProfilPage({ nick }: { nick: string }) {
  const go = useApp((s) => s.go);
  const closeWin = () => {
    if (typeof window !== "undefined" && window.vkElectron?.isElectron) {
      void window.vkElectron.close();
    } else {
      go({ name: "lobi", floor: 1 });
    }
  };
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: "Tahoma, Geneva, Verdana, sans-serif" }}>
      <ProfileModal nick={nick} onClose={closeWin} full />
    </div>
  );
}
