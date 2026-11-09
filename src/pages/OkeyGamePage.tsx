          <div className="okey-reference-right w-28 shrink-0 okey-mavi border-l-2 border-[#1e40a8] flex flex-col items-center py-2 gap-0.5 text-yellow-300 text-[13px] font-bold select-none">
            <div className="mb-1 w-full px-1 text-center border-b border-white/25 pb-1">
              <p className="text-[7px] text-white mb-0.5 font-bold">www.hasokey.com.tr</p>
              <img src="icon-512.png" alt="Has Okey" className="w-full h-14 object-cover border border-white/60 shadow-pop" />
              <div className="flex flex-col items-center leading-none mt-1">
                <span className="text-[10px]">👑</span>
                <span className="hk-logo-text text-[12px] mt-0.5">Has Okey</span>
              </div>
              <p className="text-[7px] text-white mt-1 leading-tight font-bold">
                ONLINE 101 OKEY OYUN SALONU
              </p>
            </div>
            {([
              ["Başlat", () => { if (!isTableOwner) { showToast(`Bu masayı ${tableOwner ?? "başkası"} kurdu — eli yalnız o başlatabilir.`); return; } newRoundClick(); aiSay("Yeni el başlatıldı, herkes hazır olsun."); }],
              ["Devam", () => { if (!isTableOwner) { showToast(`Eli yalnız masa sahibi (${tableOwner ?? "—"}) başlatır.`); return; } if (st.roundOver) { newRoundClick(); aiSay("Yeni el başlatıldı, oyuna kaldığımız yerden devam."); } }],
              ["Davet", () => { void (async () => { const nick = await klasikPrompt("Davet edilecek üye nick'i:"); if (!nick || !nick.trim()) return; aiSay(`${me?.nick ?? "Sen"} seni masaya davet etti.`, nick.trim()); })(); }],
              ["Mola", () => setMola((v) => { const nv = !v; aiSay(nv ? "⏸ Mola ilan edildi." : "▶ Mola bitti, oyun devam."); return nv; })],
              ["Renk", () => { setRenkIdx((i) => (i + 1) % MASA_TINT.length); showToast("Masa rengi değiştirildi."); }],
              ["Resim", () => { setResimIdx((i) => (i + 1) % MASA_RESIM.length); showToast("Masa amblemi değiştirildi."); }],
              ["Yardım", () => setYardimAcik((v) => !v)],
            ] as [string, () => void][]).map(([label, fn]) => (
              <button key={label} onClick={fn} className="hover:text-white hover:underline py-0.5 w-full text-center">{label}</button>
            ))}
            {mola && <p className="mt-1 text-[9px] text-red-400 text-center">⏸ Mola</p>}
          </div>
