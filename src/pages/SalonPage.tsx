import { useEffect, useState } from "react";
import { useApp } from "../store/useApp";
import { ChatPanel } from "../components/ChatPanel";
import { SALONS } from "../lib/sunucu";
import type { GameId } from "../lib/types";
import { api, getToken, parsePlayers } from "../lib/api";
import type { ApiTable } from "../lib/api";
import { CreateTableModal } from "../components/CreateTableModal";
import type { TableSettings } from "../components/CreateTableModal";

export function SalonPage({ game }: { game: GameId }) {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const setTableGame = useApp((s) => s.setTableGame);
  const setActiveTable = useApp((s) => s.setActiveTable);
  const [dbTables, setDbTables] = useState<ApiTable[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Veritabanındaki gerçek (üye açtığı) masaları periyodik çek — bot masa yok
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await api.tables(game);
        if (!alive) return;
        setDbTables(r.tables.filter((t) => t.status === "open"));
      } catch {
        /* kısa süreli bağlantı hatası göz ardı edilir */
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 6000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [game]);

  const salon = SALONS.find((s) => s.id === game)!;

  const masaKur = () => {
    if (!salon.playable || !me) {
      showToast("Bu salon henüz açılmadı — yakında!");
      return;
    }
    setModalOpen(true);
  };
  const masaKurOnay = async (s: TableSettings) => {
    setModalOpen(false);
    if (!me) return;
    if (s.game === "otuzdort" || s.game === "ellibir") {
      go({ name: "oyunOnline", game: s.game });
      return;
    }
    try {
      const r = await api.createTable(game, s.game, {
        name: s.masaAdi,
        settings: {
          cezali: s.cezali, eglence: s.eglence, klasman: s.klasman,
          elSayisi: s.elSayisi, sohbet: s.sohbet, izleyici: s.izleyici, davet: s.davet,
        },
      }); // masa veritabanına yazılır
      setActiveTable(r.table.id);
    } catch (e) {
      showToast(
        e instanceof Error
          ? e.message
          : "Masa veritabanına yazılamadı, yine de oyun açılıyor."
      );
    }
    setTableGame(s.game);
    go({ name: "oyun", game: s.game });
  };

  return (
    <div className="felt-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <main className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <button
              onClick={() => go({ name: "lobi" })}
              className="text-sm text-ivory-dark/60 hover:text-gold-400 transition-colors"
            >
              ← Salonlar
            </button>
            <h2 className="font-display text-3xl font-bold text-gold-400">{salon.name} Salonu</h2>
            {!salon.playable && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-gold-700/30 text-gold-400 border border-gold-700">
                Yakında
              </span>
            )}
          </div>
          <p className="text-sm text-ivory-dark/60 mb-5">
            Masalar yalnızca üyeler tarafından açılır. Bir masaya oturun ya da kendi masanızı kurun.
          </p>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {dbTables.length === 0 && (
              <div className="sm:col-span-2 xl:col-span-4 bg-wood-950/80 border border-dashed border-wood-700 rounded-xl p-6 text-center text-ivory-dark/50 text-sm">
                Bu salonda açık masa yok — “＋ Masa Kur” ile masanızı açın.
              </div>
            )}
            {dbTables.map((dbT) => {
              const players = parsePlayers(dbT);
              const seats = players.length;
              const full = seats >= 4;
              const benOturdum = me ? players.some((p) => p.nick === me.nick) : false;
              return (
                <div
                  key={dbT.id}
                  className="bg-wood-950/80 border border-wood-700 rounded-xl p-4 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-lg font-bold text-ivory truncate">
                      {dbT.name || `Masa ${dbT.id}`}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        full
                          ? "bg-red-900/50 text-red-300"
                          : seats > 0
                          ? "bg-felt-700 text-emerald-300"
                          : "bg-wood-800 text-ivory-dark/50"
                      }`}
                    >
                      {seats}/4
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {Array.from({ length: 4 }, (_, k) => (
                      <div
                        key={k}
                        className={`h-7 rounded flex items-center justify-center text-[10px] font-bold truncate px-0.5 ${
                          k < seats
                            ? "bg-felt-600 text-emerald-200 border border-felt-500"
                            : "bg-wood-900 text-ivory-dark/30 border border-wood-800"
                        }`}
                        title={k < seats ? players[k].nick : "Boş koltuk"}
                      >
                        {k < seats ? players[k].nick : "—"}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gold-400 mb-2 truncate">
                    ★ {dbT.ownerNick} kurduğu masa
                  </p>
                  <button
                    disabled={full && !benOturdum}
                    onClick={async () => {
                      if (!salon.playable) {
                        showToast("Batak salonu yakında açılacak.");
                        return;
                      }
                      try {
                        const r = await api.joinTable(dbT.id); // masaya oturmayı DB'ye yaz
                        setActiveTable(r.table.id);
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : "Masaya oturulamadı.");
                        return;
                      }
                      setTableGame(game);
                      go({ name: "oyun", game });
                    }}
                    className={`mt-auto w-full py-2 rounded-lg text-sm font-bold transition-colors ${
                      full && !benOturdum
                        ? "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                        : "bg-gold-600 hover:bg-gold-500 text-wood-950"
                    }`}
                  >
                    {full && !benOturdum ? "Dolu" : "Otur"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={masaKur}
              disabled={!salon.playable}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-tile ${
                salon.playable
                  ? "bg-emerald-700 hover:bg-emerald-600 text-ivory hover:-translate-y-0.5"
                  : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
              }`}
            >
              ＋ Masa Kur
            </button>
            <p className="text-xs text-ivory-dark/50 max-w-sm">
              Masanızı kurunca hemen oynamaya başlarsınız; diğer üyeler masaya katılabilir.
            </p>
          </div>
        </main>

        <ChatPanel room={`salon:${game}`} />
      </div>

      {/* Klasik masa kurma penceresi (Ayarlar) */}
      {modalOpen && (
        <CreateTableModal
          defaultGame={game}
          defaultName={`${me?.nick ?? "Yeni"} Masası`}
          onConfirm={masaKurOnay}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
