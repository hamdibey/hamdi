import { useApp } from "../store/useApp";
import { ChatPanel } from "../components/ChatPanel";
import { RankBadge } from "../components/RankBadge";
import { can } from "../lib/ranks";

/**
 * Sohbet salonları: Yardım (herkese açık) ve Yöneticiler (yetkili+).
 * Oyun masası içermez — sadece sohbet + çevrimiçi liste.
 */
export function ChatSalonPage({ room }: { room: "yardim" | "yoneticiler" }) {
  const me = useApp((s) => s.me);
  const staffOnly = room === "yoneticiler";

  if (!me || (staffOnly && !can(me.rank, "mute"))) {
    return (
      <div className="felt-bg min-h-screen flex items-center justify-center p-4">
        <div className="bg-wood-950/90 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <h2 className="font-display text-2xl font-bold text-red-400 mb-2">Yetkiniz Yok</h2>
          <p className="text-sm text-ivory-dark/70">
            Bu salon yalnızca <b className="text-ivory">Site Yetkilisi</b> ve üzeri kademedeki
            üyelere açıktır. Mevcut kademeniz: <RankBadge rank={me?.rank ?? "deneme"} />
          </p>
        </div>
      </div>
    );
  }

  const info =
    room === "yardim"
      ? {
          title: "Yardım Salonu",
          desc: "Siteyle ilgili sorularınızı buraya yazın; yetkililer yanıtlıyor. Her üye girebilir.",
        }
      : {
          title: "Yöneticiler Salonu",
          desc: "Yetkililerin özel toplantı salonu. Site Yetkilisi ve üzeri yazabilir.",
        };

  return (
    <div className="felt-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <main className="flex-1 min-w-0">
          <h2 className="font-display text-3xl font-bold text-gold-400 mb-1">{info.title}</h2>
          <p className="text-sm text-ivory-dark/70 mb-5">{info.desc}</p>

          <div className="bg-wood-950/70 border border-wood-800 rounded-xl p-4 text-sm text-ivory-dark/80 leading-relaxed space-y-2">
            <p className="text-xs font-bold text-gold-500 uppercase tracking-wider">Sohbet Kuralları</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Küfür, hakaret ve reklam yasaktır.</li>
              <li>Yetkililerin uyarılarını dikkate alın.</li>
              <li>Uygunsuz davranış <b className="text-ivory">susturma</b> ve{" "}
                <b className="text-red-300">ban</b> ile sonuçlanır.</li>
            </ul>
            <p className="text-xs text-ivory-dark/50">
              İpucu: Yetkiliyseniz sohbette bir üye nick'ine{" "}
              <b className="text-gold-400">sağ tıklayarak</b> tüm işlem menüsünü açabilirsiniz.
            </p>
          </div>
        </main>

        <ChatPanel room={room} />
      </div>
    </div>
  );
}
