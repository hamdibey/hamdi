import { useEffect, useState } from "react";
import { useApp } from "../store/useApp";
import { YAKINDA } from "../lib/sunucu";
import { api, type ApiTopUser } from "../lib/api";
import { RobotDogrulama } from "../components/RobotDogrulama";

// ---------------------------------------------------------------------------
// Herkese açık WEB SİTESİ (anasayfa) — klasik Türk oyun portalı tarzı.
// Akış: ziyaretçi → Üye Ol → Oyunu İndir (exe kurulum paketi) → programdan
// giriş yapar → lobi. Program (exe) #masaustu ile doğrudan lobiye açılır.
// ---------------------------------------------------------------------------

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

const ZIP_URL = `${import.meta.env.BASE_URL}veradekorasyon-oyun-kurulum.zip?v=${__VK_SURUM__}`;
const VIDEO_URL = `${import.meta.env.BASE_URL}oyun-videosu.mp4`;

const OYUNLAR = [
  { icon: "🀄", ad: "101 Okey", aciklama: "Joker destekli 101 — 12 taş, seri/küt motoru", renk: "#c22020" },
  { icon: "🔵", ad: "Okey", aciklama: "Klasik okey — 4 kişi, 11 el, çifte ve düz", renk: "#0a3a9c" },
  { icon: "🦴", ad: "Domino", aciklama: "Kemiklik ve kilitlenme kurallı domino", renk: "#7a5c00" },
  { icon: "🃏", ad: "Batak", aciklama: "İhaleli batak — koz, boş geçme, kumbara", renk: "#0a7a2f" },
  { icon: "♦️", ad: "Online 34", aciklama: "Gerçek üyelerle anlık eşleşmeli 34", renk: "#6b2fa0" },
  { icon: "♠️", ad: "Online 51", aciklama: "Gerçek üyelerle anlık eşleşmeli 51", renk: "#b04a00" },
];

const ADIMLAR = [
  {
    n: "1",
    baslik: "Üye Olun",
    metin: "Aşağıdaki \"Üye Ol\" düğmesiyle nick, şifre ve e-posta ile ücretsiz üyelik açın. Robot doğrulamasını geçtiniz mi? Anında giriş yaparsınız, onay e-postası gerekmez.",
  },
  {
    n: "2",
    baslik: "Oyunu İndirin",
    metin: "\"Oyunu İndir\" düğmesi kurulum paketini (zip) indirir. Zip'i açıp içindeki Oyunu-Kur.bat dosyasına çift tıklayın — masaüstüne oyun ikonu kurulur.",
  },
  {
    n: "3",
    baslik: "Lobiye Girin",
    metin: "Kurulan programı açın, nick ve şifrenizle giriş yapın. Kat seçin, salona girin, masanızı açın — oyun hazır!",
  },
];

function KBtn({
  children,
  onClick,
  primary,
  href,
  download,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  href?: string;
  download?: boolean;
}) {
  const style = {
    boxShadow:
      "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf",
  } as const;
  const cls = `px-4 h-[30px] inline-flex items-center gap-1 text-[13px] font-black active:translate-y-px ${
    primary ? "bg-[#f4c542] text-[#4a2c00]" : "bg-[#d4d0c8] text-black"
  }`;
  if (href) {
    return (
      <a href={href} download={download} className={cls} style={style} target={download ? undefined : "_blank"} rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

/** Klasik kayan kırmızı duyuru bandı */
function Marquee({ text }: { text: string }) {
  return (
    <div className="bg-[#7a0f0f] text-white text-[12px] font-bold py-[2px] overflow-hidden whitespace-nowrap border-y border-black">
      <span className="vk-marquee">{text}</span>
    </div>
  );
}

/** Herkese açık web sitesi */
export function SitePage() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const login = useApp((s) => s.login);
  const showToast = useApp((s) => s.showToast);

  // Hızlı üye girişi (sağ sütun)
  const [gNick, setGNick] = useState("");
  const [gPass, setGPass] = useState("");
  const [gErr, setGErr] = useState("");
  const [gBusy, setGBusy] = useState(false);

  // Üye ol penceresi
  const [uyeAcik, setUyeAcik] = useState(false);
  const [uNick, setUNick] = useState("");
  const [uPass, setUPass] = useState("");
  const [cinsiyet, setCinsiyet] = useState<"e" | "k">("e");
  const [uEmail, setUEmail] = useState("");
  const [uCountry, setUCountry] = useState("Türkiye");
  const [uCity, setUCity] = useState("");
  const [uErr, setUErr] = useState("");
  const [uBusy, setUBusy] = useState(false);
  const [uOk, setUOk] = useState(false);
  const [uRobot, setURobot] = useState(false);

  // Anasayfa süsleri: canlı saat + TOP 5 şampiyon
  const [simdi, setSimdi] = useState(() => new Date());
  const [top5, setTop5] = useState<ApiTopUser[]>([]);

  useEffect(() => {
    const t = setInterval(() => setSimdi(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let abone = true;
    api
      .top10()
      .then((r) => abone && setTop5(r.top.slice(0, 5)))
      .catch(() => {});
    return () => {
      abone = false;
    };
  }, []);

  const indir = () => {
    const a = document.createElement("a");
    a.href = ZIP_URL;
    a.download = "veradekorasyon-oyun-kurulum.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Kurulum paketi indiriliyor… Zip'i açıp Oyunu-Kur.bat dosyasına çift tıklayın.");
  };

  const girYap = async () => {
    if (gBusy) return;
    setGErr("");
    if (gNick.trim().length < 3) return setGErr("Nick yazınız (en az 3 karakter).");
    if (gPass.length < 4) return setGErr("Şifreniz en az 4 karakter olmalı.");
    setGBusy(true);
    const e = await login(gNick.trim(), gPass, "login");
    setGBusy(false);
    if (e) setGErr(e);
    // giriş başarılıysa store otomatik olarak lobiye (istemciye) yönlendirir
  };

  const uyeOlYap = async () => {
    if (uBusy) return;
    setUErr("");
    if (uNick.trim().length < 3) return setUErr("Nick en az 3 karakter olmalı.");
    if (uPass.length < 4) return setUErr("Şifre en az 4 karakter olmalı.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(uEmail.trim()))
      return setUErr("Geçerli bir e-posta adresi girin (zorunlu).");
    if (uCountry.trim().length < 2) return setUErr("Ülke zorunludur.");
    if (uCity.trim().length < 2) return setUErr("Şehir zorunludur.");
    if (!uRobot) return setUErr("Robot doğrulamasını tamamlayın — sorunun cevabını yazın.");
    setUBusy(true);
    const e = await login(uNick.trim(), uPass, "register", cinsiyet, uEmail.trim(), uCountry.trim(), uCity.trim());
    setUBusy(false);
    if (e) setUErr(e);
    else {
      setUOk(true);
      // üyelik açıldı — siteye dönüp indirme adımını göster
      go({ name: "site" });
    }
  };

  const navBtn = "px-2 py-[3px] text-[12px] font-bold text-[#0a3a9c] hover:text-[#c22020] hover:underline decoration-dotted";

  return (
    <div className="min-h-screen" style={{ fontFamily: TAHOMA, background: "#3a6ea5" }}>
      <div className="mx-auto max-w-[1080px] p-2 sm:p-3">
        <div className="bg-[#d4d0c8] hk-out p-[3px]">
          <div className="hk-in bg-white">
            {/* ── Üst: logo + navigasyon ───────────────────────────── */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-[#808080] bg-gradient-to-b from-white to-[#e8f0f9] flex-wrap">
              <span className="flex items-center gap-1">
                <span className="vk-star-pulse text-[#1c6ee4] font-black text-[22px] leading-none">★★</span>
                <span className="vk-logo-shine font-black text-[22px] leading-none tracking-wide text-[#c22020]">
                  hasokey.com.tr
                </span>
                <span className="vk-star-pulse text-[#1c6ee4] font-black text-[22px] leading-none" style={{ animationDelay: "0.8s" }}>★★</span>
              </span>
              <span className="font-bold italic text-[#1c6ee4] text-[15px] hidden sm:inline">Sevd.</span>
              <span className="px-2 py-[2px] text-[10px] font-bold text-white bg-[#0a7a2f] hidden md:inline-flex items-center gap-1">
                <span className="vk-pulse-dot w-[6px] h-[6px] rounded-full bg-[#7dff9d]"></span> CANLI
              </span>
              <span className="px-2 py-[2px] text-[10px] font-bold text-[#4a2c00] bg-[#f4c542] hk-in hidden lg:inline">
                🕐 {simdi.toLocaleTimeString("tr-TR")} · {simdi.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" })}
              </span>
              <span className="ml-auto flex items-center gap-1 flex-wrap">
                <button className={navBtn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Ana Sayfa
                </button>
                <button className={navBtn} onClick={() => setUyeAcik(true)}>
                  Üye Ol
                </button>
                <button className={navBtn} onClick={indir}>
                  Oyunu İndir
                </button>
                <button className={navBtn} onClick={() => go({ name: "giris" })}>
                  {me ? "Oyuna Gir" : "Üye Girişi"}
                </button>
                {me && (
                  <span className="px-2 py-[2px] text-[12px] font-bold text-[#0a55c8]">
                    👤 {me.nick}
                  </span>
                )}
              </span>
            </div>

            <Marquee
              text={`★★★ hasokey.com.tr Oyun Salonu'na hoş geldiniz ★★★ 101 Okey · Okey · Domino · Batak · Online 34/51 ★★★ Gold üyeler kazandıkları çiplerin 2 KATINI alır ★★★ Yakında: ${YAKINDA.join(" · ")} ★★★`}
            />

            {/* ── Hero: tanıtım + video + büyük düğmeler ──────────── */}
            <div className="relative p-3 sm:p-4 flex flex-col lg:flex-row gap-4 overflow-hidden" style={{ background: "linear-gradient(180deg,#8fc4ee 0%,#4a90d9 45%,#2f6fc4 100%)" }}>
              {/* Dekoratif okey taşları — hero'nun sol üstünde süzülür */}
              <span className="vk-tile-float absolute left-2 top-2 text-[26px] select-none pointer-events-none opacity-70 hidden sm:block">🀄</span>
              <span className="vk-tile-float absolute left-14 top-16 text-[20px] select-none pointer-events-none opacity-60 hidden sm:block" style={{ animationDelay: "1.4s" }}>🔵</span>
              <span className="vk-tile-float absolute right-2 bottom-2 text-[22px] select-none pointer-events-none opacity-60 hidden lg:block" style={{ animationDelay: "2.6s" }}>🦴</span>
              <span className="vk-tile-float absolute right-24 top-3 text-[20px] select-none pointer-events-none opacity-50 hidden lg:block" style={{ animationDelay: "0.7s" }}>🃏</span>
              {/* Dama dokusu */}
              <div className="vk-hero-dots absolute inset-0 pointer-events-none"></div>
              <div className="flex-1 min-w-0 text-white relative">
                <h1 className="text-[26px] sm:text-[32px] font-black leading-tight" style={{ textShadow: "0 2px 0 #17406e" }}>
                  101 Okey, Okey, Domino ve Batak
                  <br />
                  <span className="text-[#ffe95c]">artık programında!</span>
                </h1>
                <p className="mt-2 text-[13px] leading-snug max-w-[520px]" style={{ textShadow: "0 1px 0 #17406e" }}>
                  Ücretsiz üye olun, oyunu bilgisayarınıza kurun ve klasik masaüstü programıyla
                  salonlara girin. 4 kat × 50 kiralık salon, gerçek üyelerle canlı oyun,
                  sesli görüşme ve sohbet — hepsi tek programda.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setUyeAcik(true)}
                    className="px-5 h-[36px] text-[15px] font-black bg-[#f4c542] text-[#4a2c00] active:translate-y-px"
                    style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                  >
                    ✍ ÜYE OL (Ücretsiz)
                  </button>
                  <button
                    onClick={indir}
                    className="px-5 h-[36px] text-[15px] font-black bg-[#d4d0c8] text-black active:translate-y-px"
                    style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                  >
                    ⬇ OYUNU İNDİR (Windows)
                  </button>
                  <button
                    onClick={() => go({ name: "giris" })}
                    className="px-5 h-[36px] text-[15px] font-black bg-[#d4d0c8] text-black active:translate-y-px"
                    style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                  >
                    🌐 Tarayıcıdan Oyna
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-bold text-[#ffe95c]">
                  Kurulum: zip'i aç → Oyunu-Kur.bat → masaüstüne ikon → programdan giriş → Lobi
                </p>
              </div>
              <div className="w-full lg:w-[420px] shrink-0 relative">
                <div className="bg-[#d4d0c8] hk-out p-1">
                  <video src={VIDEO_URL} controls playsInline className="w-full h-[220px] bg-black block" />
                </div>
                <p className="text-center text-[10px] font-bold text-white mt-1" style={{ textShadow: "0 1px 0 #17406e" }}>
                  Oyun tanıtım videosu — programdan lobi ve masa görünümü
                </p>
              </div>
            </div>

            {/* ── İstatistik şeridi (klasik portal rozetleri) ──────── */}
            <div className="border-y border-[#808080] bg-[#d4d0c8] px-3 py-[6px] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold">
              <span className="text-[#0a3a9c]">🏛 6 Kat × 50 Salon</span>
              <span className="text-[#7a1414]">🎲 6 Oyun</span>
              <span className="text-[#0a7a2f]">🎙 Sesli Görüşme</span>
              <span className="text-[#7a5c00]">⭐ Gold Üyelik</span>
              <span className="text-[#555]">🛡 Robot Doğrulamalı Üyelik</span>
              <span className="ml-auto text-[#0a55c8]">✳ 7/24 Açık Lobi</span>
            </div>

            {/* ── Gövde: 3 adım + oyunlar / sağ sütun ─────────────── */}
            <div className="p-3 flex flex-col lg:flex-row gap-3">
              <div className="flex-1 min-w-0">
                {/* 3 adım */}
                <p className="text-[14px] font-black text-[#7a1414] mb-2">
                  🎯 3 ADIMDA OYNAYIN
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {ADIMLAR.map((a) => (
                    <div key={a.n} className="hk-in bg-white p-2">
                      <div className="flex items-center gap-2">
                        <span className="w-[26px] h-[26px] shrink-0 bg-[#c22020] text-white font-black text-[15px] flex items-center justify-center">
                          {a.n}
                        </span>
                        <span className="text-[13px] font-black text-[#0a3a9c]">{a.baslik}</span>
                      </div>
                      <p className="text-[11px] leading-snug mt-1 hk-dim">{a.metin}</p>
                    </div>
                  ))}
                </div>

                {/* Oyunlar */}
                <p className="text-[14px] font-black text-[#7a1414] mt-4 mb-2">🎲 OYUNLAR</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OYUNLAR.map((o) => (
                    <div
                      key={o.ad}
                      className="hk-in bg-white cursor-pointer transition-all hover:-translate-y-[2px] hover:shadow-md"
                      onClick={() => go({ name: "giris" })}
                    >
                      <div className="h-[4px]" style={{ background: o.renk }}></div>
                      <div className="p-2">
                        <p className="text-[18px] leading-none">
                          {o.icon} <span className="text-[13px] font-black text-[#0a3a9c] align-middle">{o.ad}</span>
                        </p>
                        <p className="text-[10px] mt-1 hk-dim leading-snug">{o.aciklama}</p>
                        <p className="text-[9px] mt-1 font-bold" style={{ color: o.renk }}>Oyna →</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bilgi */}
                <div className="hk-out bg-[#dce8f5] mt-4 p-2 text-[11px] leading-snug">
                  <b className="text-[#7a1414]">Oyun Hakkında:</b> 101 ve Okey oyunlarını bilgisayara karşı,
                  joker destekli seri/küt motoruyla; Domino'yu kemiklik ve kilitlenme kuralıyla,
                  Batak'ı ihaleli modda oynayabilirsiniz. Online 34/51'de gerçek üyelerle eşleşirsiniz.
                  <b> Gold üyeler</b> kazandıkları çiplerin 2 katını alır; kiralı salonlarda kendi
                  kurallarınızla oyun açabilirsiniz.
                </div>
              </div>

              {/* Sağ sütun: hızlı giriş + sayaçlar */}
              <aside className="w-full lg:w-[240px] shrink-0 flex flex-col gap-2">
                <div className="hk-out bg-[#d4d0c8] p-2">
                  <p className="text-[12px] font-black text-[#7a1414] mb-1">👤 ÜYE GİRİŞİ</p>
                  {me ? (
                    <div className="text-[12px] leading-snug">
                      <p className="font-bold text-[#0a55c8]">Hoş geldin {me.nick}</p>
                      <button
                        onClick={() => go({ name: "giris" })}
                        className="mt-2 w-full px-3 h-[28px] text-[13px] font-black bg-[#f4c542] text-[#4a2c00] active:translate-y-px"
                        style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                      >
                        🏠 OYUNA / LOBİYE GİR
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <input
                        value={gNick}
                        onChange={(e) => setGNick(e.target.value)}
                        placeholder="Nick"
                        className="bg-white text-[12px] px-2 h-[24px] outline-none hk-in"
                      />
                      <input
                        type="password"
                        value={gPass}
                        onChange={(e) => setGPass(e.target.value)}
                        placeholder="Şifre"
                        onKeyDown={(e) => e.key === "Enter" && void girYap()}
                        className="bg-white text-[12px] px-2 h-[24px] outline-none hk-in"
                      />
                      {gErr && <p className="text-[10px] font-bold text-[#b02a10]">{gErr}</p>}
                      <button
                        onClick={() => void girYap()}
                        disabled={gBusy}
                        className="px-3 h-[26px] text-[12px] font-black bg-[#d4d0c8] active:translate-y-px disabled:opacity-50"
                        style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                      >
                        {gBusy ? "Bağlanıyor…" : "Bağlan (Lobi)"}
                      </button>
                      <button onClick={() => setUyeAcik(true)} className="text-[11px] font-bold text-[#0645ad] hover:underline decoration-dotted text-left">
                        Üye değil misiniz? Ücretsiz Üye Olun →
                      </button>
                    </div>
                  )}
                </div>

                <div className="hk-out bg-[#d4d0c8] p-2 text-[11px] leading-relaxed">
                  <p className="font-black text-[#7a1414] mb-1">📊 SİTE ÖZETİ</p>
                  <p><b>4 kat</b> × <b>50 salon</b> — kiralık salon seçeneği</p>
                  <p><b>7/24</b> açık lobi ve sohbet</p>
                  <p><b>Sesli görüşme</b> + özel mesaj</p>
                  <p><b>Gold</b> üyeler için 2 kat çip</p>
                </div>

                <div className="hk-out bg-[#d4d0c8] p-2 text-[11px] leading-relaxed">
                  <p className="font-black text-[#7a1414] mb-1">📦 PROGRAM (EXE)</p>
                  <p className="hk-dim">
                    Windows 10/11 · <b>Electron</b> ile çalışır — gerçek masaüstü programı, tarayıcı çubuğu yok.
                    Kurulum tek adımda: <b>Oyunu-Kur.bat</b> veya doğrudan <b>veradekorasyon-oyun.exe</b>.
                  </p>
                  <button
                    onClick={indir}
                    className="mt-2 w-full px-3 h-[28px] text-[13px] font-black bg-[#f4c542] text-[#4a2c00] active:translate-y-px"
                    style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                  >
                    ⬇ OYUNU İNDİR
                  </button>
                </div>

                {/* CANLI TOP 5 — şampiyonlar sıralaması */}
                <div className="hk-out bg-[#d4d0c8] p-2 text-[11px]">
                  <p className="font-black text-[#7a1414] mb-1 flex items-center gap-1">
                    🏆 CANLI ŞAMPİYONLAR
                    <span className="vk-pulse-dot ml-auto w-[6px] h-[6px] rounded-full bg-[#0a7a2f]"></span>
                  </p>
                  {top5.length === 0 ? (
                    <p className="hk-dim">Yükleniyor…</p>
                  ) : (
                    <ol className="flex flex-col gap-[2px]">
                      {top5.map((u, i) => (
                        <li key={u.id} className="flex items-center gap-2 bg-white hk-in px-[6px] py-[3px]">
                          <span className="w-[16px] text-center font-black" style={{ color: i === 0 ? "#b8860b" : i === 1 ? "#777" : i === 2 ? "#a0522d" : "#555" }}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-[#0a3a9c] truncate">{u.avatar ? `${u.avatar} ` : ""}{u.nick}</span>
                          {u.gold ? <span title="Gold üye">⭐</span> : null}
                          <span className="ml-auto font-black text-[#7a5c00]">{u.chips.toLocaleString("tr-TR")}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </aside>
            </div>

            {/* ── Alt bilgi çubuğu ─────────────────────────────────── */}
            <div className="vk-checker h-[8px]"></div>
            <div className="border-t border-[#808080] bg-[#d4d0c8] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span className="font-bold text-[#7a1414]">hasokey.com.tr</span>
              <button onClick={() => setUyeAcik(true)} className="text-[#0645ad] hover:underline decoration-dotted font-bold">Üye Ol</button>
              <button onClick={indir} className="text-[#0645ad] hover:underline decoration-dotted font-bold">Oyunu İndir</button>
              <button onClick={() => go({ name: "giris" })} className="text-[#0645ad] hover:underline decoration-dotted font-bold">Oyuna Gir</button>
              <span className="text-[#555] hidden sm:inline">· 101 · Okey · Domino · Batak · Online 34/51</span>
              <span className="ml-auto text-[9px] text-[#555] text-right">
                T.C. Kültür ve Turizm Bakanlığı Telif Hakları Genel Müdürlüğü Kayıt Tescil: IEE-29-39052007
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Üye Ol penceresi ─────────────────────────────────────── */}
      {uyeAcik && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-3" onClick={() => setUyeAcik(false)}>
          <div
            className="bg-[#d4d0c8] hk-out w-full max-w-[420px] max-h-[88vh] overflow-y-auto"
            style={{ fontFamily: TAHOMA }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hk-title px-2 py-[3px] text-white text-[12px] font-bold flex justify-between items-center">
              <span>Üye Ol — hasokey.com.tr</span>
              <button className="hk-btn px-1 text-[10px]" onClick={() => setUyeAcik(false)}>✕</button>
            </div>
            <div className="p-3 flex flex-col gap-2 text-[12px]">
              {uOk ? (
                <div className="text-center py-2">
                  <p className="text-[28px]">✅</p>
                  <p className="font-black text-[#0a55c8] text-[14px] mt-1">Üyeliğiniz oluşturuldu!</p>
                  <p className="hk-dim mt-1 leading-snug">
                    Şimdi oyunu indirip kurun: zip'i açın, <b>Oyunu-Kur.bat</b> dosyasına çift tıklayın.
                    Masaüstüne kurulan programdan nick ve şifrenizle giriş yapıp lobiye girebilirsiniz.
                  </p>
                  <div className="flex gap-2 justify-center mt-3 flex-wrap">
                    <button
                      onClick={indir}
                      className="px-4 h-[30px] font-black bg-[#f4c542] text-[#4a2c00] active:translate-y-px"
                      style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                    >
                      ⬇ OYUNU İNDİR
                    </button>
                    <button
                      onClick={() => {
                        setUyeAcik(false);
                        go({ name: "giris" });
                      }}
                      className="px-4 h-[30px] font-black bg-[#d4d0c8] text-black active:translate-y-px"
                      style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                    >
                      🌐 Tarayıcıdan Dene
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-bold text-[#7a1414]">Ücretsiz üyelik — 1 dakikada lobiye girin</p>
                  <label className="flex flex-col gap-[2px]">
                    <span className="text-[11px] font-bold">Nick</span>
                    <input value={uNick} onChange={(e) => setUNick(e.target.value)} className="bg-white px-2 h-[24px] outline-none hk-in" />
                  </label>
                  <label className="flex flex-col gap-[2px]">
                    <span className="text-[11px] font-bold">Şifre</span>
                    <input type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} className="bg-white px-2 h-[24px] outline-none hk-in" />
                  </label>
                  <label className="flex flex-col gap-[2px]">
                    <span className="text-[11px] font-bold">E-posta</span>
                    <input value={uEmail} onChange={(e) => setUEmail(e.target.value)} className="bg-white px-2 h-[24px] outline-none hk-in" />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-[2px] flex-1">
                      <span className="text-[11px] font-bold">Ülke</span>
                      <input value={uCountry} onChange={(e) => setUCountry(e.target.value)} className="bg-white px-2 h-[24px] outline-none hk-in" />
                    </label>
                    <label className="flex flex-col gap-[2px] flex-1">
                      <span className="text-[11px] font-bold">Şehir</span>
                      <input value={uCity} onChange={(e) => setUCity(e.target.value)} className="bg-white px-2 h-[24px] outline-none hk-in" />
                    </label>
                  </div>
                  <div className="flex gap-3 text-[12px] font-bold">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={cinsiyet === "e"} onChange={() => setCinsiyet("e")} /> Erkek
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={cinsiyet === "k"} onChange={() => setCinsiyet("k")} /> Kadın
                    </label>
                  </div>
                  {/* 🛡 Robot doğrulama — kayıt gönderilmeden geçilmeli */}
                  <div className="mt-1">
                    <p className="text-[11px] font-bold mb-1">🛡 Robot Doğrulaması <span className="text-[#b02a10]">*</span></p>
                    <RobotDogrulama tema="klasik" onDogrulama={setURobot} />
                  </div>
                  {uErr && <p className="text-[11px] font-bold text-[#b02a10]">{uErr}</p>}
                  <button
                    onClick={() => void uyeOlYap()}
                    disabled={uBusy}
                    className="px-4 h-[30px] font-black bg-[#f4c542] text-[#4a2c00] active:translate-y-px disabled:opacity-50 mt-1"
                    style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf" }}
                  >
                    {uBusy ? "Kayıt yapılıyor…" : "✅ ÜYELİĞİ AÇ"}
                  </button>
                  <p className="text-[10px] hk-dim leading-snug">
                    Üyelik ücretsizdir. Kayıt olarak oyun kurallarını kabul etmiş olursunuz.
                    Robot doğrulaması sahte hesapları engeller.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
