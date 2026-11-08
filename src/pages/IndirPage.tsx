import { useEffect, useState } from "react";
import { useApp } from "../store/useApp";

type Platform = "windows" | "android" | "ios" | "mac" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh/i.test(ua)) return "mac";
  return "other";
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** PWA kurulum istemcisini tek yerde toplar (Chrome/Edge masaüstü + Android) */
function usePWAInstall() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __vkInstall?: BeforeInstallPromptEvent }).__vkInstall =
        e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanPrompt(false);
      (window as unknown as { __vkInstall?: BeforeInstallPromptEvent }).__vkInstall = undefined;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async (): Promise<"ok" | "dismissed" | "unavailable"> => {
    const evt = (window as unknown as { __vkInstall?: BeforeInstallPromptEvent }).__vkInstall;
    if (!evt) return "unavailable";
    evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") {
      setCanPrompt(false);
      return "ok";
    }
    return "dismissed";
  };

  return { canPrompt, installed, install };
}

/* ------------------------------------------------------------------ */
/* Hakkarim tarzı klasik kordon: mavi zemin · beyaz panel · ikon rayı  */
/* ------------------------------------------------------------------ */

const BLUE = "#3a6ea5";
const BLUE_DARK = "#274c72";

/** Klasik kayan duyuru bandı */
function Marquee({ text }: { text: string }) {
  return (
    <div className="bg-black text-white text-[12px] py-0.5 overflow-hidden whitespace-nowrap border-y border-black/60">
      <span className="vk-marquee">{text}</span>
    </div>
  );
}

/** Soldaki dikey ikon rayı (hakkarim'deki gibi küçük renkli simgeler) */
function IconRail({ onGo }: { onGo: (r: string) => void }) {
  const items: { icon: string; label: string; route?: string; toast?: string }[] = [
    { icon: "⬇", label: "Oyunu indir", route: "indir" },
    { icon: "🔍", label: "Üye ara", toast: "Üye arama yakında aktif olacak." },
    { icon: "👤", label: "Üye ol / Giriş", route: "giris" },
    { icon: "✉", label: "Mesaj", toast: "Mesaj kutusu salon lobisinde." },
    { icon: "💯", label: "Top 100", toast: "Top 100 listesi yakında." },
    { icon: "★", label: "Klasman", toast: "Klasman tablosu yakında." },
    { icon: "💰", label: "Gold üyelik", route: "gold" },
    { icon: "🏠", label: "Salonlar", route: "lobi" },
    { icon: "🎰", label: "Oyunlar", route: "lobi" },
    { icon: "💳", label: "Kredi", toast: "Kredi işlemleri yakında." },
  ];
  return (
    <div className="hidden md:flex flex-col gap-1 w-12 shrink-0 bg-[#d4d0c8] border border-[#808080] py-2 items-center">
      {items.map((it) => (
        <button
          key={it.label}
          title={it.label}
          onClick={() => (it.route ? onGo(it.route) : alert(it.toast))}
          className="w-9 h-9 flex items-center justify-center text-lg bg-[#c9c5bb] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#dfe9f7] active:translate-y-px"
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

/** Hakkarim'deki mağaza rozetleri (siyah yuvarlak kutular) */
function StoreBadge({
  top,
  big,
  sub,
  logo,
  onClick,
  soon,
}: {
  top?: string;
  big: string;
  sub?: string;
  logo: React.ReactNode;
  onClick?: () => void;
  soon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white w-full text-left border ${
        soon ? "border-white/20 opacity-70" : "border-white/40 hover:bg-[#1a1a1a]"
      }`}
    >
      <span className="text-xl shrink-0">{logo}</span>
      <span className="leading-tight">
        {top && <span className="block text-[9px] text-white/70">{top}</span>}
        <span className="block font-bold text-[15px] tracking-wide">{big}</span>
        {sub && <span className="block text-[9px] text-white/70">{sub}</span>}
      </span>
    </button>
  );
}

/** Sağdaki "Oyun İşlemleri" bağlantı paneli */
function IslemPaneli({ onGo, onDownload }: { onGo: (r: string) => void; onDownload: () => void }) {
  const link =
    "text-[#0033cc] hover:text-[#cc0000] hover:underline cursor-pointer leading-tight";
  const soon = (t: string) => alert(t);
  const sol: [string, () => void][] = [
    ["Oyunu Indir", onDownload],
    ["Nasıl Oynanır", () => soon("Oyunu oynamak çok kolay: masaya otur, sıran gelince taş çek, grup aç, taşı bırak. Pratik masasında deneyebilirsin!")],
    ["Onay Durumu", () => soon("Üyelik onay durumu yakında.")],
    ["Şifremi unuttum", () => onGo("giris")],
    ["Klasman 2026", () => soon("Klasman tablosu yakında.")],
    ["Top 100", () => soon("Top 100 listesi yakında.")],
    ["Nick Birleştirme", () => soon("Nick birleştirme yakında.")],
    ["Gold Üyelik 💰", () => onGo("gold")],
    ["Salon Kiralama", () => soon("Salon kiralama yetkili işlemleri panelinden yakında.")],
    ["Kayan Mesaj", () => soon("Kayan mesaj özelliği salon yönetim panelinde.")],
  ];
  const sag: [string, () => void][] = [
    ["Üye Ol", () => onGo("giris")],
    ["Üye Ara", () => soon("Üye arama yakında.")],
    ["Arkadaşım Nerede?", () => soon("Arkadaşım nerede yakında.")],
    ["Salon Turnuvası", () => soon("Salon turnuvaları yakında.")],
    ["Yöneticilerimiz", () => soon("Yönetici listesi yakında.")],
    ["Kredi Çekim/Al", () => soon("Kredi işlemleri yakında.")],
    ["Avatar Üyelik", () => soon("Avatar üyelik yakında.")],
    ["Cafe Gold Üyelik", () => soon("Cafe Gold üyelik yakında.")],
    ["Offline Mesaj", () => soon("Offline mesaj yakında.")],
    ["Ücretsiz-VIP Üyelik 👑", () => soon("VIP üyelik yakında.")],
  ];
  return (
    <div className="w-full lg:w-[300px] shrink-0">
      <div className="bg-[#d4d0c8] border border-[#808080]">
        <p className="text-center font-bold text-[15px] text-black bg-[#e9e5dd] py-1 border-b border-[#808080]">
          Oyun İşlemleri
        </p>
        <div className="grid grid-cols-2 gap-x-3 px-3 py-2 text-[13px]">
          <ul className="space-y-1">
            {sol.map(([t, fn]) => (
              <li key={t} className={link} onClick={fn}>
                • {t}
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {sag.map(([t, fn]) => (
              <li key={t} className={link} onClick={fn}>
                • {t}
              </li>
            ))}
          </ul>
        </div>
        {/* Mağaza rozetleri */}
        <div className="px-3 pb-3 space-y-1.5">
          <StoreBadge top="Hemen indir" big="App Store" logo="" soon onClick={() => soon("App Store sürümü hazırlanıyor.")} />
          <StoreBadge top="Hemen indir" big="Google play" sub="'DEN EDİNİN'" logo="▶" soon onClick={() => soon("Google Play sürümü hazırlanıyor.")} />
          <StoreBadge top="Bilgisayarına" big="INDİR" logo={<span className="text-[#00a4ef] font-bold">⊞</span>} onClick={onDownload} />
          <StoreBadge top="Hemen indir" big="AppGallery" logo="🅷" soon onClick={() => soon("AppGallery sürümü hazırlanıyor.")} />
          <StoreBadge top="Mac'ine" big="INDİR" logo="" onClick={onDownload} />
        </div>
      </div>
    </div>
  );
}

/** Cihaz banner'ı — hakkarim'deki masaüstü+tablet+telefon görselinin CSS taklidi */
function CihazBanneri() {
  return (
    <div className="relative bg-gradient-to-b from-[#eef3fa] to-[#dce6f2] border border-[#808080] p-4 overflow-hidden">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Masaüstü */}
        <div className="flex flex-col items-center">
          <div className="w-40 h-26 sm:w-52 sm:h-32 bg-[#111] rounded-md p-1 shadow-lg">
            <div className="w-full h-full bg-[#33589e] rounded-sm relative overflow-hidden">
              <div className="absolute top-1 left-1 right-1 h-2 bg-[#12315c] rounded-sm" />
              <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-0.5">
                {[...Array(8)].map((_, i) => (
                  <span key={i} className="w-2 h-3 bg-[#f5f0e1] rounded-[1px]" />
                ))}
              </div>
            </div>
          </div>
          <div className="w-16 h-2 bg-[#bbb]" />
          <div className="w-24 h-1.5 bg-[#999] rounded-b" />
        </div>
        {/* Tablet */}
        <div className="hidden sm:block w-20 h-28 bg-[#111] rounded-lg p-1 shadow-lg -rotate-6">
          <div className="w-full h-full bg-[#f5f0e1] rounded-sm" />
        </div>
        {/* Telefon */}
        <div className="w-12 h-24 bg-[#111] rounded-lg p-1 shadow-lg rotate-6">
          <div className="w-full h-full bg-[#33589e] rounded-sm" />
        </div>
      </div>
      <div className="mt-3 text-center leading-snug">
        <p className="text-[15px] font-bold">
          <span className="text-[#1d4ed8]">#telefonunuza</span>{" "}
          <span className="text-[#15803d]">#tabletinize</span>{" "}
          <span className="text-[#b91c1c]">#bilgisayariniza</span>
        </p>
        <p className="text-[13px] text-black/80">yükleyin oyun, eğlen ve sohbete katılın</p>
        <p className="mt-1 text-[13px] font-bold text-[#1d4ed8]">
          #Windows #Android #iOS #Mac
        </p>
      </div>
    </div>
  );
}

/** Klasis platform kurulum kartları */
function KurulumKarti({
  title,
  emoji,
  highlight,
  action,
  onAction,
  steps,
}: {
  title: string;
  emoji: string;
  highlight?: boolean;
  action?: string;
  onAction?: () => void;
  steps: React.ReactNode[];
}) {
  return (
    <div
      className={`border p-3 ${
        highlight ? "border-[#cc0000] bg-[#fffbe6]" : "border-[#808080] bg-white"
      }`}
    >
      <p className="font-bold text-[14px] text-black mb-2 flex items-center gap-2">
        <span className="text-xl">{emoji}</span> {title}
        {highlight && <span className="text-[10px] text-[#cc0000] font-bold">← bu cihaz</span>}
      </p>
      <ol className="space-y-1 mb-3 list-decimal list-inside text-[12px] text-black/80">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {action && (
        <button
          onClick={onAction}
          className="w-full py-1.5 bg-[#3a6ea5] hover:bg-[#274c72] text-white font-bold text-[13px] border-t border-l border-white border-b border-r border-[#404040]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function IndirPage() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const platform = detectPlatform();
  const { canPrompt, installed, install } = usePWAInstall();
  const [hint, setHint] = useState<string | null>(null);

  const goRoute = (r: string) => {
    if (r === "lobi") go(me ? { name: "lobi" } : { name: "giris" });
    else if (r === "giris") go({ name: "giris" });
    else if (r === "gold") go({ name: "gold" });
    else if (r === "indir") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** TEK DOSYA EXE — kurulum yok, çıkarım yok: indir, çift tıkla, oyun açılır. */
  const downloadExe = () => {
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}veradekorasyon-oyun.exe?v=${__VK_SURUM__}`;
    a.download = "veradekorasyon-oyun.exe";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Tek dosya indiriliyor — bitince çift tıklayıp doğrudan açın.");
    setHint(
      "İndirme başladı. Dosya bitince (Genellikle 'İndirilenler' klasörü) veradekorasyon-oyun.exe dosyasına ÇİFT TIKLAYIN — oyun hemen açılır. Kurulum, çıkarma, .bat yok; tek dosya yeter. İlk açılışta Windows 'Bilinmeyen yayıncı' uyarısı çıkarsa: 'Daha fazla bilgi' → 'Yine de Çalıştır' deyin."
    );
  };

  /** Yedek kurulum paketi (.zip + Oyunu-Kur.bat) — exe yolunda sorun yaşayanlar için. */
  const downloadZip = () => {
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}veradekorasyon-oyun-kurulum.zip?v=${__VK_SURUM__}`;
    a.download = "veradekorasyon-oyun-kurulum.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Kurulum paketi indiriliyor… İndirdikten sonra dosyayı aç, Oyunu-Kur.bat'a çift tıkla.");
    setHint(
      "İndirme başladı. Zip bitince sağ tıkla → 'Tümünü Çıkart' → içindeki Oyunu-Kur.bat dosyasına ÇİFT TIKLA. Masaüstüne oyun ikonu kurulur. (Normal yolda bu pakete gerek yok — ana düğme tek dosya .exe indirir.)"
    );
  };

  const primaryLabel =
    platform === "android"
      ? "Android'e Kur (Ücretsiz)"
      : platform === "ios"
        ? "iPad / iPhone'a Ekle"
        : platform === "windows"
          ? "Oyunu İndir — Tek Dosya (.exe)"
          : platform === "mac"
            ? "Oyunu İndir (Mac/Linux için kurulum notu)"
            : "Oyunu İndir (Ücretsiz)";

  const primaryAction = async () => {
    if (platform === "ios") {
      setHint(
        'iPhone/iPad\'de: Safari ile bu sayfayı açın → Paylaş düğmesi ▩ → "Ana Ekrana Ekle" → Ekle. Oyun ana ekranınıza uygulama olarak eklenir.'
      );
      return;
    }
    if (platform === "android") {
      if (!canPrompt) {
        setHint(
          'Tarayıcınız kurulum penceresini engelledi. Adres çubuğundaki ⋮ simgesine tıklayıp "Uygulamayı kur" / "Ana ekrana ekle" seçeneğini kullanın.'
        );
        return;
      }
      const result = await install();
      if (result === "ok") {
        showToast("Kurulum başladı — oyun ana ekranınıza eklenecek.");
        setHint(null);
      } else {
        setHint("Kurulum simgesi görünmüyor. Tarayıcı menüsünden (⋮) kurulumu deneyin.");
      }
      return;
    }
    // Windows: TEK DOSYA exe — indir, çift tıkla, oyun açılır
    if (platform === "windows" || platform === "other") {
      downloadExe();
      return;
    }
    // Mac / diğer: yedek zip paketi
    downloadZip();
  };

  return (
    <div className="min-h-screen text-black" style={{ background: BLUE }}>
      {/* Üst klasik beyaz menü şeridi */}
      <div className="bg-[#d4d0c8] border-b border-[#808080] px-3 py-1 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[13px] font-bold">
          <button onClick={() => goRoute(me ? "lobi" : "giris")} className="hover:underline text-[#0033cc]">
            ← {me ? "Lobiye Dön" : "Girişe Dön"}
          </button>
          <span className="text-black/70">Ana Sayfa</span>
        </div>
        <span className="font-bold text-[15px]">
          hasokey.com.tr<span className="text-black/60">.store</span>
        </span>
      </div>

      <Marquee text="★ Uygulamamızı telefonunuza, tabletinize, bilgisayarınıza yükleyin — oyun, eğlen ve sohbete katılın! ★ Windows · Android · iOS · Mac ★ Kurulum ücretsiz, tek tık ★ 101 Okey · Okey · 34 · 51 · Domino · Batak ★" />

      <div className="max-w-6xl mx-auto flex gap-3 p-3">
        <IconRail onGo={goRoute} />

        {/* Orta içerik */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Cihaz banner + ana indir */}
          <div className="bg-white border border-[#808080] p-3">
            <CihazBanneri />
            <div className="mt-3 text-center">
              <button
                onClick={primaryAction}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#3a6ea5] hover:bg-[#274c72] active:scale-95 text-white font-bold text-lg border-t border-l border-white border-b border-r border-[#404040] transition-transform"
              >
                <span className="text-xl">⬇</span> {installed ? "Oyun Kurulu ✓" : primaryLabel}
              </button>
              {installed && (
                <p className="mt-2 text-[13px] text-[#15803d] font-bold">
                  Uygulamanız kurulu — ana ekranınızdaki simgeden açıp doğrudan salonlara girebilirsiniz.
                </p>
              )}
              {!installed && (
                <p className="mt-1 text-[11px] text-black/60">
                  Tek dosya · Kurulum gerektirmez · Çift tıkla açılır · Ücretsiz · Hesabınız kayıtlı kalır
                </p>
              )}
              {!installed && (
                <a
                  href={`${import.meta.env.BASE_URL}veradekorasyon-oyun-kurulum.zip?v=${__VK_SURUM__}`}
                  download="veradekorasyon-oyun-kurulum.zip"
                  onClick={() => showToast("Kurulum paketi (.zip) indiriliyor — içinde Oyunu-Kur.bat var.")}
                  className="inline-block mt-2 px-3 py-1 text-[12px] font-bold text-[#0033cc] underline hover:text-[#cc0000] border border-[#808080] bg-[#f4f4f4]"
                >
                  🗜 Yedek kurulum paketi (.zip + Oyunu-Kur.bat) — exe açılmazsa
                </a>
              )}
              {hint && (
                <p className="mt-3 mx-auto max-w-xl bg-[#fffbe6] border border-[#cc0000] px-3 py-2 text-[12px] text-left">
                  {hint}
                </p>
              )}
            </div>
          </div>

          {/* Oyun videosu */}
          <div className="bg-white border border-[#808080] p-3">
            <p className="font-bold text-[14px] mb-2">🎬 Oyun Videosu — Gerçek Oynanış</p>
            <video
              src={`${import.meta.env.BASE_URL}oyun-videosu.mp4`}
              className="w-full aspect-video bg-black block border border-[#808080]"
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="101 Okey gerçek oynanış videosu"
            />
            <p className="mt-1 text-[11px] text-black/60">
              Giriş, salon ve 101 Okey masası gerçek oyun içi görüntüler.
            </p>
          </div>

          {/* Kurulum kartları */}
          <div className="bg-white border border-[#808080] p-3">
            <p className="font-bold text-[14px] mb-2">Kurulum — Cihazınıza göre</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <KurulumKarti
                title="Windows Masaüstü"
                emoji="🪟"
                highlight={platform === "windows"}
                action="Oyunu İndir (.exe — tek dosya)"
                onAction={primaryAction}
                steps={[
                  <>“<b>Oyunu İndir</b>” ile <b>tek .exe dosyası</b> iner (~3 MB).</>,
                  <>İndirilenler klasöründe dosyaya <b>ÇİFT TIKLAYIN</b> — kurulum, çıkarma, .bat yok.</>,
                  <>Windows “Bilinmeyen yayıncı” uyarısı çıkarsa: “<b>Daha fazla bilgi</b>” → “<b>Yine de Çalıştır</b>”.</>,
                  <>Oyun kendi penceresinde <b>açılır</b> — giriş yapıp salonlara girin.</>,
                ]}
              />
              <KurulumKarti
                title="Android Telefon"
                emoji="🤖"
                highlight={platform === "android"}
                action={installed ? undefined : canPrompt ? "Android'e Kur" : undefined}
                onAction={primaryAction}
                steps={[
                  <>Bu sayfayı <b>Chrome</b>'da açın.</>,
                  <>“<b>Android'e Kur</b>” düğmesine dokunun.</>,
                  <>Ana ekranınıza simge eklenir, tam ekran oynanır.</>,
                  <>Oyun açılır açılmaz <b>salon listesi</b> gelir.</>,
                ]}
              />
              <KurulumKarti
                title="iPhone / iPad"
                emoji="🍎"
                highlight={platform === "ios"}
                action={installed ? undefined : "Ana Ekrana Ekle"}
                onAction={primaryAction}
                steps={[
                  <>Bu sayfayı <b>Safari</b> ile açın.</>,
                  <>Altta <b>Paylaş</b> ▩ düğmesine dokunun.</>,
                  <>“<b>Ana Ekrana Ekle</b>” → <b>Ekle</b>.</>,
                  <>Oyun tam ekran açılır.</>,
                ]}
              />
            </div>
          </div>

          {/* Kurulumsuz oyna */}
          <div className="bg-white border border-[#808080] p-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-black/80 max-w-xl">
              <b>Oyunu indirmeden de</b> tarayıcıdan hemen oynayabilirsiniz. Hesabınız her iki
              yolda aynıdır; dilediğiniz an kurulum yaparsınız.
            </p>
            <button
              onClick={() => goRoute(me ? "lobi" : "giris")}
              className="px-4 py-2 bg-[#3a6ea5] hover:bg-[#274c72] text-white font-bold text-[13px] border-t border-l border-white border-b border-r border-[#404040]"
            >
              🎴 Hemen Oyna — Salonlara Gir
            </button>
          </div>

          <p className="text-center text-[11px] text-white/70 py-2">
            hasokey.com.tr — 101 Okey, Okey, 34, 51, Domino ve Batak online oyun portalı
          </p>
        </div>

        {/* Sağ Oyun İşlemleri paneli */}
        <IslemPaneli onGo={goRoute} onDownload={primaryAction} />
      </div>
    </div>
  );
}
