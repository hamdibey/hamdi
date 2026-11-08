/** Göz ardı listesi — klasik üye profili "Gözardı Et / İzin Ver" butonları.
 *  Nick'ler localStorage'da saklanır; ChatPanel göz ardı edilen üyelerin
 *  mesajlarını göstermez. */
const KEY = "vk_gozardi";

export function gozardiListesi(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function gozardiVar(nick: string): boolean {
  return gozardiListesi().includes(nick.trim().toLowerCase());
}

export function gozardiEkle(nick: string): void {
  const n = nick.trim().toLowerCase();
  const list = gozardiListesi();
  if (!list.includes(n)) list.push(n);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-100)));
  } catch {
    /* kota dolu — sessizce geç */
  }
}

export function gozardiKaldir(nick: string): void {
  const n = nick.trim().toLowerCase();
  try {
    localStorage.setItem(KEY, JSON.stringify(gozardiListesi().filter((x) => x !== n)));
  } catch {
    /* kota dolu — sessizce geç */
  }
}
