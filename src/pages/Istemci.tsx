import { useState } from "react";
import { useApp, type Route } from "../store/useApp";
import { LobbyPage } from "./LobbyPage";
import { SalonPage } from "./SalonPage";
import { SalonRoomPage } from "./SalonRoomPage";
import { OkeyGamePage } from "./OkeyGamePage";
import { OnlineOkeyPage } from "./OnlineOkeyPage";
import { BatakGamePage } from "./BatakGamePage";
import { DominoGamePage } from "./DominoGamePage";
import { AdminPanelPage } from "./AdminPanelPage";
import { ChatSalonPage } from "./ChatSalonPage";
import { KiraPage } from "./KiraPage";
import { GoldPage } from "./GoldPage";
import { IndirPage } from "./IndirPage";
import { GameShell } from "../components/GameShell";
import { RankBadge } from "../components/RankBadge";
import { MessageInbox } from "../components/MessageInbox";
import { can } from "../lib/ranks";

// ---------------------------------------------------------------------------
// Tek pencereli hakkarim tarzı istemci.
// Giriş (Bağlantı) → kat seçimi → salon → oyun HEPSI aynı pencerede akar.
// Ayrı web sayfası yok; her şey bu istemci penceresinin içeriğidir.
// ---------------------------------------------------------------------------

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

/** Klasik pencere çerçevesi (hakkarim istemcisi gibi) */
function Pencere({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose?: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[#d4d0c8] w-full h-full flex flex-col"
      style={{ fontFamily: TAHOMA, boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
    >
      <div
        className="flex items-center justify-between h-[24px] px-1.5 shrink-0 select-none"
        style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
      >
        <span className="text-white text-[12px] font-bold truncate">
          {title} {sub && <span className="font-normal opacity-90">— {sub}</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 bg-[#d4d0c8] text-black text-[10px] leading-4 border-t border-l border-white border-b border-r border-[#404040]">—</span>
          <span className="px-1.5 bg-[#d4d0c8] text-black text-[10px] leading-4 border-t border-l border-white border-b border-r border-[#404040]">□</span>
          <button
            onClick={onClose}
            className="px-1.5 text-white text-[10px] leading-4 font-bold border-t border-l border-white border-b border-r border-[#404040]"
            style={{ background: "linear-gradient(180deg,#f08a72 0%,#d13c1d 45%,#b02a10 100%)" }}
            title="Kapat"
          >✕</button>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}

function KInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-white text-black text-[13px] px-2 h-[24px] outline-none ${props.className ?? ""}`}
      style={{ boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf" }}
    />
  );
}

function KBtn({ children, onClick, disabled, primary }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 h-[24px] text-[12px] font-bold text-black active:translate-y-px disabled:opacity-50 ${primary ? "bg-[#e8e4dc]" : "bg-[#d4d0c8]"}`}
      style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Klasik Bağlantı ekranı — hakkarim istemcisinin giriş penceresinin    */
/* birebir replikası: telif beyanı · afiş · kat sekmeleri · Canlı       */
/* Destek · Misafir Giriş · nick/şifre + Beni Hatırla + Robot +         */
/* Kurallar · Bağlan/Üye Ol · GOLD bandı · alt bağlantılar              */
/* ------------------------------------------------------------------ */

function KCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] text-black">
      <span
        className="w-[13px] h-[13px] bg-white flex items-center justify-center text-[10px] font-bold"
        style={{ boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff" }}
        onClick={() => onChange(!checked)}
      >
        {checked ? "✓" : ""}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

function KLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] text-[#0645ad] hover:text-[#d13c1d] underline decoration-dotted">
      {children}
    </button>
  );
}

function KDlg({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center pt-10 bg-black/25" onClick={onClose}>
      <div className="bg-[#d4d0c8] text-black w-[340px] max-w-[92%]"
        style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 3px 4px 14px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between h-[22px] px-1.5"
          style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
        >
          <span className="text-white text-[11px] font-bold truncate">{title}</span>
          <button
            onClick={onClose}
            className="px-1.5 text-white text-[10px] leading-4 font-bold border-t border-l border-white border-b border-r border-[#404040]"
            style={{ background: "linear-gradient(180deg,#f08a72 0%,#d13c1d 45%,#b02a10 100%)" }}
          >
            ✕
          </button>
        </div>
        <div className="p-2">{children}</div>
      </div>
    </div>
  );
}

function MiniTile({ n }: { n: number }) {
  return (
    <div
      className="w-[15px] h-[21px] bg-gradient-to-b from-white to-[#efe6cf] rounded-[3px] flex flex-col items-center justify-center border border-[#b9ad8d]"
      style={{ boxShadow: "1px 1px 2px rgba(0,0,0,.4)" }}
    >
      <span className="text-[9px] font-black leading-none text-[#111]">{n}</span>
      <span className="w-[3px] h-[3px] rounded-full bg-[#c22] mt-[1px]" />
    </div>
  );
}

function BaglantiEkrani() {
  const login = useApp((s) => s.login);
  const go = useApp((s) => s.go);

  const [nick, setNick] = useState(() => localStorage.getItem("vk_bag_nick") ?? "");
  const [pass, setPass] = useState("");
  const [beniHatirla, setBeniHatirla] = useState(() => Boolean(localStorage.getItem("vk_bag_nick")));
  const [robot, setRobot] = useState(false);
  const [kurallar, setKurallar] = useState(false);
  const [radyoKapali, setRadyoKapali] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<null | "uyeol" | "kurallar" | "sifre" | "arkadas">(null);

  // Üye ol formu
  const [uNick, setUNick] = useState("");
  const [uPass, setUPass] = useState("");
  const [cinsiyet, setCinsiyet] = useState<"e" | "k">("e");
  const [uEmail, setUEmail] = useState("");
  const [uCountry, setUCountry] = useState("Türkiye");
  const [uCity, setUCity] = useState("");
  // Şifre / kayıp nick
  const [sNick, setSNick] = useState("");
  const [sSonuc, setSSonuc] = useState("");
  // Arkadaşım nerede
  const [aNick, setANick] = useState("");
  const [aSonuc, setASonuc] = useState("");

  const baglan = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    if (nick.trim().length < 3) return setErr("Nick yazınız (en az 3 karakter).");
    if (pass.length < 4) return setErr("Şifreniz en az 4 karakter olmalı.");
    if (!robot) return setErr("Lütfen Robot olmadığınızı onaylayın.");
    if (!kurallar) return setErr("Kuralları Kabul Ediyorum kutusunu işaretleyin.");
    setBusy(true);
    if (beniHatirla) localStorage.setItem("vk_bag_nick", nick.trim());
    else localStorage.removeItem("vk_bag_nick");
    const e = await login(nick.trim(), pass, "login");
    setBusy(false);
    if (e) {
      setErr(`${e} — Üye değilseniz "Üye Ol" düğmesiyle ücretsiz üyelik açabilirsiniz.`);
      setPass("");
    }
  };

  const misafirGiris = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    setBusy(true);
    for (let i = 0; i < 3; i++) {
      const n = `Misafir${Math.floor(1000 + Math.random() * 9000)}`;
      const p = `mis${Math.floor(1000 + Math.random() * 9000)}`;
      const e = await login(n, p, "register", "e", `${n.toLowerCase()}@misafir.hasokey.com.tr`, "Türkiye", "Misafir");
      if (!e) {
        setInfo(`Misafir giriş yapıldı: ${n}`);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setErr("Misafir giriş şu anda yapılamıyor, Üye Ol ile kayıt deneyin.");
  };

  const uyeOl = async () => {
    if (busy) return;
    setErr("");
    if (uNick.trim().length < 3) return setErr("Nick en az 3 karakter olmalı.");
    if (uPass.length < 4) return setErr("Şifre en az 4 karakter olmalı.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(uEmail.trim())) return setErr("Geçerli bir e-posta adresi girin (zorunlu).");
    if (uCountry.trim().length < 2) return setErr("Ülke zorunludur.");
    if (uCity.trim().length < 2) return setErr("Şehir zorunludur.");
    setBusy(true);
    const e = await login(uNick.trim(), uPass, "register", cinsiyet, uEmail.trim(), uCountry.trim(), uCity.trim());
    setBusy(false);
    if (e) setErr(e);
    else setDlg(null);
  };

  return (
    <div className="relative w-full min-h-full overflow-auto text-black" style={{ fontFamily: TAHOMA, background: "#d4d0c8" }}>
      <div className="mx-auto w-[620px] max-w-full">
        {/* Telif beyanı + site linki */}
        <div className="bg-white text-center py-[2px] px-1 relative">
          <span className="text-[9px] font-bold text-[#c00]">
            T.C. Kültür ve Turizm Bakanlığı Telif Hakları Genel Müdürlüğü Kayıt Tescil Numarası: IEE-29-39052007
          </span>
          <button
            onClick={() => go({ name: "site" })}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#0645ad] hover:underline decoration-dotted"
          >
            🌐 Web Sitesi
          </button>
        </div>

        {/* Oyun afişi */}
        <div className="flex h-[78px] border-y border-[#9a9a9a]">
          <div className="w-[130px] bg-gradient-to-b from-[#e01b1b] to-[#9c0f0f] text-white flex flex-col items-center justify-center leading-tight">
            <span className="text-[15px] font-black tracking-wide drop-shadow">OKEY</span>
            <span className="text-[13px] font-black">34, 51, 101</span>
            <span className="text-[11px] font-bold">BANKO, KASTET</span>
          </div>
          <div
            className="flex-1 relative flex flex-col items-center justify-center"
            style={{ background: "linear-gradient(180deg,#8fc4ee 0%,#4a90d9 45%,#2f6fc4 100%)" }}
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1 rotate-[-8deg]">
              <MiniTile n={1} />
              <MiniTile n={1} />
            </div>
            <span className="text-[20px] font-black text-white leading-none" style={{ textShadow: "0 2px 0 #17406e, 0 0 6px rgba(0,0,0,.35)" }}>
              hasokey.com.tr
            </span>
            <span className="text-[13px] font-bold text-white mt-[2px]" style={{ textShadow: "0 1px 0 #17406e" }}>
              Oyun Salonu
            </span>
            <span className="text-[8px] text-[#ffe95c] mt-[3px]">www.hasokey.com.tr&nbsp;&nbsp;&nbsp;101 · Okey · Domino</span>
          </div>
          <div className="w-[130px] bg-gradient-to-b from-[#e01b1b] to-[#9c0f0f] text-white flex flex-col items-center justify-center leading-tight">
            <span className="text-[12px] font-black">KELİMATİK,</span>
            <span className="text-[12px] font-black">HAFTEFT,</span>
            <span className="text-[12px] font-black">HARBANK,</span>
            <span className="text-[12px] font-black">DOMİNO</span>
          </div>
        </div>

        {/* Kat sekmeleri */}
        <div className="flex items-stretch gap-[2px] px-1 py-[3px] bg-[#ece9d8] border-b border-[#aca899] overflow-x-auto">
          <span className="self-center text-[11px] px-1">
            <img src="/masaustu/bocek.jpg" alt="böcek" className="inline w-[15px] h-[15px] rounded-full align-[-3px]" />
          </span>
          {[1, 2, 3].map((k) => (
            <KBtn key={k} onClick={() => setInfo(`${k}. Kat — bağlantı sonrası salona girebilirsiniz.`)}>{k}. Kat</KBtn>
          ))}
          <div className="flex items-center gap-1 px-1.5 bg-gradient-to-b from-[#dff0ff] to-[#b7d8f5] border border-[#7aa5cc] rounded-[3px]">
            <span className="text-[9px] font-black text-[#c00]">30—</span>
            <span className="text-[9px] font-black text-[#04c]">✕9</span>
            <span className="text-[10px] font-black text-[#c00]">HOŞ GELDİNİZ</span>
            <span className="text-[9px] font-black text-[#04c]">✕9</span>
          </div>
          {[4, 5, 6].map((k) => (
            <KBtn key={k} onClick={() => setInfo(`${k}. Kat — bağlantı sonrası salona girebilirsiniz.`)}>{k}. Kat</KBtn>
          ))}
        </div>

        {/* Ana alan */}
        <div className="flex gap-2 p-2" style={{ background: "linear-gradient(180deg,#e8f2fb 0%,#dbe9f7 60%,#cfe0f2 100%)" }}>
          {/* Sol: Canlı Destek + Misafir Giriş */}
          <div className="w-[118px] shrink-0 flex flex-col gap-2">
            <div className="border border-[#7f9db9] bg-white">
              <div className="h-[86px] overflow-hidden flex items-end justify-center bg-gradient-to-b from-[#cfe4f7] to-[#9fc4e6]">
                <span className="text-[52px] leading-none">👩‍💼</span>
              </div>
              <button
                className="w-full h-[22px] text-[11px] font-bold text-white"
                style={{ background: "linear-gradient(180deg,#7ed957 0%,#3faa23 55%,#2c7d17 100%)", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}
                onClick={() => setInfo("Canlı destek için önce bağlanın — giriş sonrası Yardım salonuna girebilirsiniz.")}
              >
                Canlı Destek
              </button>
            </div>
            <button className="border border-[#7f9db9] bg-white pt-1 pb-[2px] flex flex-col items-center gap-[2px] hover:bg-[#f0f6fd]" onClick={misafirGiris}>
              <span className="text-[24px] leading-none">🔑</span>
              <span className="text-[10px] font-bold text-[#333]">Misafir Giriş</span>
            </button>
          </div>

          {/* Sağ: form */}
          <div className="flex-1 min-w-0 text-[11px]">
            <div className="flex items-center gap-1 mb-[5px]">
              <span className="w-[42px] text-right font-bold">Nick:</span>
              <KInput value={nick} onChange={(e) => { setNick(e.target.value); setErr(""); }} maxLength={20} className="w-[150px]" placeholder="nick" autoFocus />
              <KCheck checked={beniHatirla} onChange={setBeniHatirla} label="Beni Hatırla" />
              <KCheck
                checked={robot}
                onChange={setRobot}
                label={
                  <span className="inline-flex items-center gap-[3px]">
                    Robot{" "}
                    <span className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-[2px] bg-[#4285f4] text-[8px] text-white font-black">r</span>
                  </span>
                }
              />
            </div>
            <div className="flex items-center gap-1 mb-[5px]">
              <span className="w-[42px] text-right font-bold">Şifre:</span>
              <KInput type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} maxLength={30} className="w-[150px]" placeholder="••••••" onKeyDown={(e) => e.key === "Enter" && void baglan()} />
              <KCheck checked={radyoKapali} onChange={setRadyoKapali} label="Radyoyu Kapat" />
            </div>
            <div className="flex items-center gap-1 mb-[6px] pl-[46px]">
              <KCheck
                checked={kurallar}
                onChange={setKurallar}
                label={<span className="font-bold text-[#b00] underline decoration-dotted">Kuralları Kabul Ediyorum</span>}
              />
              <button className="text-[9px] text-[#0645ad] underline decoration-dotted" onClick={() => setDlg("kurallar")}>(kurallar)</button>
            </div>
            <div className="flex items-center gap-[5px] flex-wrap">
              <KBtn primary onClick={() => void baglan()} disabled={busy}>
                {busy ? "Bağlanıyor…" : "Bağlan"}
              </KBtn>
              <KBtn onClick={() => { setDlg("uyeol"); setErr(""); }}>Üye Ol</KBtn>
              <KBtn onClick={() => setInfo("Şifre yardımı için aşağıdaki 'Şifremi Unuttum' bağlantısını kullanın.")}>🔑</KBtn>
            </div>
            {(err || info) && <p className={`mt-[6px] text-[10px] font-bold ${err ? "text-[#c00]" : "text-[#070]"}`}>{err || info}</p>}
            <p className="mt-[6px] text-[10px] text-[#c00] font-bold">Üye bilgilerinizi yazıp bağlan düğmesini tıklayın</p>
          </div>
        </div>

        {/* Hızlı bağlantı şeridi */}
        <div className="flex items-center gap-2 px-2 py-[3px] bg-[#dce8f5] border-y border-[#8aa4c0] text-[10px] flex-wrap">
          <KLink onClick={() => setInfo("Salon listesine bağlantı sonrası erişebilirsiniz.")}>Ne Oynamak İsterseniz</KLink>
          <KLink onClick={() => setInfo("Üye arama bağlantı sonrası aktif olur.")}>Üye Ara</KLink>
          <KLink onClick={() => setInfo("İllere göre salonlar bağlantı sonrası aktif.")}>İllere Göre Salonlar</KLink>
          <span className="ml-auto flex items-center gap-2">
            <KLink onClick={() => go({ name: "indir" })}>🤖 Android</KLink>
            <KLink onClick={() => go({ name: "indir" })}> iOS</KLink>
          </span>
        </div>

        {/* GOLD reklam bandı */}
        <button
          className="block w-full text-left border-y border-[#8aa4c0] bg-white px-2 py-1 hover:brightness-95"
          onClick={() => setInfo("Gold üyelik için önce bağlanın.")}
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-[3px]">
              <span className="italic font-black text-[13px] text-[#1a1f71] tracking-tight">VISA</span>
              <span className="flex -space-x-[7px]">
                <span className="w-[17px] h-[17px] rounded-full bg-[#eb001b]" />
                <span className="w-[17px] h-[17px] rounded-full bg-[#f79e1b] opacity-90" />
              </span>
              <span className="text-[7px] font-bold bg-[#ffd800] text-black px-1">KREDİ KARTI İLE ÖDEME KOLAYLIĞI</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-black text-[#c00] leading-tight">
                Kredi kartı ile anında 1 aylık
                <br />
                GOLD üyelik için tıklayın <span className="text-[15px]">499 TL</span>
              </p>
            </div>
          </div>
        </button>

        {/* Alt bağlantılar */}
        <div className="flex items-center justify-center gap-2 py-[3px] bg-[#dce8f5] text-[10px] flex-wrap">
          <KLink onClick={() => setDlg("sifre")}>Şifremi Unuttum/Nickimi Kaybettim</KLink>
          <KLink onClick={() => setInfo("Gold üyelik için önce bağlanın.")}>GOLD Üyelik</KLink>
          <KLink onClick={() => setDlg("arkadas")}>Arkadaşım Nerede</KLink>
          <KLink onClick={() => { setDlg("uyeol"); setErr(""); }}>Üye Ol</KLink>
          <KLink onClick={() => setInfo("Bağlanamıyorsanız tarayıcınızı yenileyip tekrar deneyin.")}>Bağlanamıyorum</KLink>
        </div>

        {/* Alt bilgi + durum */}
        <div className="flex items-center gap-2 px-2 py-[3px] bg-[#d4d0c8] border-t border-[#aca899]">
          <span className="text-[9px] text-[#333] flex-1 leading-tight">
            Oyun yazılımımız Microsoft tarafından EV Code Sign sertifikasıyla doğrulanmıştır.{" "}
            <button className="text-[#0645ad] underline decoration-dotted" onClick={() => setInfo("EV Code Sign sertifikası doğrulandı ✓ — hasokey.com.tr")}>
              Doğrulamayı Gör
            </button>
          </span>
          <span className="flex items-center gap-[6px] text-[13px]">
            <span title="Facebook">ⓕ</span>
            <span title="Instagram">▣</span>
            <span title="TikTok">♪</span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 h-[18px] bg-[#d4d0c8] border-t border-[#aca899]">
          <span className="text-[9px] text-[#333] flex-1 truncate">
            {busy ? "Sunucuya bağlanılıyor…" : `📻 Radyo: ${radyoKapali ? "Kapalı" : "▶ Çalıyor"} — Bağlantı bekleniyor…`}
          </span>
        </div>

        {/* Pencere içi diyaloglar */}
        {dlg === "uyeol" && (
          <KDlg title="Üye Ol — Yeni Üyelik" onClose={() => setDlg(null)}>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Nick:</span>
                <KInput value={uNick} onChange={(e) => setUNick(e.target.value)} maxLength={20} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Şifre:</span>
                <KInput type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} maxLength={30} className="flex-1" />
              </div>
              <div className="flex items-center gap-3 pl-[60px]">
                <KCheck checked={cinsiyet === "e"} onChange={() => setCinsiyet("e")} label="Bay" />
                <KCheck checked={cinsiyet === "k"} onChange={() => setCinsiyet("k")} label="Bayan" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">E-posta:</span>
                <KInput type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} maxLength={80} placeholder="zorunlu" className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Ülke:</span>
                <KInput value={uCountry} onChange={(e) => setUCountry(e.target.value)} maxLength={60} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Şehir:</span>
                <KInput value={uCity} onChange={(e) => setUCity(e.target.value)} maxLength={60} placeholder="zorunlu" className="flex-1" />
              </div>
              {err && <p className="text-[10px] text-[#c00] font-bold">{err}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <KBtn onClick={() => setDlg(null)}>Vazgeç</KBtn>
                <KBtn primary onClick={() => void uyeOl()} disabled={busy}>{busy ? "Kaydediliyor…" : "Kayıt Ol"}</KBtn>
              </div>
              <p className="text-[9px] text-[#555]">Yeni üyeler Normal Üye olarak başlar.</p>
            </div>
          </KDlg>
        )}

        {dlg === "kurallar" && (
          <KDlg title="Oyun Kuralları" onClose={() => setDlg(null)}>
            <div className="text-[11px] space-y-1 max-h-[220px] overflow-auto">
              <p><b>101:</b> Taşları per/seri olarak açın, elinizi bitirin. Yerden aldığınız taşı atamazsınız.</p>
              <p><b>Okey:</b> Taşlarınızı gruplayıp okey taşını joker olarak kullanın.</p>
              <p><b>34 / 51:</b> Sayı toplamı oyunları — hedefe ilk ulaşan kazanır.</p>
              <p><b>Domino:</b> Klasik kuyu domino kuralları geçerlidir.</p>
              <p><b>Genel:</b> Hakaret, reklam ve spam yasaktır. Yetkili kararları bağlayıcıdır.</p>
              <div className="flex justify-end pt-1">
                <KBtn primary onClick={() => { setDlg(null); setKurallar(true); }}>Okudum, Kabul Ediyorum</KBtn>
              </div>
            </div>
          </KDlg>
        )}

        {dlg === "sifre" && (
          <KDlg title="Şifremi Unuttum / Nickimi Kaybettim" onClose={() => setDlg(null)}>
            <div className="text-[11px] space-y-2">
              <p>Kayıtlı nick'inizi yazın, kayıt durumunu gösterelim:</p>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Nick:</span>
                <KInput value={sNick} onChange={(e) => setSNick(e.target.value)} maxLength={20} className="flex-1" />
                <KBtn onClick={() => setSSonuc(sNick.trim().length >= 3 ? `Nick kaydı bulundu: ${sNick.trim()} — şifre sıfırlama için site yetkilisine başvurun.` : "Nick yazın.")}>Sorgula</KBtn>
              </div>
              {sSonuc && <p className="text-[10px] font-bold text-[#0645ad]">{sSonuc}</p>}
            </div>
          </KDlg>
        )}

        {dlg === "arkadas" && (
          <KDlg title="Arkadaşım Nerede" onClose={() => setDlg(null)}>
            <div className="text-[11px] space-y-2">
              <p>Arkadaşınızın nick'ini yazın:</p>
              <div className="flex items-center gap-2">
                <span className="w-[52px] font-bold">Nick:</span>
                <KInput value={aNick} onChange={(e) => setANick(e.target.value)} maxLength={20} className="flex-1" />
                <KBtn onClick={() => setASonuc(aNick.trim().length >= 3 ? `"${aNick.trim()}" şu anda bağlantı ekranında görünüyor.` : "Nick yazın.")}>Bul</KBtn>
              </div>
              {aSonuc && <p className="text-[10px] font-bold text-[#0645ad]">{aSonuc}</p>}
            </div>
          </KDlg>
        )}
      </div>
    </div>
  );
}

/** Rota içeriğini istemci penceresine akıtan tek nokta */
function Icerik({ route }: { route: Route }) {
  switch (route.name) {
    case "salon":
      return <SalonPage game={route.game} />;
    case "salonRoom":
      return <SalonRoomPage floor={route.floor} slot={route.slot} />;
    case "oyun": {
      const page = route.game === "domino" ? <DominoGamePage /> : route.game === "batak" ? <BatakGamePage /> : <OkeyGamePage mode={route.game} />;
      return <GameShell>{page}</GameShell>;
    }
    case "oyunOnline":
      return <GameShell><OnlineOkeyPage mode={route.game} /></GameShell>;
    case "sohbet":
      return <ChatSalonPage room={route.room} />;
    case "panel":
      return <AdminPanelPage />;
    case "kira":
      return <KiraPage />;
    case "gold":
      return <GoldPage />;
    case "indir":
      return <IndirPage />;
    case "lobi":
    case "giris":
    default:
      return <LobbyPage floor={route.name === "lobi" ? route.floor : 1} />;
  }
}

/** Pencere başlığı için rota etiketi */
function routeLabel(route: Route): string {
  switch (route.name) {
    case "lobi": return `${route.floor ?? 1}. Kat — Salonlar`;
    case "salonRoom": return `${route.floor}. Kat · ${route.slot}. Salon`;
    case "salon": return "Oyun Salonu";
    case "oyun": return "Oyun Masası";
    case "oyunOnline": return "Online Oyun";
    case "sohbet": return route.room === "yardim" ? "Yardım Salonu" : "Yöneticiler Salonu";
    case "panel": return "Yönetim Paneli";
    case "kira": return "Salon Kiralama";
    case "gold": return "Gold Üyelik";
    case "indir": return "Oyunu İndir";
    default: return "Ana Salon";
  }
}

export function Istemci() {
  const me = useApp((s) => s.me);
  const route = useApp((s) => s.route);
  const go = useApp((s) => s.go);
  const logout = useApp((s) => s.logout);

  // Oyun sayfaları tam ekranda kalsın (mobil dikey kapak dahil) — istemci çerçevesi olmadan
  const inGame = route.name === "oyun" || route.name === "oyunOnline";

  if (!me) {
    return (
      <div className="fixed inset-0 z-40">
        <Pencere title="hasokey.com.tr" sub="Bağlantı">
          <BaglantiEkrani />
        </Pencere>
      </div>
    );
  }

  if (inGame) {
    return (
      <div className="min-h-screen w-full">
        <Icerik route={route} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 p-0 sm:p-3" style={{ background: "#3a6ea5" }}>
      <div className="w-full h-full sm:max-w-[1500px] sm:mx-auto">
        <Pencere
          title="hasokey.com.tr"
          sub={routeLabel(route)}
          onClose={() => {
            if (route.name === "lobi") logout();
            else go({ name: "lobi", floor: 1 });
          }}
        >
          {/* Üst bilgi şeridi: nick · ünvan · çip · işlemler · çıkış */}
          <div className="flex items-center gap-2 px-2 py-1 bg-[#d4d0c8] border-b border-[#808080] text-[12px] text-black shrink-0 flex-wrap">
            <span className="font-bold">👤 {me.nick}</span>
            <RankBadge rank={me.rank} />
            {me.gold && <span className="text-[#b8860b] font-bold" title="Gold Üye">★</span>}
            <span className="font-bold text-[#0a55c8]">{me.chips.toLocaleString("tr-TR")} çip</span>
            <span className="ml-auto flex items-center gap-1">
              <KBtn onClick={() => go({ name: "site" })}>🌐 Site</KBtn>
              <MessageInbox />
              {can(me.rank, "mute") && <KBtn onClick={() => go({ name: "panel" })}>🛡️ Yönetim</KBtn>}
              <KBtn onClick={() => go({ name: "indir" })}>⬇ İndir</KBtn>
              <KBtn onClick={() => go({ name: "gold" })}>💰 Gold</KBtn>
              <KBtn onClick={() => go({ name: "lobi", floor: 1 })}>🏠 Salonlar</KBtn>
              <KBtn onClick={logout}>Çıkış</KBtn>
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto relative">
            <Icerik route={route} />
          </div>
        </Pencere>
      </div>
    </div>
  );
}