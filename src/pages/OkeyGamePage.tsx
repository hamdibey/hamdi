  return (
    <AutoFit width={1180} fitScreen className="okey-reference okey-mavi min-h-screen py-3 px-2" style={{ fontFamily: "Tahoma, Geneva, Verdana, sans-serif" }}>
      <div className="okey-reference-main max-w-[1500px] mx-auto bg-[#2450c4] border border-[#0f2a80] shadow-pop flex flex-col min-h-[92vh]">
        {/* Klasik siyah pencere başlığı (ÇİFT OKEY) */}
        <div className="flex items-center justify-between gap-2 px-2 py-1 bg-black text-white text-xs font-bold select-none border-b border-[#8b5a2b]">
          <span className="truncate">
            Has Okey [{activeTableId ?? "Pratik"}] [{me?.nick ?? "Sen"}]
          </span>
          <span className="whitespace-nowrap text-yellow-300">
            {st.roundOver ? "[ El Bitti ]" : myTurn ? "[ Sıra Sizde ]" : `[ Sıra: ${st.players[st.turn].name} ]`}
          </span>
          <span className="flex items-center gap-2 shrink-0 text-white/90">
            <span className="px-1 leading-4 cursor-default">—</span>
            <span className="px-1 leading-4 cursor-default">□</span>
            <button onClick={() => void masadanCik(() => useApp.getState().go({ name: "salon", game: mode }))} title="Masadan çık — pencereyi kapat" className="px-1.5 leading-4 hover:text-red-500">×</button>
          </span>
        </div>

        {/* ANA SATIR: hisin + lacivert menü şeridi */}
        <div className="flex flex-1 min-h-0 cq-row">
          {/* HİSİN */}
          <div className="okey-mavi flex-1 min-w-0 relative overflow-hidden border-[4px] border-double border-[#1e40a8]">
            {MASA_TINT[renkIdx] !== "rgba(0,0,0,0)" && (
              <div className="absolute inset-0 pointer-events-none" style={{ background: MASA_TINT[renkIdx] }} />
            )}
            {MASA_RESIM[resimIdx] && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[200px] leading-none opacity-[0.07] select-none">{MASA_RESIM[resimIdx]}</span>
              </div>
            )}
