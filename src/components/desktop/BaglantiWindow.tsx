import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store/useApp";
import { useDesktop } from "../../store/useDesktop";
import { api } from "../../lib/api";
import { radyoBaslat, radyoDurdur, radyoSesAyarla, radyoKayitliUrl, radyoKayitliIstasyon, radyoUrlKaydet } from "../../lib/radyo";
import { ayarlariYukle } from "../../lib/ayarlar";
import { WinIcon } from "./WinIcon";

/* Klasik ÇİFTOKEY / hakkarim tarzı "Bağlantı" istemcisi — birebir replika */

const KATLAR = [1, 2, 3, 4] as const;

function KlasikDlg({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center pt-8 bg-black/25" onClick={onClose}>
      <div
        className="bg-[#d4d0c8] w-[340px] max-w-[92%]"
        style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 3px 4px 14px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between h-[22px] px-1.5"
          style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
        >
          <span className="text-white text-[11px] font-bold">{title}</span>
          <button
            className="w-[17px] h-[15px] text-[9px] font-bold text-white"
            style={{ background: "linear-gradient(180deg,#f08a72 0%,#d13c1d 45%,#b02a10 100%)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

function ClassicInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-white text-[11px] px-1 h-[19px] outline-none ${props.className ?? ""}`}
      style={{
        boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf",
        fontFamily: "Tahoma, sans-serif",
      }}
    />
  );
}

function ClassicBtn({
  children,
  onClick,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 h-[21px] text-[11px] font-bold text-black bg-[#d4d0c8] active:translate-y-px disabled:opacity-50 ${className}`}
      style={{
        fontFamily: "Tahoma, sans-serif",
        boxShadow:
          "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf",
      }}
    >
      {children}
    </button>
  );
}

function ClassicCheck({
  checked,
  onChange,
  label,
  color = "black",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  color?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1 cursor-pointer select-none" style={{ color }}>
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

function OkeyTile({ n }: { n: number }) {
  return (
    <div
      className="w-[17px] h-[23px] bg-gradient-to-b from-white to-[#efe6cf] rounded-[3px] flex flex-col items-center justify-center border border-[#b9ad8d]"
      style={{ boxShadow: "1px 1px 2px rgba(0,0,0,.4)" }}
    >
      <span className="text-[10px] font-black leading-none text-[#111]">{n}</span>
      <span className="w-[4px] h-[4px] rounded-full bg-[#c22] mt-[1px]" />
    </div>
  );
}

export function BaglantiWindow({ winId, onClose }: { winId: number; onClose: () => void }) {
  const login = useApp((s) => s.login);
  const me = useApp((s) => s.me);
  const go = useApp((s) => s.go);
  const radioOn = useDesktop((s) => s.radioOn);
  const setRadio = useDesktop((s) => s.setRadio);
  const openWin = useDesktop((s) => s.open);

  const remembered = useMemo(() => localStorage.getItem("vk_bag_nick") ?? "", []);
  const [nick, setNick] = useState(remembered);
  const [pass, setPass] = useState("");
  const [beniHatirla, setBeniHatirla] = useState(Boolean(remembered));
  const [robot, setRobot] = useState(false);
  const [kurallar, setKurallar] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<
    null | "uyeol" | "google" | "sifre" | "arkadas" | "kurallar" | "baglanamiyorum" | "kaybetti"
  >(null);

  // Üye ol formu
  const [uNick, setUNick] = useState("");
  const [uPass, setUPass] = useState("");
  const [cinsiyet, setCinsiyet] = useState<"e" | "k">("e");
  const [uEmail, setUEmail] = useState("");
  const [uCountry, setUCountry] = useState("Türkiye");
  const [uCity, setUCity] = useState("");
  // Google demo
  const [gNick, setGNick] = useState(() => `google${Math.floor(1000 + Math.random() * 9000)}`);
  const [gPass] = useState(() => `g${Math.floor(100000 + Math.random() * 900000)}`);
  // Şifre / kayıp nick
  const [sNick, setSNick] = useState("");
  const [sSonuc, setSSonuc] = useState("");
  // Bağlantı testi (Bağlanamıyorum penceresi)
  const [testSonuc, setTestSonuc] = useState<{ ad: string; ok: boolean; not: string }[] | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  // Arkadaşım nerede
  const [aNick, setANick] = useState("");
  const [aSonuc, setASonuc] = useState("");
  // GERÇEK radyo çalar (URL girince gerçekten çalar — mp3/aac/stream)
  const [radyoUrl, setRadyoUrl] = useState(radyoKayitliUrl());
  const [radyoIstasyon, setRadyoIstasyon] = useState(radyoKayitliIstasyon());
  const [radyoCalıyor, setRadyoCalıyor] = useState(false);
  const [radyoSes, setRadyoSes] = useState(() => ayarlariYukle().radyo);

  const radyoCal = () => {
    const u = radyoUrl.trim();
    if (!u) { setErr("Önce bir radyo URL'si girin (mp3/aac/stream)."); return; }
    radyoUrlKaydet(u, radyoIstasyon);
    const d = radyoBaslat(u, radyoIstasyon || "Radyo", radyoSes);
    setRadyoCalıyor(d.caliyor);
    if (!d.caliyor) setErr("Radyo başlatılamadı — URL'yi kontrol edin.");
  };
  const radyoDurdurBtn = () => { radyoDurdur(); setRadyoCalıyor(false); };

  // Açıkılışta kayıtlı radyo varsa ve radyo açıksa gerçekten çalmaya başlasın
  useEffect(() => {
    if (radioOn && radyoUrl.trim()) {
      const d = radyoBaslat(radyoUrl.trim(), radyoIstasyon || "Radyo", radyoSes);
      setRadyoCalıyor(d.caliyor);
    }
    return () => radyoDurdur();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Giriş yapınca ÖNCE salon penceresi açılır, giriş penceresi biraz gecikmeli
  // kapanır — aynı anda kapanıp yenisi açılırken programın kapanmaması için.
  useEffect(() => {
    if (me && !busy) {
      if (beniHatirla) localStorage.setItem("vk_bag_nick", nick.trim());
      else localStorage.removeItem("vk_bag_nick");
      go({ name: "lobi", floor: 1 });
      const t = window.setTimeout(() => onClose(), 600);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const baglan = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    if (nick.trim().length < 3) return setErr("Nick yazınız (en az 3 karakter).");
    if (pass.length < 4) return setErr("Şifreniz en az 4 karakter olmalı.");
    if (!robot) return setErr("Robot doğrulamasını işaretleyin — Nick alanının yanındaki mavi 'Robot' kutusu.");
    if (!kurallar) {
      setDlg("kurallar"); // kurallar penceresi açılır — Kabul Ediyorum deyip tekrar Bağlan
      return;
    }
    setBusy(true);
    const e = await login(nick.trim(), pass, "login");
    setBusy(false);
    if (e) {
      const girisHatasi = /nick|şifre|sifre|hatalı|hatali/i.test(e);
      setErr(
        girisHatasi
          ? `${e} — Bilgilerinizi kontrol edin; üye değilseniz "Üye Ol" ile ücretsiz üyelik açabilirsiniz.`
          : e
      );
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
    setErr("Misafir giriş şu anda yapılamıyor, lütfen Üye Ol ile kayıt deneyin.");
  };

  const uyeOl = async () => {
    if (busy) return;
    setErr("");
    if (uNick.trim().length < 3) return setErr("Nick en az 3 karakter olmalı.");
    if (uPass.length < 4) return setErr("Şifre en az 4 karakter olmalı.");
    setBusy(true);
    const e = await login(uNick.trim(), uPass, "register", cinsiyet, uEmail.trim(), uCountry.trim(), uCity.trim());
    setBusy(false);
    if (e) {
      // Yaygın sunucu hatalarını anlaşılır Türkçeye çevir
      if (/alınmış|alinmis/i.test(e))
        setErr("Bu nick zaten kayıtlı! Bu pencereyi kapatıp ana ekrandan BAĞLAN ile giriş yapmayı deneyin.");
      else if (/ulaşılamıyor|ulasilamiyor|ağ hatası/i.test(e))
        setErr(`${e} — İnternet bağlantınızı kontrol edin ya da ana ekrandaki Misafir Giriş ile şifresiz deneyin.`);
      else setErr(e);
    } else setDlg(null);
  };

  const googleGiris = async () => {
    if (busy) return;
    setBusy(true);
    const e = await login(gNick.trim(), gPass, "register", "e", `${gNick.trim().toLowerCase()}@google.hasokey.com.tr`, "Türkiye", "İstanbul");
    setBusy(false);
    if (e) setErr(e);
    else setDlg(null);
  };

  const sifreSifirla = () => {
    if (sNick.trim().length < 3) return setSSonuc("Geçerli bir nick yazın.");
    setSSonuc(`"${sNick.trim()}" için şifre sıfırlama isteği yetkililere iletildi. Salon yetkililerine başvurabilirsiniz.`);
  };

  const arkadasBul = async () => {
    if (aNick.trim().length < 3) return setASonuc("Geçerli bir nick yazın.");
    try {
      const r = await api.members();
      const found = r.members.find((m) => m.nick.toLowerCase() === aNick.trim().toLowerCase());
      if (found) setASonuc(`🎉 ${found.nick} şu anda sistemde aktif! Ana Salon'dan bulabilirsiniz.`);
      else setASonuc(`"${aNick.trim()}" şu anda sistemde görünmüyor.`);
    } catch {
      setASonuc("Arama için önce sisteme bağlanmalısınız.");
    }
  };

  /** Canlı bağlantı testi — her API adresini ayrı ayrı dener (Bağlanamıyorum penceresi) */
  const baglantiTesti = async () => {
    if (testBusy) return;
    setTestBusy(true);
    setTestSonuc(null);
    const adresler: [string, string][] = [
      ["Kendi sunucumuz (hasokey.com.tr)", "https://hasokey.com.tr/api/public/top10"],
      ["Program içi yedek yol", `${window.location.origin}/api/public/top10`],
      ["Youbase (eski birincil)", "https://staging--4hv6t9m7l6i0u0zohoqq.youbase.cloud/api/public/top10"],
    ];
    const out: { ad: string; ok: boolean; not: string }[] = [];
    const to =
      typeof AbortSignal !== "undefined" && typeof (AbortSignal as { timeout?: unknown }).timeout === "function"
        ? AbortSignal.timeout(10000)
        : undefined;
    for (const [ad, url] of adresler) {
      const t0 = performance.now();
      try {
        const r = await fetch(url, { signal: to });
        const ms = Math.round(performance.now() - t0);
        out.push(
          r.ok
            ? { ad, ok: true, not: `✓ Çalışıyor (${ms} ms)` }
            : { ad, ok: false, not: `✗ Sunucu yanıt verdi: Hata ${r.status}` }
        );
      } catch (e2) {
        out.push({ ad, ok: false, not: `✗ Bağlanılamadı${e2 instanceof Error && e2.message ? ` (${e2.message})` : ""}` });
      }
    }
    setTestSonuc(out);
    setTestBusy(false);
  };

  const katGit = (k: number) => {
    if (!me) {
      setErr("Katlara girmek için önce Bağlan düğmesiyle giriş yapın.");
      return;
    }
    go({ name: "lobi", floor: k });
  };

  const BlueLink = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="text-[#0645ad] hover:text-[#d13c1d] underline decoration-dotted">
      {children}
    </button>
  );

  return (
    <div
      className="relative h-full overflow-auto"
      style={{ fontFamily: "Tahoma, Verdana, sans-serif", background: "#d4d0c8" }}
    >
      {/* Telif beyanı */}
      <div className="bg-white text-center py-[2px] px-1">
        <span className="text-[9px] font-bold text-[#c00]">
          T.C. Kültür ve Turizm Bakanlığı Telif Hakları Genel Müdürlüğü Kayıt Tescil Numarası: IEE-29-39052007
        </span>
      </div>

      {/* ÇİFTOKEY afişi */}
      <div className="flex h-[78px] border-y border-[#9a9a9a]">
        <div className="w-[136px] bg-gradient-to-b from-[#e01b1b] to-[#9c0f0f] text-white flex flex-col items-center justify-center leading-tight">
          <span className="text-[15px] font-black tracking-wide drop-shadow">OKEY</span>
          <span className="text-[13px] font-black">34, 51, 101</span>
          <span className="text-[11px] font-bold">BANKO, KASTET</span>
        </div>
        <div
          className="flex-1 relative flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(180deg,#8fc4ee 0%,#4a90d9 45%,#2f6fc4 100%)" }}
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1 rotate-[-8deg]">
            <OkeyTile n={1} />
            <OkeyTile n={1} />
          </div>
          <span
            className="text-[20px] font-black text-white leading-none"
            style={{ textShadow: "0 2px 0 #17406e, 0 0 6px rgba(0,0,0,.35)" }}
          >
            hasokey.com.tr
          </span>
          <span className="text-[13px] font-bold text-white mt-[2px]" style={{ textShadow: "0 1px 0 #17406e" }}>
            Oyun Salonu
          </span>
          <span className="text-[8px] text-[#ffe95c] mt-[3px]">www.hasokey.com.tr&nbsp;&nbsp;&nbsp;101 · Okey · Domino</span>
        </div>
        <div className="w-[136px] bg-gradient-to-b from-[#e01b1b] to-[#9c0f0f] text-white flex flex-col items-center justify-center leading-tight">
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
        {KATLAR.slice(0, 3).map((k) => (
          <KatBtn key={k} label={`${k}. Kat`} onClick={() => katGit(k)} />
        ))}
        <div className="flex items-center gap-1 px-1.5 bg-gradient-to-b from-[#dff0ff] to-[#b7d8f5] border border-[#7aa5cc] rounded-[3px]">
          <span className="text-[9px] font-black text-[#c00]">30—</span>
          <span className="text-[9px] font-black text-[#04c]">✕9</span>
          <span className="text-[10px] font-black text-[#c00]">HOŞ GELDİNİZ</span>
          <span className="text-[9px] font-black text-[#04c]">✕9</span>
        </div>
        {KATLAR.slice(3).map((k) => (
          <KatBtn key={k} label={`${k}. Kat`} onClick={() => katGit(k)} />
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
              onClick={() => {
                if (!me) return setErr("Canlı destek için önce bağlanın.");
                go({ name: "sohbet", room: "yardim" });
              }}
            >
              Canlı Destek
            </button>
          </div>
          <button className="border border-[#7f9db9] bg-white pt-1 pb-[2px] flex flex-col items-center gap-[2px] hover:bg-[#f0f6fd]" onClick={misafirGiris}>
            <span className="leading-none"><WinIcon name="key" size={26} /></span>
            <span className="text-[10px] font-bold text-[#333]">Misafir Giriş</span>
          </button>
        </div>

        {/* Sağ: form */}
        <div className="flex-1 min-w-0 text-[11px]">
          <div className="flex items-center gap-1 mb-[5px]">
            <span className="w-[42px] text-right font-bold">Nick:</span>
            <ClassicInput value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} className="w-[150px]" placeholder="nick" />
            <ClassicCheck checked={beniHatirla} onChange={setBeniHatirla} label="Beni Hatırla" />
            <ClassicCheck
              checked={robot}
              onChange={setRobot}
              label={
                <span className="inline-flex items-center gap-[3px]">
                  Robot{" "}
                  <span className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-[2px] bg-[#4285f4] text-[8px] text-white font-black">
                    r
                  </span>
                </span>
              }
            />
          </div>
          <div className="flex items-center gap-1 mb-[5px]">
            <span className="w-[42px] text-right font-bold">Şifre:</span>
            <ClassicInput type="password" value={pass} onChange={(e) => setPass(e.target.value)} maxLength={30} className="w-[150px]" placeholder="••••••" onKeyDown={(e) => e.key === "Enter" && void baglan()} />
            <ClassicCheck
              checked={!radioOn}
              onChange={(v) => {
                setRadio(!v);
                if (v) radyoDurdurBtn();
                else if (radyoUrl.trim()) radyoCal();
              }}
              label="Radyoyu Kapat"
            />
          </div>
          <div className="flex items-center gap-1 mb-[6px] pl-[46px]">
            <ClassicCheck
              checked={kurallar}
              onChange={setKurallar}
              label={<span className="font-bold text-[#b00] underline decoration-dotted" title="Kuralları okumak için tıklayın">Kuralları Kabul Ediyorum</span>}
            />
            <button className="text-[9px] text-[#0645ad] underline decoration-dotted" onClick={() => setDlg("kurallar")}>
              (kurallar)
            </button>
          </div>
          <div className="flex items-center gap-[5px] flex-wrap">
            <ClassicBtn onClick={() => void baglan()} disabled={busy}>
              {busy ? "Bağlanıyor…" : "Bağlan"}
            </ClassicBtn>
            <ClassicBtn onClick={() => { setDlg("uyeol"); setErr(""); }}>Üye Ol</ClassicBtn>
            <ClassicBtn onClick={() => setInfo("Anahtar: Şifre yardımı için aşağıdaki 'Şifremi Unuttum' bağlantısını kullanın.")}>
              <WinIcon name="key" size={13} />
            </ClassicBtn>
            <button
              className="px-2 h-[21px] text-[11px] font-bold bg-white active:translate-y-px flex items-center gap-1"
              style={{ boxShadow: "inset -1px -1px 0 #808080, inset 1px 1px 0 #fff, inset -2px -2px 0 #dfdfdf, inset 2px 2px 0 #404040" }}
              onClick={() => { setDlg("google"); setErr(""); }}
            >
              <svg viewBox="0 0 48 48" className="w-[13px] h-[13px]">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.4-10.1 7.4-17.6z" />
                <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6.1C.9 17 0 20.4 0 24s.9 7 2.6 10.4l7.8-5.7z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.9l-7.8 5.7C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Google ile Bağlayın
            </button>
          </div>
          {(err || info) && (
            <p className={`mt-[6px] text-[10px] font-bold ${err ? "text-[#c00]" : "text-[#070]"}`}>{err || info}</p>
          )}
          {err && /ulaşılamıyor|ulasilamiyor|sunucu|bağlan/i.test(err) && (
            <p className="mt-[3px] text-[10px] font-bold text-[#0645ad]">
              👉 Sorun bağlantıysa: sağdaki "Misafir Giriş" ile şifresiz deneyin veya "Bağlanamıyorum" penceresinden Test Et ile kontrol edin.
            </p>
          )}
          <p className="mt-[6px] text-[10px] text-[#c00] font-bold">
            Üye bilgilerinizi yazıp bağlan düğmesini tıklayın
          </p>
        </div>
      </div>

      {/* GERÇEK RADYO kutusu — URL girince mp3/aac/stream gerçekten çalar */}
      <div className="flex items-center gap-1 px-2 py-[3px] bg-[#222] border-t border-[#000] flex-wrap">
        <span className="text-[10px] font-bold text-[#ffcf3f]">📻 Radyo:</span>
        <ClassicInput
          value={radyoUrl}
          onChange={(e) => setRadyoUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && radyoCal()}
          placeholder="Radyo URL (mp3/aac/stream)"
          className="flex-1 min-w-[150px] h-[17px] text-[10px]"
        />
        <input
          value={radyoIstasyon}
          onChange={(e) => setRadyoIstasyon(e.target.value)}
          placeholder="istasyon adı"
          maxLength={20}
          className="w-[86px] bg-white text-[10px] px-1 h-[17px] outline-none"
          style={{ boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff" }}
        />
        <button
          onClick={radyoCalıyor ? radyoDurdurBtn : radyoCal}
          className={`px-2 h-[17px] text-[10px] font-bold text-white ${radyoCalıyor ? "bg-[#c02020]" : "bg-[#1d9b3e]"}`}
          title={radyoCalıyor ? "Durdur" : "Çal"}
        >
          {radyoCalıyor ? "■ Durdur" : "▶ Çal"}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={radyoSes}
          onChange={(e) => { const v = Number(e.target.value); setRadyoSes(v); radyoSesAyarla(v); }}
          className="w-[70px] h-[14px]"
          title={`Ses: %${radyoSes}`}
        />
        <span className={`w-2 h-2 rounded-full ${radyoCalıyor ? "bg-green-400 animate-pulse" : "bg-[#555]"}`} title={radyoCalıyor ? "Çalıyor" : "Kapalı"} />
      </div>

      {/* Hızlı bağlantılar */}
      <div className="flex items-center gap-2 px-2 py-[3px] bg-[#dce8f5] border-t border-[#a8b8c8] text-[10px] flex-wrap">
        <BlueLink onClick={() => (me ? go({ name: "lobi", floor: 1 }) : setErr("Önce bağlanın."))}>Ne Oynamak İsterseniz</BlueLink>
        <BlueLink onClick={() => (me ? go({ name: "lobi", floor: 1 }) : setErr("Önce bağlanın."))}>Salon Ara</BlueLink>
        <BlueLink onClick={() => (me ? go({ name: "lobi", floor: 2 }) : setErr("Önce bağlanın."))}>İllere Göre Salonlar</BlueLink>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-[#666] font-bold">Program v{__VK_SURUM__}</span>
          {typeof window !== "undefined" && window.vkElectron && (
            <BlueLink
              onClick={() => {
                void window.vkElectron?.openNick().then((r) => {
                  if (r && r.ok === false) setErr(r.error || "Daha fazla nick açılamaz.");
                });
              }}
            >
              ➕ Yeni Nick Aç
            </BlueLink>
          )}
          <BlueLink onClick={() => openWin({ name: "indir" })}>🤖 Android</BlueLink>
          <BlueLink onClick={() => openWin({ name: "indir" })}> iOS</BlueLink>
        </span>
      </div>

      {/* GOLD reklam bandı */}
      <button
        className="block w-full text-left border-y border-[#8aa4c0] bg-white px-2 py-1 hover:brightness-95"
        onClick={() => (me ? openWin({ name: "gold" }) : setErr("Gold üyelik için önce bağlanın."))}
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
        <BlueLink onClick={() => setDlg("sifre")}>Şifremi Unuttum/Nickimi Kaybettim</BlueLink>
        <BlueLink onClick={() => (me ? openWin({ name: "gold" }) : setErr("Önce bağlanın."))}>GOLD Üyelik</BlueLink>
        <BlueLink onClick={() => setDlg("arkadas")}>Arkadaşım Nerede</BlueLink>
        <BlueLink onClick={() => setDlg("uyeol")}>Üye Ol</BlueLink>
        <BlueLink onClick={() => setDlg("baglanamiyorum")}>Bağlanamıyorum</BlueLink>
      </div>

      {/* Alt bilgi */}
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

      {/* Durum şeridi */}
      <div className="flex items-center gap-2 px-2 h-[18px] bg-[#d4d0c8] border-t border-[#aca899]">
        <span className="text-[9px] text-[#333] flex-1 truncate">
          {busy
            ? "Sunucuya bağlanılıyor…"
            : me
            ? `🟢 ${me.nick} bağlandı — ${radyoCalıyor ? `Radyo: ▶ ${radyoIstasyon || "Çalıyor"}` : "Radyo: 🔇 Kapalı"}` : `📻 Radyo: ${radyoCalıyor ? `▶ ${radyoIstasyon || "Çalıyor"}` : "Kapalı"} — Bağlantı bekleniyor…`}
        </span>
      </div>

      {/* Pencere içi diyaloglar */}
      {dlg === "uyeol" && (
        <KlasikDlg title="Üye Ol — Yeni Üyelik" onClose={() => setDlg(null)}>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Nick:</span>
              <ClassicInput value={uNick} onChange={(e) => setUNick(e.target.value)} maxLength={20} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Şifre:</span>
              <ClassicInput type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} maxLength={30} className="flex-1" />
            </div>
            <div className="flex items-center gap-3 pl-[60px]">
              <ClassicCheck checked={cinsiyet === "e"} onChange={() => setCinsiyet("e")} label="Bay" />
              <ClassicCheck checked={cinsiyet === "k"} onChange={() => setCinsiyet("k")} label="Bayan" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">E-posta:</span>
              <ClassicInput type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} maxLength={80} placeholder="zorunlu" className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Ülke:</span>
              <ClassicInput value={uCountry} onChange={(e) => setUCountry(e.target.value)} maxLength={60} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Şehir:</span>
              <ClassicInput value={uCity} onChange={(e) => setUCity(e.target.value)} maxLength={60} placeholder="zorunlu" className="flex-1" />
            </div>
            {err && <p className="text-[10px] font-bold text-[#c00]">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <ClassicBtn onClick={() => void uyeOl()} disabled={busy}>
                {busy ? "Kaydediliyor…" : "Üyeliği Tamamla"}
              </ClassicBtn>
              <ClassicBtn onClick={() => setDlg(null)}>Vazgeç</ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}

      {dlg === "google" && (
        <KlasikDlg title="Google ile Bağlan" onClose={() => setDlg(null)}>
          <div className="space-y-2 text-[11px]">
            <p>
              Tarayıcınızda Google oturumu simüle edilir. Aşağıdaki kimlikle üye olarak giriş
              yapılır:
            </p>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Nick:</span>
              <ClassicInput value={gNick} onChange={(e) => setGNick(e.target.value)} maxLength={20} className="flex-1" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <ClassicBtn onClick={() => void googleGiris()} disabled={busy}>
                {busy ? "Bağlanıyor…" : "Google ile Bağlan"}
              </ClassicBtn>
              <ClassicBtn onClick={() => setDlg(null)}>Vazgeç</ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}

      {dlg === "sifre" && (
        <KlasikDlg title="Şifremi Unuttum / Nickimi Kaybettim" onClose={() => setDlg(null)}>
          <div className="space-y-2 text-[11px]">
            <p>Kayıtlı nick'inizi yazın, şifre yenileme yardımı yapılsın:</p>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Nick:</span>
              <ClassicInput value={sNick} onChange={(e) => setSNick(e.target.value)} maxLength={20} className="flex-1" />
            </div>
            {sSonuc && <p className="text-[10px] font-bold text-[#0645ad]">{sSonuc}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <ClassicBtn onClick={sifreSifirla}>Gönder</ClassicBtn>
              <ClassicBtn onClick={() => setDlg(null)}>Kapat</ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}

      {dlg === "arkadas" && (
        <KlasikDlg title="Arkadaşım Nerede" onClose={() => setDlg(null)}>
          <div className="space-y-2 text-[11px]">
            <p>Arkadaşınızın nick'ini yazın, sistemde olup olmadığını sorgulayın:</p>
            <div className="flex items-center gap-2">
              <span className="w-[52px] font-bold">Nick:</span>
              <ClassicInput value={aNick} onChange={(e) => setANick(e.target.value)} maxLength={20} className="flex-1" />
            </div>
            {aSonuc && <p className="text-[10px] font-bold text-[#070]">{aSonuc}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <ClassicBtn onClick={() => void arkadasBul()}>Ara</ClassicBtn>
              <ClassicBtn onClick={() => setDlg(null)}>Kapat</ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}

      {dlg === "kurallar" && (
        <KlasikDlg title="Salon Kuralları" onClose={() => setDlg(null)}>
          <div className="text-[11px] space-y-1 max-h-[220px] overflow-auto pr-1">
            <p>1. Hakaret, küfür ve ayrımcılık yasaktır.</p>
            <p>2. Reklam, spam ve zincir mesaj göndermek yasaktır.</p>
            <p>3. Hesap paylaşımı ve sahte üyelik ban sebebidir.</p>
            <p>4. Oyun bozma (intentional disconnect) cezalıdır.</p>
            <p>5. Yetkililerin uyarıları bağlayıcıdır.</p>
            <p>6. 18 yaş altı üyeler için veli onayı önerilir.</p>
            <p className="font-bold text-[#c00] pt-1">
              Kuralları kabul ederek sisteme bağlanabilirsiniz.
            </p>
            <div className="flex justify-end pt-2">
              <ClassicBtn
                onClick={() => {
                  setKurallar(true);
                  setDlg(null);
                }}
              >
                Kabul Ediyorum
              </ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}

      {dlg === "baglanamiyorum" && (
        <KlasikDlg title="Bağlanamıyorum — Bağlantı Testi" onClose={() => setDlg(null)}>
          <div className="text-[11px] space-y-1 max-h-[240px] overflow-auto">
            <p className="font-bold">Sunuculara canlı bağlantı testi:</p>
            {!testSonuc && !testBusy && (
              <p className="text-[10px] text-[#555]">Testi başlatmak için "Test Et" düğmesine basın.</p>
            )}
            {testBusy && <p className="text-[10px] font-bold text-[#0645ad]">Test ediliyor… lütfen bekleyin</p>}
            {testSonuc && (
              <div className="space-y-[3px]">
                {testSonuc.map((t) => (
                  <p key={t.ad} className={`text-[10px] font-bold ${t.ok ? "text-[#070]" : "text-[#c00]"}`}>
                    <b>{t.ad}</b>: {t.not}
                  </p>
                ))}
                {testSonuc.some((t) => t.ok) ? (
                  <p className="text-[10px] text-[#070]">
                    ✓ En az bir sunucu çalışıyor — giriş yapılabilir. Nick/şifrenizi kontrol edip tekrar deneyin.
                  </p>
                ) : (
                  <p className="text-[10px] text-[#c00]">✗ Hiçbir sunucuya ulaşılamadı — internet/VPN/güvenlik duvarı kontrolü yapın.</p>
                )}
              </div>
            )}
            <p className="text-[10px] text-[#555] pt-1">Program sürümü: v{__VK_SURUM__}</p>
            <div className="flex justify-end gap-2 pt-2">
              <ClassicBtn onClick={() => void baglantiTesti()} disabled={testBusy}>
                {testBusy ? "Test ediliyor…" : "Test Et"}
              </ClassicBtn>
              <ClassicBtn onClick={() => setDlg(null)}>Kapat</ClassicBtn>
            </div>
          </div>
        </KlasikDlg>
      )}
    </div>
  );
}

function KatBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-[6px] text-[10px] font-bold text-[#222] bg-gradient-to-b from-white to-[#d8d4c8] border border-[#aca899] rounded-[3px] hover:from-[#e8f2ff] hover:to-[#c4dcf2] active:translate-y-px whitespace-nowrap"
    >
      <span className="w-[7px] h-[7px] rounded-full bg-[#e33] shadow-[0_0_3px_#e33]" />
      {label}
    </button>
  );
}
