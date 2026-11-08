import { useState } from "react";

// ---------------------------------------------------------------------------
// Robot doğrulama — harici servis gerektirmeyen klasik matematik sorusu captcha.
// Üyelik formlarına eklenir; doğru cevaplanmadan kayıt gönderilemez.
// "Yenile" ile soru değişir, form her açılışta yeniden üretilir (key ile).
// ---------------------------------------------------------------------------

interface Soru {
  a: number;
  b: number;
  op: "+" | "−";
  cevap: number;
}

function soruUret(): Soru {
  const op: Soru["op"] = Math.random() < 0.5 ? "+" : "−";
  const a = 2 + Math.floor(Math.random() * 8); // 2..9
  const b = 1 + Math.floor(Math.random() * 9); // 1..9
  if (op === "−" && b > a) return { a: b, b: a, op, cevap: b - a };
  return { a, b, op, cevap: op === "+" ? a + b : a - b };
}

export function RobotDogrulama({
  tema = "klasik",
  onDogrulama,
}: {
  tema?: "klasik" | "gold";
  onDogrulama: (ok: boolean) => void;
}) {
  const [soru, setSoru] = useState<Soru>(soruUret);
  const [girdi, setGirdi] = useState("");

  const dogru = girdi.trim() !== "" && Number(girdi.trim()) === soru.cevap;

  const yaz = (v: string) => {
    setGirdi(v);
    const temiz = v.trim();
    onDogrulama(temiz !== "" && Number(temiz) === soru.cevap);
  };

  const yenile = () => {
    setSoru(soruUret());
    setGirdi("");
    onDogrulama(false);
  };

  const soruMetni = `${soru.a} ${soru.op} ${soru.b} = ?`;

  if (tema === "gold") {
    return (
      <div className="rounded-xl border border-wood-700 bg-black/30 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-3 py-2 rounded-lg bg-wood-900 border border-gold-700/60 font-mono text-[17px] tracking-wider text-gold-300 select-none"
            aria-label={`Robot doğrulama sorusu: ${soruMetni}`}
          >
            {soruMetni}
          </span>
          <input
            value={girdi}
            onChange={(e) => yaz(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            placeholder="?"
            aria-label="Robot doğrulama cevabı"
            className="w-16 text-center py-2 rounded-lg bg-wood-900 border border-wood-700 text-ivory text-lg font-bold focus:border-gold-600 outline-none"
          />
          <button
            type="button"
            onClick={yenile}
            className="text-xs font-bold text-ivory-dark/70 hover:text-gold-300 underline decoration-dotted"
          >
            ↻ Yenile
          </button>
          {dogru && <span className="text-xs font-bold text-green-400">✓ Doğrulandı</span>}
        </div>
        <p className="mt-2 text-[11px] text-ivory-dark/60">
          🤖 Robot musunuz? Sorunun cevabını yazarak doğrulayın.
        </p>
      </div>
    );
  }

  return (
    <div className="hk-in bg-[#efefef] p-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-[3px] bg-white hk-in text-[13px] font-black tracking-wider select-none"
          style={{ fontFamily: "'Courier New', monospace" }}
          aria-label={`Robot doğrulama sorusu: ${soruMetni}`}
        >
          {soruMetni}
        </span>
        <input
          value={girdi}
          onChange={(e) => yaz(e.target.value)}
          inputMode="numeric"
          maxLength={4}
          placeholder="?"
          aria-label="Robot doğrulama cevabı"
          className="w-[56px] px-1 h-[24px] bg-white hk-in outline-none text-center font-black text-[13px]"
        />
        <button type="button" onClick={yenile} className="hk-btn text-[11px]">
          ↻ Yenile
        </button>
        {dogru ? (
          <span className="text-[11px] font-black text-[#0a7a2f]">✓ Doğrulandı</span>
        ) : (
          <span className="text-[10px] hk-dim">Cevabı yazın — robot doğrulaması</span>
        )}
      </div>
    </div>
  );
}
