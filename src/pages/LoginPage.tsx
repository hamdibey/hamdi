import { useState } from "react";
import { useApp } from "../store/useApp";
import { RANKS } from "../lib/ranks";
import { RobotDogrulama } from "../components/RobotDogrulama";

export function LoginPage() {
  const login = useApp((s) => s.login);
  const go = useApp((s) => s.go);
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [gender, setGender] = useState<"e" | "k">("e");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [robotOk, setRobotOk] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr("");
    if (nick.trim().length < 3) {
      setErr("Nick en az 3 karakter olmalı.");
      return;
    }
    if (password.length < 4) {
      setErr("Şifre en az 4 karakter olmalı.");
      return;
    }
    if (mode === "register") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        setErr("Geçerli bir e-posta adresi girin (zorunlu).");
        return;
      }
      if (country.trim().length < 2) {
        setErr("Ülke zorunludur.");
        return;
      }
      if (city.trim().length < 2) {
        setErr("Şehir zorunludur.");
        return;
      }
      if (!robotOk) {
        setErr("Robot doğrulamasını tamamlayın — sorunun cevabını yazın.");
        return;
      }
    }
    setBusy(true);
    const error = await login(nick, password, mode, gender, email, country, city);
    setBusy(false);
    if (error) setErr(error);
  };

  return (
    <div className="felt-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-floatUp">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl font-bold text-gold-400 drop-shadow-lg">
            hasokey.com.tr<span className="text-ivory-dark/70">.store</span>
          </h1>
          <p className="mt-2 text-ivory-dark/70">
            101 · Okey · Domino — online oyun ve eğlence portalı
          </p>
        </div>

        <div className="bg-wood-950/90 border border-wood-700 rounded-2xl p-6 shadow-pop">
          <div className="flex gap-2 mb-4">
            {(
              [
                ["login", "Giriş Yap"],
                ["register", "Yeni Üyelik"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErr("");
                }}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                  mode === m
                    ? "bg-gold-600 text-wood-950"
                    : "bg-wood-900 text-ivory-dark/70 hover:text-ivory border border-wood-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-gold-300 mb-2">
            Nickiniz
          </label>
          <input
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={20}
            autoFocus
            placeholder="Örn: Okeyci63"
            className="w-full bg-wood-900 border border-wood-700 rounded-xl px-4 py-3 text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600 text-lg"
          />

          <label className="block text-sm font-semibold text-gold-300 mb-2 mt-4">
            Şifreniz
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={40}
            placeholder={mode === "register" ? "En az 4 karakter" : "Şifreniz"}
            className="w-full bg-wood-900 border border-wood-700 rounded-xl px-4 py-3 text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600 text-lg"
          />

          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

          {mode === "register" && (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gold-300 mb-2">Cinsiyetiniz</label>
              <div className="flex gap-2">
                {(
                  [
                    ["e", "♂ Bay"],
                    ["k", "♀ Bayan"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setGender(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      gender === v
                        ? "bg-gold-600 text-wood-950 border-gold-500"
                        : "bg-wood-900 text-ivory-dark/70 border-wood-700 hover:text-ivory"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-semibold text-gold-300 mb-2 mt-4">
                E-posta <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={80}
                placeholder="ornek@eposta.com"
                className="w-full bg-wood-900 border border-wood-700 rounded-xl px-4 py-3 text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600"
              />

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-gold-300 mb-2">
                    Ülke <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setErr("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    maxLength={60}
                    placeholder="Türkiye"
                    className="w-full bg-wood-900 border border-wood-700 rounded-xl px-4 py-3 text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gold-300 mb-2">
                    Şehir <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setErr("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    maxLength={60}
                    placeholder="İstanbul"
                    className="w-full bg-wood-900 border border-wood-700 rounded-xl px-4 py-3 text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600"
                  />
                </div>
              </div>

              {/* 🛡 Robot doğrulama — kayıt gönderilmeden geçilmeli */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gold-300 mb-2">
                  Robot Doğrulaması <span className="text-red-400">*</span>
                </label>
                <RobotDogrulama tema="gold" onDogrulama={setRobotOk} />
              </div>
            </div>
          )}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 w-full py-3 rounded-xl bg-gold-600 hover:bg-gold-500 disabled:opacity-60 text-wood-950 font-bold text-lg transition-colors shadow-tile"
          >
            {busy
              ? "Bağlanıyor..."
              : mode === "register"
                ? "Kayıt Ol"
                : "Giriş Yap"}
          </button>
          <p className="mt-3 text-xs text-ivory-dark/50 text-center">
            {mode === "register" ? (
              <>
                Yeni üyeler <b className="text-ivory-dark/80">Normal Üye</b> olarak
                kaydedilir; <b className="text-ivory-dark/80">ilk üye</b> otomatik
                admin olur.
              </>
            ) : (
              <>
                Hesabınız yoksa <b className="text-ivory-dark/80">Yeni Üyelik</b>{" "}
                sekmesinden kayıt olun. Üyeler kalıcıdır.
              </>
            )}
          </p>
        </div>

        {/* Video girişindeki gibi kayan reklam / duyuru bandı + promo düğmeleri */}
        <div className="mt-6 rounded-xl overflow-hidden border border-wood-800">
          <div className="bg-black overflow-hidden whitespace-nowrap py-1 leading-[18px]">
            <span className="vk-marquee text-[#ff3333] font-bold text-xs">
              ★ Hoş geldiniz! ★ Anında gold üyelik: Gold Üyelik düğmesiyle 1000 çipe gold üye olun ★ Android uygulamamız Google Play'de — ⬇ Oyunu İndir ★ Salon 30 ödüllü turnuvamız başlamıştır ★★★
            </span>
          </div>
          <div className="flex flex-wrap gap-2 bg-wood-950/80 p-3">
            <button
              onClick={() => go({ name: "indir" })}
              className="flex-1 min-w-[160px] py-2 rounded-lg bg-green-900/50 border border-green-600/50 text-green-300 text-xs font-bold hover:bg-green-900 transition-colors"
            >
              📱 Google Play — Uygulamayı İndir
            </button>
            <button
              onClick={() => go({ name: "gold" })}
              className="flex-1 min-w-[160px] py-2 rounded-lg bg-yellow-900/40 border border-yellow-600/50 text-yellow-300 text-xs font-bold hover:bg-yellow-900/60 transition-colors"
            >
              ⭐ Gold Üyelik — Anında Aktif
            </button>
          </div>
        </div>

        <div className="mt-6 bg-wood-950/60 border border-wood-800 rounded-xl p-4">
          <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-2">
            Yetki Kademesi
          </p>
          <ol className="text-xs text-ivory-dark/80 space-y-1 list-decimal list-inside">
            {RANKS.map((r) => (
              <li key={r.id}>
                <b>{r.label}</b> — {r.desc}
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={() => go({ name: "masaustu" })}
          className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-sky-800 to-blue-900 hover:from-sky-700 hover:to-blue-800 border-2 border-sky-500/60 text-white font-bold text-sm transition-colors shadow-tile"
        >
          🖥️ Windows Masaüstü Sürümü — Klasik Bağlantı Penceresi
        </button>

        <button
          onClick={() => go({ name: "indir" })}
          className="mt-4 w-full py-3 rounded-xl bg-wood-900 hover:bg-wood-800 border-2 border-gold-700/60 text-gold-300 hover:text-gold-200 font-bold text-sm transition-colors shadow-tile"
        >
          ⬇ Oyunu İndir — Windows · Android · iPad / iPhone
        </button>
      </div>
    </div>
  );
}
