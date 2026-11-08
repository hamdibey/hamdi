// ---------------------------------------------------------------------------
// Klasik Win98 tarzı PROMPT / CONFIRM diyalogları.
//
// ÖNEMLİ: Electron (masaüstü program) pencerelerinde window.prompt ve
// window.confirm ÇALIŞMAZ — sessizce null/False döner. Bu yüzden sağ tık
// menüsündeki "Radyo URL ekle", "Kredi Ver/Al", "Ban" gibi maddeler hiçbir
// şey açmıyordu. Bu modül DOM'a klasik pencere çizer ve Promise ile sonucu
// döner; web ve programda aynı şekilde çalışır.
// ---------------------------------------------------------------------------

const Tahoma = "Tahoma, Geneva, Verdana, sans-serif";

function overlay(): HTMLDivElement {
  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;";
  return ov;
}

function klasikPencere(baslik: string): HTMLDivElement {
  const win = document.createElement("div");
  win.style.cssText =
    `background:#d4d0c8;font-family:${Tahoma};font-size:12px;color:#000;width:100%;max-width:380px;` +
    "border:1px solid;border-color:#dfdfdf #404040 #404040 #dfdfdf;box-shadow:3px 4px 14px rgba(0,0,0,.5);";
  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;padding:2px 4px;color:#fff;font-weight:bold;" +
    "background:linear-gradient(#0a246a,#3a6ea5);";
  const t = document.createElement("span");
  t.textContent = baslik;
  bar.appendChild(t);
  win.appendChild(bar);
  return win;
}

const btnCls =
  "min-w-[76px] padding:4px 12px;background:#d4d0c8;color:#000;font-weight:bold;border:1px solid;" +
  "border-color:#fff #404040 #404040 #fff;cursor:pointer;";

function btn(text: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.cssText = btnCls.replace("padding:4px 12px;", "padding:4px 12px;");
  b.onmousedown = () => {
    b.style.borderColor = "#404040 #fff #fff #404040";
  };
  b.onmouseup = () => {
    b.style.borderColor = "#fff #404040 #404040 #fff";
  };
  return b;
}

/** Klasik prompt — Electron'da da çalışan window.prompt alternatifi. */
export function klasikPrompt(
  soru: string,
  varsayilan = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    const ov = overlay();
    const win = klasikPencere("Giriş");
    const body = document.createElement("div");
    body.style.cssText = "padding:10px;display:flex;flex-direction:column;gap:8px;";
    const q = document.createElement("p");
    q.style.cssText = "margin:0;white-space:pre-wrap;";
    q.textContent = soru;
    const input = document.createElement("input");
    input.value = varsayilan;
    input.style.cssText =
      "background:#fff;border:1px solid;border-color:#404040 #fff #fff #404040;padding:4px 6px;font-family:" +
      Tahoma + ";font-size:12px;outline:none;";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const ok = btn("Tamam");
    const cancel = btn("İptal");
    row.append(ok, cancel);
    body.append(q, input, row);
    win.appendChild(body);
    ov.appendChild(win);
    document.body.appendChild(ov);

    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      ov.remove();
      resolve(v);
    };
    ok.onclick = () => finish(input.value);
    cancel.onclick = () => finish(null);
    ov.onmousedown = (e) => {
      if (e.target === ov) finish(null);
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") finish(input.value);
      if (e.key === "Escape") finish(null);
      e.stopPropagation();
    };
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

/** Klasik onay kutusu — Electron'da çalışan window.confirm alternatifi. */
export function klasikConfirm(soru: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ov = overlay();
    const win = klasikPencere("Onay");
    const body = document.createElement("div");
    body.style.cssText = "padding:10px;display:flex;flex-direction:column;gap:10px;";
    const q = document.createElement("p");
    q.style.cssText = "margin:0;white-space:pre-wrap;";
    q.textContent = soru;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const yes = btn("Evet");
    const no = btn("Hayır");
    row.append(yes, no);
    body.append(q, row);
    win.appendChild(body);
    ov.appendChild(win);
    document.body.appendChild(ov);

    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      ov.remove();
      resolve(v);
    };
    yes.onclick = () => finish(true);
    no.onclick = () => finish(false);
    ov.onmousedown = (e) => {
      if (e.target === ov) finish(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish(false);
        window.removeEventListener("keydown", onKey, true);
      }
    };
    window.addEventListener("keydown", onKey, true);
  });
}
