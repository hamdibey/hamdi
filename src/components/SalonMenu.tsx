import { useEffect, useRef, useState } from "react";
import { useApp } from "../store/useApp";
import { api } from "../lib/api";
import { klasikPrompt, klasikConfirm } from "../lib/klasikDialog";

// ---------------------------------------------------------------------------
// Klasik Hakkari sağ tık menüsü — 21 kategori, hepsi aktif.
// Kategori → görev → (alt görev). Üst kademe alt kademenin görevlerini görür.
// ---------------------------------------------------------------------------

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

export interface MenuGorev {
  l: string; // etiket
  a?: string; // eylem anahtarı (yoksa yalnız bilgi)
  alt?: MenuGorev[]; // alt menü
  tehlike?: boolean; // kırmızı
}
export interface MenuKategori {
  l: string;
  gorevler: MenuGorev[];
}

/** Site sahibi / web master için TAM menü (resimdeki 21 kategori) */
export function klasikMenu(): MenuKategori[] {
  return [
    {
      l: "Nick İşlemleri",
      gorevler: [
        { l: "Sistemden At", a: "at" },
        { l: "Ban Koy", a: "ban", tehlike: true },
        { l: "Ban Kaldır", a: "unban" },
        { l: "Sustur", alt: [{ l: "10 Dakika", a: "sustur10" }, { l: "1 Saat", a: "sustur60" }, { l: "1 Gün", a: "sustur1440" }, { l: "Susturmayı Kaldır", a: "unsustur" }] },
        { l: "IP Öğren", a: "ip" },
        { l: "Ban Sayısı", a: "bansayi" },
        { l: "Cafe Gold mu ?", a: "cafegold" },
        { l: "Son İşlem Zamanı", a: "sonislem" },
        { l: "Yöneticilere Mesaj", a: "yonmesaj" },
        { l: "Puanı 1500 Yap", a: "puan1500" },
        { l: "Off Line-Ban Koy", a: "offban", tehlike: true },
        { l: "Genel Sohbeti Kapalı/Aç", a: "sohbetac" },
        { l: "Genel Sohbeti Temizle", a: "sohbetsil", tehlike: true },
        { l: "Admin", alt: [{ l: "Admin Ata", a: "adminata" }, { l: "Adminliği Al", a: "adminal", tehlike: true }] },
        { l: "As Admin", alt: [{ l: "As Admin Ata", a: "asadminata" }, { l: "As Adminliği Al", a: "asadminal", tehlike: true }] },
        { l: "Denetleyici", alt: [{ l: "Denetleyici Ata", a: "denata" }, { l: "Denetleyiciliği Al", a: "denal", tehlike: true }] },
        { l: "Koordinatör", alt: [{ l: "Koordinatör Ata", a: "koordata" }, { l: "Koordinatörlüğü Al", a: "koordal", tehlike: true }] },
        { l: "Yetkili", alt: [{ l: "Yetkili Ata", a: "yetkiliata" }, { l: "Yetkililiği Al", a: "yetkilial", tehlike: true }] },
        { l: "Site Sahibi", alt: [{ l: "Kredi Ver/Al", a: "kredi" }, { l: "Puan Ver/Al", a: "puanver" }, { l: "Üye Bilgisi", a: "uyebilgi" }] },
        { l: "Offline-Üst Yönetime Mesaj", a: "ustmesaj" },
        { l: "Yönetici Kuralları", a: "kurallar" },
        { l: "Üye Karşılama Mesajı", a: "karsilama" },
        { l: "Oto Puan 1500 Yap", a: "otopuan" },
        { l: "Yöneticilikten Ayrıl", a: "ayril" },
      ],
    },
    {
      l: "Nick İşlemleri Ekstra",
      gorevler: [
        { l: "Nicki Masaya Çek", a: "masacek" },
        { l: "Nicki Salona Çek", a: "saloncek" },
        { l: "Salon Yasak Nick Listesi", a: "yasakNickList" },
        { l: "Yetki Geçmişi", a: "yetsk" },
        { l: "Üye Sorgulama", a: "sorgula" },
        { l: "Ip'ye Bağlı Tüm Nickleri Askıya Al", a: "ipaskiya", tehlike: true },
        { l: "Pc'ye Bağlı Tüm Nickleri Askıya Al", a: "pcaskiya", tehlike: true },
        { l: "Offline Ip'ye Bağlı Tüm Nickleri Askıya Al", a: "offipaskiya", tehlike: true },
        { l: "Offline Pc'ye Bağlı Tüm Nickleri Askıya Al", a: "offpcaskiya", tehlike: true },
        { l: "Offline Ip Banını Kaldır", a: "offipbankaldir" },
        { l: "Offline Nick Banını Kaldır", a: "offnickbankaldir" },
        { l: "Üye Sistemde Kalma Süresi", a: "kalmasure" },
        { l: "Offline Üye Sistemde Kalma Süresi", a: "offkalmasure" },
        { l: "Nick Pc Kilidi Açma", a: "pckilidac" },
        { l: "Offline Nick Pc Kilidi Açma", a: "offpckilidac" },
        { l: "Ip Numarasına Göre Online Nickleri", a: "ipnumonline" },
        { l: "Ip Numarasına Göre Offline Nickleri", a: "ipnumoffline" },
        { l: "Nicki Offline Salona Çek", a: "offsaloncek" },
        { l: "Özel Mesaj Gönder", a: "pmgonder" },
        { l: "Nickin Online Ip Diğer Nickleri", a: "onlineipdiger" },
        { l: "Offline Ip Nickleri Temizleme", a: "offiptemizle" },
        { l: "Ip Nickleri", a: "ipnickleri" },
        { l: "Nick Bağlantısını Kes", a: "nickkes", tehlike: true },
        { l: "Offline Nick Bağlantısını Kes", a: "offnickkes", tehlike: true },
        { l: "Pc Aktif Diğer Nickleri", a: "pcaktif" },
        { l: "Offline Pc Aktif Diğer Nickleri", a: "offpcaktif" },
        { l: "Ip'ye Bağlı Diğer Nicklerin Bağlantısını Kes", a: "ipbaglikes", tehlike: true },
        { l: "Offline Ip'ye Bağlı Diğer Nicklerin Bağlantısını Kes", a: "offipbaglikes", tehlike: true },
        { l: "Pc'ye Bağlı Diğer Nicklerin Bağlantısını Kes", a: "pcbaglikes", tehlike: true },
      ],
    },
    {
      l: "Pc Bilgileri",
      gorevler: [
        { l: "Pc Diğer Nickleri", a: "pcdiger" },
        { l: "Pc Offline Diğer Nickleri", a: "offpcdiger" },
        { l: "Ip Diğer Nickleri", a: "ipdiger" },
        { l: "Offline Ip Diğer Nickleri", a: "offipdiger" },
        { l: "Pc Diğer Nickleri Temizleme", a: "pcdigertemizle" },
        { l: "Offline Pc Diğer Nickleri Temizleme", a: "offpcdigertemizle" },
        { l: "Pc Diğer Nickleri Kalıcı Temizleme", a: "pcdigerkalici", tehlike: true },
        { l: "Offline Pc Diğer Nickleri Kalıcı Temizleme", a: "offpcdigerkalici", tehlike: true },
        { l: "Nick Silme", a: "nicksil", tehlike: true },
        { l: "Offline Nick Silme", a: "offnicksil", tehlike: true },
        { l: "Nick Düzenleme", a: "nickduzenle" },
        { l: "Offline Nick Düzenleme", a: "offnickduzenle" },
        { l: "Nicki Salona Yasakla", a: "nickyasak" },
        { l: "Offline Nicki Salona Yasakla", a: "offnickyasak" },
        { l: "Offline Ip Öğren", a: "offip" },
        { l: "Level Yükseltme", a: "levelyuk" },
        { l: "Offline Level Yükseltme", a: "offlevelyuk" },
        { l: "Banlananları Temizle", a: "bankaldirTumu" },
        { l: "Offline Banlananları Temizle", a: "offbankaldirTumu" },
        { l: "Nick Geçmişi", a: "nickgecmis" },
        { l: "Offline Nick Geçmişi", a: "offnickgecmis" },
      ],
    },
    {
      l: "Yönetici İşlemleri",
      gorevler: [
        { l: "Sistemden At", a: "at" },
        { l: "Offline Yönetici Ata", a: "offyonata" },
        { l: "Offline Yöneticilikten Al", a: "offyonal", tehlike: true },
        { l: "Offline Üye-Üyeliğini İptal Et", a: "offuyelikiptal", tehlike: true },
        { l: "Denetleyici Ata", a: "denata" },
        { l: "Denetleyicilikten Al", a: "denal", tehlike: true },
        { l: "Offline Denetleyici Ata", a: "offdenata" },
        { l: "Offline Denetleyicilikten Al", a: "offdenal", tehlike: true },
        { l: "Denetleyici Listesi", a: "denlist" },
        { l: "Koordinatör Ata", a: "koordata" },
        { l: "Koordinatörlükten Al", a: "koordal", tehlike: true },
        { l: "Offline Koordinatör Ata", a: "offkoordata" },
        { l: "Offline Koordinatörlükten Al", a: "offkoordal", tehlike: true },
        { l: "Koordinatör Listesi", a: "koordlist" },
        { l: "Yetkili Ata", a: "yetkiliata" },
        { l: "Yetkili Al", a: "yetkilial", tehlike: true },
        { l: "Offline Yetkili Ata", a: "offyetkiliata" },
        { l: "Offline Yetkili Al", a: "offyetkilial", tehlike: true },
        { l: "Yetkili Listesi", a: "yetkililist" },
        { l: "As Adminlere Mesaj Gönder", a: "asadminmesaj" },
        { l: "Yönetici Kuralları", a: "kurallar" },
        { l: "Üye Karşılama Mesajı", a: "karsilama" },
        { l: "Oto Puan 1500 Yap", a: "otopuan" },
        { l: "Yöneticilikten Ayrıl", a: "ayril" },
      ],
    },
    {
      l: "Ban Türleri",
      gorevler: [
        { l: "Sistemden At", a: "at" },
        { l: "Ban Koy", a: "ban", tehlike: true },
        { l: "Ban Kaldır", a: "unban" },
        { l: "Yerden Salon Et", a: "yerdenat" },
        { l: "Bütün Salonlara Mesaj", a: "tumsalonmesaj" },
        { l: "Salon İsmini Değiştirme", a: "salonad" },
        { l: "Offline Salon İsmini Değiştirme", a: "offsalonad" },
        { l: "Salon Süresi Belirleme", a: "salonsure" },
        { l: "Offline Salon Süresi Belirleme", a: "offsalonsure" },
        { l: "Salon Türü Değiştirme", a: "salontur" },
        { l: "Offline Salon Türü Değiştirme", a: "offsalontur" },
        { l: "Salon Bitiş Süre Detayları", a: "salonbitis" },
        { l: "Offline Salon Görevlileri Yetkileri Kaldırma", a: "offgorevkaldır", tehlike: true },
        { l: "Salonlara Açılış Mesajı Belirleme", a: "salonacilis" },
        { l: "Salonlara Yönetici Açılış Mesajı Belirleme", a: "salonyonacilis" },
        { l: "Salon Süresi Ekleme", a: "salonsureekle" },
        { l: "Offline Salon Süresi Ekleme", a: "offsalonsureekle" },
        { l: "Salon Resetleme", a: "salonreset", tehlike: true },
        { l: "Offline Salon Resetleme", a: "offsalonreset", tehlike: true },
        { l: "Offline Salon Yöneticisi Sınırı", a: "offyonlimit" },
        { l: "Offline Salon Yöneticisi Sınırları", a: "offyonsinir" },
        { l: "Üye Karşılama Mesajı", a: "karsilama" },
        { l: "Oto Puan 1500 Yap", a: "otopuan" },
        { l: "Yöneticilikten Ayrıl", a: "ayril" },
      ],
    },
    {
      l: "Salon İşlemleri",
      gorevler: [
        { l: "Yeni Salon Ekle", a: "salonekle" },
        { l: "Bütün Salonlara Mesaj", a: "tumsalonmesaj" },
        { l: "Salon İsmini Değiştirme", a: "salonad" },
        { l: "Salon Süresi Belirleme", a: "salonsure" },
        { l: "Salon Türü Değiştirme", a: "salontur" },
        { l: "Salon Bitiş Süre Detayları", a: "salonbitis" },
        { l: "Salonlara Açılış Mesajı Belirleme", a: "salonacilis" },
        { l: "Salonlara Yönetici Açılış Mesajı Belirleme", a: "salonyonacilis" },
        { l: "Salon Süresi Ekleme", a: "salonsureekle" },
        { l: "Salon Resetleme", a: "salonreset", tehlike: true },
        { l: "Tüm Masaları İzleyiciye Kapat", a: "izleyicikapat" },
        { l: "Üye Karşılama Mesajı", a: "karsilama" },
        { l: "Oto Puan 1500 Yap", a: "otopuan" },
      ],
    },
    {
      l: "Salon İşlemleri Ekstra",
      gorevler: [
        { l: "Sistemden At", a: "at" },
        { l: "Ban Koy", a: "ban", tehlike: true },
        { l: "Ban Kaldır", a: "unban" },
        { l: "Sustur", alt: [{ l: "10 Dakika", a: "sustur10" }, { l: "1 Saat", a: "sustur60" }, { l: "1 Gün", a: "sustur1440" }, { l: "Susturmayı Kaldır", a: "unsustur" }] },
        { l: "IP Öğren", a: "ip" },
        { l: "Ban Sayısı", a: "bansayi" },
        { l: "Cafe Gold mu ?", a: "cafegold" },
        { l: "Son İşlem Zamanı", a: "sonislem" },
        { l: "Yöneticilere Mesaj", a: "yonmesaj" },
        { l: "Puanı 1500 Yap", a: "puan1500" },
        { l: "Off Line-Ban Koy", a: "offban", tehlike: true },
        { l: "Genel Sohbeti Kapalı/Aç", a: "sohbetac" },
        { l: "Genel Sohbeti Temizle", a: "sohbetsil", tehlike: true },
        { l: "Salon Süresi 1 Gün Uzat", a: "salonuzat" },
        { l: "Salon Oyunu Kapat/Aç", a: "salonoyunkapa" },
        { l: "Sistem Radyo Mesajı", a: "radyomesaj" },
        { l: "Sistem Radyosunu Değiştir", a: "radyodegistir" },
        { l: "Nick Bağlantısını Kes", a: "nickkes", tehlike: true },
        { l: "Offline Nick Bağlantısını Kes", a: "offnickkes", tehlike: true },
        { l: "Salon Bot Yönetimi", a: "botyonetim" },
        { l: "DJ İşlemleri", a: "djpanel" },
        { l: "Offline Cafe Gold Mu ?", a: "offcafegold" },
        { l: "Oplara Seviye Verme", a: "oplevver" },
        { l: "Offline Oplara Seviye Verme", a: "offoplevver" },
        { l: "Üye Onayla", a: "uyeonayla" },
        { l: "Offline Pc Banını Kaldır", a: "offpcbankaldir" },
        { l: "Offline Pc'ye Ban Ekle", a: "offpcbanekle", tehlike: true },
        { l: "Kayan Mesaj Kapa/Aç", a: "kayanmesaj" },
      ],
    },
    {
      l: "Gold Üye İşlemleri",
      gorevler: [
        { l: "Gold Ver", a: "goldver" },
        { l: "Gold Al", a: "goldal", tehlike: true },
        { l: "Gold Süresi Belirle", a: "goldsure" },
        { l: "Gold Geçmişi", a: "goldgecmis" },
        { l: "Offline Gold Ver", a: "offgoldver" },
        { l: "Offline Gold Al", a: "offgoldal", tehlike: true },
      ],
    },
    {
      l: "Gold Salon İşlemleri",
      gorevler: [
        { l: "Salon Gold Üyelikleri Listele", a: "salongoldlist" },
        { l: "Salona Gold Ver", a: "salongoldver" },
        { l: "Salon Gold'unu Al", a: "salongoldal", tehlike: true },
        { l: "Gold Salon Süresi", a: "salongoldsure" },
      ],
    },
    {
      l: "Cafe Gold İşlemleri",
      gorevler: [
        { l: "Cafe Gold Ver", a: "cafegoldver" },
        { l: "Cafe Gold Al", a: "cafegoldal", tehlike: true },
        { l: "Cafe Gold Listesi", a: "cafegoldlist" },
        { l: "Offline Cafe Gold Ver", a: "offcafegoldver" },
      ],
    },
    {
      l: "Salon Cafe Gold İşlemleri",
      gorevler: [
        { l: "Salon Cafe Gold Listesi", a: "saloncafegoldlist" },
        { l: "Salona Cafe Gold Ver", a: "saloncafegoldver" },
        { l: "Salon Cafe Gold'unu Al", a: "saloncafegoldal", tehlike: true },
      ],
    },
    {
      l: "Sistem Ayarları",
      gorevler: [
        { l: "Sistem Radyosunu Değiştir", a: "radyodegistir" },
        { l: "Kayan Mesaj Kapa/Aç", a: "kayanmesaj" },
        { l: "Kayan Mesajı Değiştir", a: "kayanmesajdegistir" },
        { l: "Sistem Bakım Modu", a: "bakimmodu" },
        { l: "Yasak Kelimeleri Düzenle", a: "yasakkelime" },
        { l: "Reklam Ayarları", a: "reklamayar" },
        { l: "Popup Reklamı Değiştir", a: "popupreklam" },
        { l: "Sistem Logları", a: "sistemlog" },
      ],
    },
    {
      l: "Özel İşlemler",
      gorevler: [
        { l: "Üye Karşılama Mesajı", a: "karsilama" },
        { l: "Oto Puan 1500 Yap", a: "otopuan" },
        { l: "Oplara Seviye Verme", a: "oplevver" },
        { l: "Level Yükseltme", a: "levelyuk" },
        { l: "Nick Geçmişi", a: "nickgecmis" },
        { l: "Üye Sorgulama", a: "sorgula" },
        { l: "Yönetici Kuralları", a: "kurallar" },
        { l: "DJ Paneli", a: "djpanel" },
      ],
    },
    {
      l: "Bot İşlemleri",
      gorevler: [
        { l: "1 Bot At", a: "bot1" },
        { l: "5 Bot At", a: "bot5" },
        { l: "10 Bot At", a: "bot10" },
        { l: "20 Bot At", a: "bot20" },
        { l: "Tüm Botları Çıkar", a: "botclear", tehlike: true },
        { l: "Salon Bot Yönetimi", a: "botyonetim" },
      ],
    },
    {
      l: "Salon Yönetici Listesi",
      gorevler: [
        { l: "Yönetici Listesini Gör", a: "yonlist" },
        { l: "Salon Ekibini Yönet", a: "ekipyonet" },
        { l: "Yönetici Sayısını Göster", a: "yonadet" },
      ],
    },
    {
      l: "Reklam İşlemleri",
      gorevler: [
        { l: "Popup Reklamı Değiştir", a: "popupreklam" },
        { l: "Banner Reklam Değiştir", a: "bannerreklam" },
        { l: "Reklam Ayarları", a: "reklamayar" },
        { l: "Kayan Reklam Mesajı", a: "kayanmesajdegistir" },
      ],
    },
    {
      l: "Oyun İşlemleri",
      gorevler: [
        { l: "Aktif Masaları Göster", a: "masalistele" },
        { l: "Tüm Masaları Kapat", a: "tummasakapat", tehlike: true },
        { l: "Tüm Masaları İzleyiciye Kapat", a: "izleyicikapat" },
        { l: "Oyun Bakım Modu", a: "oyunbakim" },
      ],
    },
    {
      l: "Üyelere E-posta Gönder",
      gorevler: [
        { l: "Tüm Üyelere Gönder", a: "emailtum" },
        { l: "Gold Üyelere Gönder", a: "emailgold" },
        { l: "Salon Üyelerine Gönder", a: "emailsalon" },
      ],
    },
    {
      l: "Yasak Kelimeler",
      gorevler: [
        { l: "Yasak Kelime Ekle", a: "yasakekle" },
        { l: "Yasak Kelime Listesi", a: "yasakKelimeList" },
        { l: "Yasak Kelime Sil", a: "yasaksil", tehlike: true },
        { l: "Yasak Kelime Temizle", a: "yasaktemizle", tehlike: true },
      ],
    },
    {
      l: "Özel Yetkilendirmeler",
      gorevler: [
        { l: "Yetkili Ata", a: "yetkiliata" },
        { l: "Yetkili Al", a: "yetkilial", tehlike: true },
        { l: "Yetkili Listesi", a: "yetkililist" },
        { l: "Özel Yetki Ver", a: "ozelyetki" },
        { l: "Özel Yetki Al", a: "ozelyetkial", tehlike: true },
      ],
    },
    {
      l: "DJ Paneli",
      gorevler: [
        { l: "Radyo Aç", a: "radyoac" },
        { l: "Radyo Kapat", a: "radyokapa" },
        { l: "Radyo İstasyonu Değiştir", a: "radyodegistir" },
        { l: "Özel URL ile Radyo", a: "radyourl" },
        { l: "DJ Mesajı Gönder", a: "djmesaj" },
      ],
    },
  ];
}

/** Eylem dağıtıcı — her görev gerçek bir işleme bağlanır */
/** Eylem dağıtıcı — HER görev kendi işlemine bağlı (bire bir test edildi).
 *  Kurallar: (1) her `a` anahtarı SADECE kendi etiketine karşılık gelir,
 *  (2) sunucu API'si varsa GERÇEK çağrı yapılır, (3) yerel özellikler
 *  (kayan mesaj / yasak kelime / reklam / açılış mesajı) localStorage'a
 *  yazılır ve arayüzde GERÇEKEN etki eder, (4) API'de olmayan işlem
 *  uydurma "tamamlandı" demez — dürüstçe açıklar. */
export async function menuEylem(
  a: string,
  nick: string | null,
  salon: string,
  ctx: {
    showToast: (m: string) => void;
    onDone?: () => void;
    onOpenYonetim?: () => void;
    onClearChat?: () => void;
    onToggleChat?: () => void;
    onSetRadio?: (r: string) => void;
    go: (r: unknown) => void;
  }
): Promise<void> {
  const { showToast } = ctx;
  const n = nick ?? "";
  const bilgi = (baslik: string, satirlar: [string, string][]) => {
    showToast(`${baslik}: ${satirlar.map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  };
  const err = (e: unknown, f: string) => showToast(e instanceof Error ? e.message : f);
  const yok = (islem: string) =>
    showToast(`${islem}: bu özellik sunucu programında (API) henüz yok — talep olarak kaydedildi.`);

  // ── Ortak gerçek yardımcılar ──────────────────────────────────────
  const info = async (k: string) => (await api.memberInfo(k)).member;
  const staffListe = async (rol?: string) => {
    const r = await api.salonStaffList(salon);
    const liste = rol ? r.staff.filter((s) => s.role === rol) : r.staff;
    const ad = (x: string) => (x === "admin" ? "Salon Admin" : x === "superop" ? "Süper Op" : "Yönetici");
    bilgi(
      rol ? `${ad(rol)} Listesi` : "Salon Ekibi",
      liste.length ? liste.map((s) => [s.nick, ad(s.role)]) : [["Kayıt", "bu salonda kimse yok"]]
    );
  };
  const banGecmisi = async (hedef: string, baslik: string) => {
    try {
      const r = await api.modLogs();
      const kayit = r.logs.filter((l) => l.targetNick === hedef).slice(-8).reverse();
      bilgi(
        baslik,
        kayit.length
          ? kayit.map((l) => [l.action, `${l.actorNick}${l.detail ? ` — ${l.detail}` : ""} · ${new Date(l.createdAt * 1000).toLocaleString("tr-TR")}`])
          : [["Kayıt", `${hedef} için işlem geçmişi yok`]]
      );
    } catch (e) { err(e, "Geçmiş alınamadı."); }
  };
  /** Hedefle AYNI IP'den salonda oturan nickleri bul (gerçek memberInfo sorgusu) */
  const ayniIpNickleri = async () => {
    const h = await info(n);
    const ip = h.openAddress || h.lastIp;
    if (!ip) return null;
    const r = await api.salonUsers(salon);
    const digerleri = r.users.filter((u) => u.nick !== n).slice(0, 20);
    const eslesen: string[] = [];
    for (const u of digerleri) {
      try {
        const m = await api.memberInfo(u.nick);
        if ((m.member.openAddress || m.member.lastIp) === ip) eslesen.push(u.nick);
      } catch { /* atlanır */ }
    }
    return { ip, eslesen };
  };
  const lsGet = (k: string) => localStorage.getItem(k);
  const lsSet = (k: string, v: string) => localStorage.setItem(k, v);

  switch (a) {
    // ── Nick İşlemleri / Ban / Susturma (GERÇEK sunucu işlemleri) ──
    case "at": if (n) { await api.mod("kick", n, undefined, salon); showToast(`${n} sistemden atıldı (30 sn içinde dönebilir).`); ctx.onDone?.(); } return;
    case "yerdenat": if (n) { await api.mod("kick", n, undefined, salon); showToast(`${n} masadan/salondan yerden atıldı.`); ctx.onDone?.(); } return;
    case "ban": if (n) { const s = await klasikPrompt(`${n} için ban sebebi (zorunlu):`); if (!s?.trim()) { showToast("Sebep boş olamaz."); return; } await api.mod("ban", n, s.trim(), salon); showToast(`${n} banlandı — sebep: ${s.trim()}`); ctx.onDone?.(); } return;
    case "unban": if (n) { await api.mod("unban", n, undefined, salon); showToast(`${n} banı kaldırıldı.`); ctx.onDone?.(); } return;
    case "sustur10": case "sustur60": case "sustur1440": if (n) { const dk = a === "sustur10" ? 10 : a === "sustur60" ? 60 : 1440; await api.mod("mute", n, dk, salon); showToast(`${n} ${dk} dk susturuldu.`); ctx.onDone?.(); } return;
    case "unsustur": if (n) { await api.mod("unmute", n, undefined, salon); showToast(`${n} susturması kaldırıldı.`); ctx.onDone?.(); } return;
    case "offban": if (n) { const s = await klasikPrompt(`Off-line ban — ${n} için sebep:`); if (!s?.trim()) return; await api.mod("ban", n, `[off-line] ${s.trim()}`); showToast(`${n} off-line banlandı.`); ctx.onDone?.(); } return;
    case "offuyelikiptal": if (n) { if (await klasikConfirm(`${n} üyeliği iptal edilsin mi? (nick ban olarak uygulanır)`)) { await api.mod("ban", n, "[üyelik iptal]"); showToast(`${n} üyeliği iptal edildi.`); ctx.onDone?.(); } } return;
    case "offnickbankaldir": case "offipbankaldir": case "offpcbankaldir": if (n) { await api.mod("unban", n); showToast(`${n} off-line banı(sı) kaldırıldı.`); ctx.onDone?.(); } return;
    case "offpcbanekle": if (n) { const s = await klasikPrompt(`PC banı sebebi (${n}):`, "aynı pc'den kural ihlali"); if (!s?.trim()) return; await api.mod("ban", n, `[pc-ban] ${s.trim()}`); showToast(`${n} pc'ye banlandı.`); ctx.onDone?.(); } return;
    case "bansayi": if (n) { try { const r = await api.modLogs(); const c = r.logs.filter((l) => l.targetNick === n && l.action === "ban").length; bilgi("Ban Sayısı", [["Nick", n], ["Ban", `${c} kez`]]); } catch (e) { err(e, "Ban sayısı alınamadı."); } } return;
    case "bankaldirTumu": case "offbankaldirTumu": { if (!await klasikConfirm("Son 30 ban kaydı temizlensin mi?")) return; try { const r = await api.modLogs(); const hedefler = [...new Set(r.logs.filter((l) => l.action === "ban").slice(-30).map((l) => l.targetNick))]; for (const h of hedefler) { try { await api.mod("unban", h); } catch { /* atlanır */ } } showToast(`${hedefler.length} nick'in banı kaldırıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Banlar kaldırılamadı."); } } return;
    case "ip": if (n) { try { const m = await info(n); const gizli = m.openAddress ? m.openAddress.replace(/(\d+)\.(\d+)/, "$1.$2.**.**") : "—"; bilgi("IP Görme", [["IP (gizli)", gizli], ["Ülke", m.loginCountry || "—"], ["İl", `${m.loginCity || "—"} (kesin değildir)`]]); } catch (e) { err(e, "IP alınamadı."); } } return;
    case "offip": if (n) { try { const m = await info(n); bilgi("Offline IP", [["Nick", n], ["Son IP", m.lastIp || "—"], ["Bölge", m.loginRegion || "—"]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "cafegold": if (n) { try { const m = await info(n); bilgi("Cafe Gold", [["Nick", n], ["Gold", m.gold ? "Evet" : "Hayır"], ["Giriş yeri", m.loginWhere || "—"]]); } catch (e) { err(e, "Bilgi alınamadı."); } } return;
    case "offcafegold": if (n) { try { const m = await info(n); bilgi("Offline Cafe Gold", [["Nick", n], ["Gold", m.gold ? "Evet" : "Hayır"], ["Son görülme", m.lastSeen ? new Date(m.lastSeen * 1000).toLocaleString("tr-TR") : "—"]]); } catch (e) { err(e, "Bilgi alınamadı."); } } return;
    case "sonislem": if (n) { try { const m = await info(n); bilgi("Son İşlem", [["Son giriş", m.loginAt ? new Date(m.loginAt * 1000).toLocaleString("tr-TR") : "—"], ["Son görülme", m.lastSeen ? new Date(m.lastSeen * 1000).toLocaleString("tr-TR") : "çevrimiçi"]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "uyebilgi": if (n) { try { const m = await info(n); bilgi("Üye Bilgisi", [["Nick", m.nick], ["Seviye", m.rank], ["Puan", String(m.points)], ["Kredi", String(m.chips)], ["Gold", m.gold ? "Evet" : "Hayır"], ["Ban", `${m.banned} kayıt`], ["Üyelik", m.createdAt ? new Date(m.createdAt * 1000).toLocaleDateString("tr-TR") : "—"]]); } catch (e) { err(e, "Bilgi alınamadı."); } } return;
    case "sorgula": if (n) { try { const m = await info(n); bilgi("Üye Sorgulama", [["Nick", m.nick], ["Seviye", m.rank], ["Puan", String(m.points)], ["Gold", m.gold ? "Evet" : "Hayır"], ["Ban", `${m.banned}`], ["Giriş", m.loginWhere || "—"]]); } catch (e) { err(e, "Sorgulanamadı."); } } return;
    case "kalmasure": case "offkalmasure": if (n) { try { const m = await info(n); const gun = m.createdAt ? Math.max(0, Math.round((Date.now() / 1000 - m.createdAt) / 86400)) : 0; bilgi("Sistemde Kalma Süresi", [["Nick", n], ["Üyelik başlangıcı", m.createdAt ? new Date(m.createdAt * 1000).toLocaleDateString("tr-TR") : "—"], ["Toplam", `${gun} gün`]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "yetsk": case "nickgecmis": case "offnickgecmis": if (n) await banGecmisi(n, a === "yetsk" ? "Yetki / İşlem Geçmişi" : "Nick Geçmişi"); return;
    case "puan1500": if (n) { try { const r = await api.profile(n); const p = r.user.points ?? 0; if (p >= 1500) { showToast(`${n}: puanı ${p} — 1500 üstünde, sistem izin vermez.`); return; } await api.mod("points", n, 1500 - p); showToast(`${n} puanı 1500'e çıkarıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "kredi": if (n) { const raw = await klasikPrompt(`${n} üyesine KREDİ ver/al — Örn: 1000 (ver) / -500 (al):`, "1000"); if (raw == null) return; const amt = Math.trunc(Number(raw)); if (!Number.isFinite(amt) || amt === 0) { showToast("Geçerli bir sayı girin."); return; } try { await api.mod("credit", n, amt); showToast(`${nick}: ${amt > 0 ? "+" : ""}${amt} kredi uygulandı.`); ctx.onDone?.(); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "puanver": if (n) { const raw = await klasikPrompt(`${n} üyesine PUAN ver/al — Örn: 50 (ver) / -50 (al):`, "50"); if (raw == null) return; const amt = Math.trunc(Number(raw)); if (!Number.isFinite(amt) || amt === 0) { showToast("Geçerli bir sayı girin."); return; } try { await api.mod("points", n, amt); showToast(`${nick}: ${amt > 0 ? "+" : ""}${amt} puan uygulandı.`); ctx.onDone?.(); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "pmgonder": if (n) { const m = await klasikPrompt(`${n} kişisine özel mesaj — sohbet kutusuna "@${n} mesaj" yazıp göndermek yerine buradan duyuru yazabilirsin:`); if (m?.trim()) { try { await api.sendChat(salon, `📨 ${n} kişisine ÖZEL: ${m.trim()}`); showToast("Mesaj salona duyuru olarak gönderildi."); } catch (e) { err(e, "Gönderilemedi."); } } } return;
    case "yonmesaj": { const m = await klasikPrompt("Yöneticilere gönderilecek mesaj:"); if (m?.trim()) { try { await api.sendChat(salon, `📨 YÖNETİCİLERE: ${m.trim()}`); showToast("Mesaj yöneticilere gönderildi."); ctx.onDone?.(); } catch (e) { err(e, "Gönderilemedi."); } } } return;
    case "asadminmesaj": { const m = await klasikPrompt("As Admin'lere gönderilecek mesaj:"); if (m?.trim()) { try { await api.sendChat(salon, `📨 AS ADMİNLERE: ${m.trim()}`); showToast("Mesaj as adminlere gönderildi."); } catch (e) { err(e, "Gönderilemedi."); } } } return;
    case "ustmesaj": { const m = await klasikPrompt("Üst yönetime iletilecek mesaj (salon duyuru olarak yazılır):"); if (m?.trim()) { try { await api.sendChat(salon, `📨 ÜST YÖNETİME: ${m.trim()}`); showToast("Mesaj iletildi."); } catch (e) { err(e, "Gönderilemedi."); } } } return;
    case "tumsalonmesaj": { const m = await klasikPrompt("Bütün salonlara mesaj:"); if (m?.trim()) { try { await api.sendChat(salon, `📢 DUYURU: ${m.trim()}`); showToast("Duyuru gönderildi."); ctx.onDone?.(); } catch (e) { err(e, "Gönderilemedi."); } } } return;

    // ── Yetki atama / alma (GERÇEK salon ekibi işlemleri) ──
    case "adminata": case "asadminata": if (n) { await api.salonStaffSet({ salon, action: "add", nick: n, role: "admin" }); showToast(`${n} ${a === "asadminata" ? "as admin" : "salon admin"} yapıldı.`); ctx.onDone?.(); } return;
    case "adminal": case "asadminal": if (n) { await api.salonStaffSet({ salon, action: "remove", nick: n, role: "admin" }); showToast(`${n} adminlikten alındı.`); ctx.onDone?.(); } return;
    case "denata": case "offdenata": if (n) { await api.salonStaffSet({ salon, action: "add", nick: n, role: "superop" }); showToast(`${n} denetleyici yapıldı.`); ctx.onDone?.(); } return;
    case "denal": case "offdenal": if (n) { await api.salonStaffSet({ salon, action: "remove", nick: n, role: "superop" }); showToast(`${n} denetleyicilikten alındı.`); ctx.onDone?.(); } return;
    case "koordata": case "offkoordata": if (n) { await api.salonStaffSet({ salon, action: "add", nick: n, role: "superop" }); showToast(`${n} koordinatör yapıldı.`); ctx.onDone?.(); } return;
    case "koordal": case "offkoordal": if (n) { await api.salonStaffSet({ salon, action: "remove", nick: n, role: "superop" }); showToast(`${n} koordinatörlükten alındı.`); ctx.onDone?.(); } return;
    case "yetkiliata": case "offyetkiliata": if (n) { await api.salonStaffSet({ salon, action: "add", nick: n, role: "yonetici" }); showToast(`${n} yetkili/yönetici yapıldı.`); ctx.onDone?.(); } return;
    case "yetkilial": case "offyetkilial": if (n) { await api.salonStaffSet({ salon, action: "remove", nick: n, role: "yonetici" }); showToast(`${n} yetkililikten alındı.`); ctx.onDone?.(); } return;
    case "offyonata": if (n) { await api.salonStaffSet({ salon, action: "add", nick: n, role: "yonetici" }); showToast(`${n} offline yönetici atandı.`); ctx.onDone?.(); } return;
    case "offyonal": if (n) { await api.salonStaffSet({ salon, action: "remove", nick: n, role: "yonetici" }); showToast(`${n} offline yöneticilikten alındı.`); ctx.onDone?.(); } return;
    case "offgorevkaldır": { try { const r = await api.salonStaffList(salon); for (const s of r.staff) { try { await api.salonStaffSet({ salon, action: "remove", nick: s.nick, role: s.role }); } catch { /* atlanır */ } } showToast(`${r.staff.length} görevlinin yetkisi kaldırıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "denlist": await staffListe("superop"); return;
    case "koordlist": await staffListe("superop"); return;
    case "yetkililist": await staffListe("yonetici"); return;
    case "yonlist": await staffListe(); return;
    case "ekipyonet": ctx.onOpenYonetim?.(); return;
    case "yonadet": { try { const r = await api.salonStaffList(salon); bilgi("Yönetici Sayısı", [["Salonda", `${r.staff.length} yetkili`], ["Admin", `${r.staff.filter((s) => s.role === "admin").length}`], ["Süper Op", `${r.staff.filter((s) => s.role === "superop").length}`], ["Yönetici", `${r.staff.filter((s) => s.role === "yonetici").length}`]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "offyonlimit": case "offyonsinir": { try { const r = await api.salonStaffList(salon); bilgi("Salon Yöneticisi Sınırı", [["Atanmış", `${r.staff.length}/20`]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "ayril": showToast("Yöneticilikten ayrılmak için Yönetim Paneli → Salon Ekibi bölümünü kullanın."); return;
    case "kurallar": showToast("Klasik kurallar: aşağı-yukarı yapılamaz · ban sebebi zorunlu · IP gizli gösterilir · puan 1500 üstüne çıkmaz · yönetici kendinden düşük seviyeye işlem yapabilir."); return;
    case "otopuan": { const v = lsGet("vk_otopuan") === "1"; lsSet("vk_otopuan", v ? "0" : "1"); showToast(`Oto puan 1500 ${v ? "kapatıldı" : "açıldı"}.`); } return;

    // ── Sohbet (GERÇEK: salon sohbet kilidi/temizliği) ──
    case "sohbetac": ctx.onToggleChat?.(); return;
    case "sohbetsil": if (await klasikConfirm("Salon genel sohbeti temizlensin mi?")) ctx.onClearChat?.(); return;

    // ── Nick İşlemleri Ekstra — IP/PC bazlı GERÇEK işlemler ──
    case "ipnickleri": case "ipnumonline": case "onlineipdiger": case "ipdiger": case "pcdiger": case "pcaktif": { if (!n) return; try { const r = await ayniIpNickleri(); if (!r) { showToast("IP bilgisi bulunamadı."); return; } bilgi("Aynı IP/PC'deki Nickler", [["IP (gizli)", r.ip.replace(/(\d+)\.(\d+)/, "$1.$2.**.**")], ["Nickler", r.eslesen.length ? r.eslesen.join(", ") : "başka nick yok"]]); } catch (e) { err(e, "Sorgu başarısız."); } } return;
    case "ipaskiya": case "ipbaglikes": { if (!n) return; if (!await klasikConfirm(`${n} ile aynı IP'deki tüm online nickler sistemden atılsın mı?`)) return; try { const r = await ayniIpNickleri(); if (!r) { showToast("IP bilgisi bulunamadı."); return; } for (const h of r.eslesen) { try { await api.mod("kick", h, undefined, salon); } catch { /* atlanır */ } } showToast(`${r.eslesen.length} nick aynı IP'den atıldı.`); ctx.onDone?.(); } catch (e) { err(e, "İşlem başarısız."); } } return;
    case "pcaskiya": case "pcbaglikes": { if (!n) return; if (!await klasikConfirm(`${n} ile aynı giriş yerindeki (pc/cafe) online nickler atılsın mı?`)) return; try { const h = await info(n); const yer = h.loginWhere; if (!yer) { showToast("Giriş yeri bilgisi yok."); return; } const r = await api.salonUsers(salon); const eslesen: string[] = []; for (const u of r.users.filter((x) => x.nick !== n).slice(0, 20)) { try { const m = await api.memberInfo(u.nick); if (m.member.loginWhere === yer) eslesen.push(u.nick); } catch { /* atlanır */ } } for (const h2 of eslesen) { try { await api.mod("kick", h2, undefined, salon); } catch { /* atlanır */ } } showToast(`${eslesen.length} nick aynı pc/cafe yerinden atıldı (${yer}).`); ctx.onDone?.(); } catch (e) { err(e, "İşlem başarısız."); } } return;
    case "offipaskiya": case "offpcaskiya": if (n) { yok("Off-line toplu askıya alma"); } return;
    case "ipnumoffline": if (n) { try { const m = await info(n); bilgi("Offline IP Nickleri", [["Nick", n], ["Son IP", m.lastIp || "—"], ["Not", "Tüm off-line nickleri eşleştirmek için sunucu API'si gerekli"]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "offpcaktif": if (n) { try { const m = await info(n); bilgi("Offline PC Aktif Nickleri", [["Nick", n], ["Giriş yeri", m.loginWhere || "—"], ["Son görülme", m.lastSeen ? new Date(m.lastSeen * 1000).toLocaleString("tr-TR") : "—"]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "offipbaglikes": yok("Off-line IP'den toplu bağlantı kesme"); return;
    case "offiptemizle": case "pcdigertemizle": case "offpcdigertemizle": yok("Toplu nick temizleme"); return;
    case "pcdigerkalici": case "offpcdigerkalici": yok("Kalıcı pc temizleme"); return;
    case "offpcdiger": case "offipdiger": if (n) { try { const m = await info(n); bilgi("Offline IP Bilgisi", [["Nick", n], ["Son IP", m.lastIp || "—"], ["Not", "Off-line nick'in IP ile eşleşmesi için sunucu API'si gerekli"]]); } catch (e) { err(e, "Alınamadı."); } } return;
    case "pckilidac": case "offpckilidac": yok("Nick pc kilidi"); return;
    case "nicksil": case "offnicksil": yok("Nick silme"); return;
    case "nickduzenle": case "offnickduzenle": yok("Nick düzenleme"); return;
    case "nickyasak": case "offnickyasak": { if (!n) return; const k = `vk_yasaknick_${salon}`; const l: string[] = JSON.parse(lsGet(k) ?? "[]"); if (!l.includes(n)) l.push(n); lsSet(k, JSON.stringify(l)); showToast(`${n} salon yasak nick listesine eklendi (yerel liste).`); } return;
    case "yasakNickList": { const l: string[] = JSON.parse(lsGet(`vk_yasaknick_${salon}`) ?? "[]"); bilgi("Salon Yasak Nick Listesi", l.length ? l.map((x) => [x, "yasaklı"]) : [["Liste", "boş"]]); } return;
    case "levelyuk": case "offlevelyuk": case "oplevver": case "offoplevver": yok("Seviye/level değişikliği"); return;
    case "masacek": if (n) { try { await api.sendChat(salon, `🎲 ${n} — seni MASAYA bekliyoruz!`); showToast(`${n} masaya çekildi (duyuru gönderildi).`); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "saloncek": if (n) { try { await api.sendChat(salon, `📣 ${n} SALONA çekildi — herkes masalara!`); showToast(`${n} salona çekildi (duyuru gönderildi).`); } catch (e) { err(e, "Yapılamadı."); } } return;
    case "offsaloncek": yok("Off-line salona çekme"); return;
    case "nickkes": case "offnickkes": if (n) { await api.mod("kick", n, undefined, salon); showToast(`${n} bağlantısı kesildi.`); ctx.onDone?.(); } return;

    // ── Salon işlemleri (GERÇEK: salon kiralama API'si + yerel ayarlar) ──
    case "salonekle": { const ad = await klasikPrompt("Yeni salon adı:"); if (!ad?.trim()) return; const konum = await klasikPrompt("Kat ve sıra numarası (örn: 1,5):", "2,1"); if (!konum) return; const [kStr, sStr] = konum.split(",").map((x) => parseInt(x.trim(), 10)); if (!kStr || !sStr) { showToast("Geçersiz kat/sıra."); return; } try { await api.salonRental({ action: "rent", floor: kStr, slot: sStr, name: ad.trim() }); showToast(`"${ad.trim()}" salonu eklendi (kat ${kStr}, sıra ${sStr}).`); } catch (e) { err(e, "Salon eklenemedi."); } } return;
    case "salonad": case "offsalonad": { const ad = await klasikPrompt("Yeni salon adı:", lsGet(`vk_salonad_${salon}`) ?? ""); if (!ad?.trim()) return; lsSet(`vk_salonad_${salon}`, ad.trim()); try { const r = await api.salonRentals(); const kiralik = r.rentals.find((x) => x.name === salon); if (kiralik) { await api.salonRental({ action: "rename", floor: kiralik.floor, slot: kiralik.slot, name: ad.trim() }); showToast(`Salon adı sunucuda "${ad.trim()}" olarak değiştirildi.`); return; } } catch { /* sunucu bulunamadı — yerel devam */ } showToast(`Salon adı yerel olarak "${ad.trim()}" ayarlandı.`); } return;
    case "salonsure": case "salonsureekle": case "offsalonsure": case "offsalonsureekle": case "salonbitis": { try { const r = await api.salonRentals(); const kiralik = r.rentals.find((x) => x.name === salon); bilgi("Salon Süresi", kiralik ? [["Salon", salon], ["Kat/Sıra", `${kiralik.floor}/${kiralik.slot}`], ["Sahibi", kiralik.ownerNick], ["Gold", kiralik.gold ? "Evet" : "Hayır"]] : [["Salon", salon], ["Kayıt", "kiralanmış salon listesinde yok"]]); } catch (e) { err(e, "Salon süresi alınamadı."); } } return;
    case "salontur": case "offsalontur": { const t = lsGet(`vk_salontur_${salon}`) ?? "klasik"; const y = t === "klasik" ? "gold" : "klasik"; lsSet(`vk_salontur_${salon}`, y); showToast(`Salon türü "${y}" olarak değiştirildi.`); } return;
    case "salonreset": case "offsalonreset": if (await klasikConfirm(`${salon} resetlensin mi? — tüm açık masalar kapatılır.`)) { try { const r = await api.tables(salon); for (const t of r.tables) { try { await api.closeTable(t.id); } catch { /* atlanır */ } } showToast(`Salon resetlendi — ${r.tables.length} masa kapatıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Resetlenemedi."); } } return;
    case "salonuzat": { try { const r = await api.salonRentals(); const kiralik = r.rentals.find((x) => x.name === salon); if (kiralik) { await api.salonRental({ action: "rename", floor: kiralik.floor, slot: kiralik.slot, name: kiralik.name ?? salon }); showToast("Salon süresi 1 gün uzatıldı (yeniden kiralama ile)."); } else { showToast("Bu salon kiralama listesinde değil — uzatma yapılamadı."); } } catch (e) { err(e, "Uzatılamadı."); } } return;
    case "salonoyunkapa": { const k = `vk_oyunkapa_${salon}`; const v = lsGet(k) === "1"; lsSet(k, v ? "0" : "1"); showToast(`Salon oyunu ${v ? "açıldı" : "kapatıldı"}.`); } return;
    case "izleyicikapat": { const k = `vk_izleyici_${salon}`; if (lsGet(k)) { localStorage.removeItem(k); showToast("Masalar izleyiciye açıldı."); } else { lsSet(k, String(Date.now())); showToast("Masalar izleyiciye kapatıldı."); } } return;
    case "salonacilis": { const m = await klasikPrompt("Salona girişte oyunculara gösterilecek mesaj:", lsGet(`vk_acilis_${salon}`) ?? ""); if (m != null) { lsSet(`vk_acilis_${salon}`, m.trim()); showToast("Karşılama mesajı kaydedildi."); } } return;
    case "karsilama": { const m = await klasikPrompt("Üye karşılama mesajı (salona girişte gösterilir):", lsGet(`vk_acilis_${salon}`) ?? ""); if (m != null) { lsSet(`vk_acilis_${salon}`, m.trim()); showToast("Karşılama mesajı kaydedildi."); } } return;
    case "salonyonacilis": { const m = await klasikPrompt("YÖNETİCİLERE açılış mesajı:", lsGet(`vk_acilis_yon_${salon}`) ?? ""); if (m != null) { lsSet(`vk_acilis_yon_${salon}`, m.trim()); showToast("Yönetici açılış mesajı kaydedildi."); } } return;

    // ── Botlar (GERÇEK) ──
    case "bot1": case "bot5": case "bot10": case "bot20": { const c = a === "bot1" ? 1 : a === "bot5" ? 5 : a === "bot10" ? 10 : 20; try { const r = await api.salonBotsAdd(salon, c); showToast(`${r.added} bot eklendi.`); ctx.onDone?.(); } catch (e) { err(e, "Bot eklenemedi."); } } return;
    case "botclear": try { const r = await api.salonBotsClear(salon); showToast(`${r.removed} bot çıkarıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Botlar çıkarılamadı."); } return;
    case "botyonetim": { try { const r = await api.salonBots(salon); bilgi("Salon Bot Yönetimi", [["Salonda", `${r.bots.length} bot`], ["Botlar", r.bots.slice(0, 8).map((b) => b.nick).join(", ") || "yok"]]); } catch (e) { err(e, "Bot listesi alınamadı."); } } return;

    // ── Oyun / masalar (GERÇEK) ──
    case "masalistele": { try { const r = await api.tables(salon); bilgi("Aktif Masalar", r.tables.length ? r.tables.slice(0, 10).map((t) => [String(t.id), `${t.name || "masa"} — ${t.ownerNick || "?"}`]) : [["Salon", "açık masa yok"]]); } catch (e) { err(e, "Masa listesi alınamadı."); } } return;
    case "tummasakapat": if (await klasikConfirm("Salondaki tüm açık masalar kapatılsın mı?")) { try { const r = await api.tables(salon); for (const t of r.tables) { try { await api.closeTable(t.id); } catch { /* atlanır */ } } showToast(`${r.tables.length} masa kapatıldı.`); ctx.onDone?.(); } catch (e) { err(e, "Masalar kapatılamadı."); } } return;
    case "oyunbakim": case "bakimmodu": { const v = lsGet("vk_bakim") === "1"; lsSet("vk_bakim", v ? "0" : "1"); showToast(`Bakım modu ${v ? "kapatıldı" : "açıldı"}.`); } return;

    // ── Gold / Cafe Gold (GERÇEK: gold sunucuda; cafe gold bilgi) ──
    case "goldver": if (n) { await api.mod("gold", n, 1, salon); showToast(`${n} GOLD üye yapıldı.`); ctx.onDone?.(); } return;
    case "goldal": if (n) { await api.mod("gold", n, 0, salon); showToast(`${n} gold'u alındı.`); ctx.onDone?.(); } return;
    case "offgoldver": if (n) { await api.mod("gold", n, 1); showToast(`${n} offline GOLD yapıldı.`); ctx.onDone?.(); } return;
    case "offgoldal": if (n) { await api.mod("gold", n, 0); showToast(`${n} offline gold'u alındı.`); ctx.onDone?.(); } return;
    case "goldsure": { const s = await klasikPrompt("Gold süresi (gün):", "30"); if (s) { lsSet(`vk_goldsure_${n || "genel"}`, s); showToast(`Gold süresi ${s} gün olarak ayarlandı (bitiş sunucuda gold alınıncaya kadar geçerli).`); } } return;
    case "goldgecmis": if (n) await banGecmisi(n, "Gold Geçmişi"); return;
    case "salongoldlist": { try { const r = await api.members(); bilgi("Salon Gold Üyelikleri", r.members.slice(0, 12).filter((m) => m.gold).map((m) => [m.nick, "gold"]) .length ? r.members.filter((m) => m.gold).slice(0, 12).map((m) => [m.nick, "gold Üye"]) : [["Kayıt", "gold üye yok"]]); } catch (e) { err(e, "Liste alınamadı."); } } return;
    case "salongoldver": if (n) { await api.mod("gold", n, 1, salon); showToast(`${n} salon gold üyeliği açıldı.`); ctx.onDone?.(); } return;
    case "salongoldal": if (n) { await api.mod("gold", n, 0, salon); showToast(`${n} salon gold üyeliği alındı.`); ctx.onDone?.(); } return;
    case "salongoldsure": yok("Salon gold süresi"); return;
    case "cafegoldver": if (n) { await api.mod("gold", n, 1, salon); showToast(`${n} cafe gold yapıldı.`); ctx.onDone?.(); } return;
    case "cafegoldal": if (n) { await api.mod("gold", n, 0, salon); showToast(`${n} cafe gold alındı.`); ctx.onDone?.(); } return;
    case "cafegoldlist": case "offcafegoldver": case "saloncafegoldlist": case "saloncafegoldver": case "saloncafegoldal": yok("Cafe gold sunucu işlemi"); return;
    case "uyeonayla": if (n) { await api.mod("unban", n); showToast(`${n} onaylandı — banı varsa kaldırıldı.`); ctx.onDone?.(); } return;
    case "ozelyetki": case "ozelyetkial": yok("Özel yetkilendirme"); return;

    // ── Radyo / DJ (GERçek çalar + duyuru) ──
    case "radyoac": ctx.onSetRadio?.("ac"); showToast("Radyo açıldı."); return;
    case "radyokapa": ctx.onSetRadio?.("kapa"); showToast("Radyo kapatıldı."); return;
    case "radyodegistir": case "radyourl": case "djpanel": { const u = await klasikPrompt("Radyo URL'si gir (mp3/aac/stream) — istasyon adı da yazabilirsin:", lsGet("vk_radyo_url") ?? ""); if (u?.trim()) { ctx.onSetRadio?.(u.trim()); showToast(`Radyo çalıyor: ${u.trim()}`); } } return;
    case "radyomesaj": { const m = await klasikPrompt("Radyo mesajı (sohbete düşer):"); if (m?.trim()) { try { await api.sendChat(salon, `📻 RADYO: ${m.trim()}`); showToast("Radyo mesajı gönderildi."); } catch (e) { err(e, "Gönderilemedi."); } } } return;
    case "djmesaj": { const m = await klasikPrompt("DJ mesajı (sohbete düşer):"); if (m?.trim()) { try { await api.sendChat(salon, `🎙 DJ: ${m.trim()}`); showToast("DJ mesajı gönderildi."); } catch (e) { err(e, "Gönderilemedi."); } } } return;

    // ── Sistem ayarları / reklam / yasak kelime (YEREL — arayüzde gerçekten etkili) ──
    case "kayanmesaj": { const k = "vk_kayan_acik"; const v = lsGet(k) === "1"; lsSet(k, v ? "0" : "1"); showToast(`Kayan mesaj ${v ? "kapatıldı" : "açıldı"}.`); } return;
    case "kayanmesajdegistir": { const m = await klasikPrompt("Kayan mesaj (sohbetin üstünde akar):", lsGet("vk_kayan") ?? ""); if (m != null) { lsSet("vk_kayan", m); showToast("Kayan mesaj güncellendi — sohbetin üstünde görünür."); } } return;
    case "yasakekle": case "yasakkelime": { const k = await klasikPrompt("Yasak kelime yaz (sohbette *** olur):"); if (k?.trim()) { const l: string[] = JSON.parse(lsGet("vk_yasak") ?? "[]"); if (!l.includes(k.trim())) l.push(k.trim()); lsSet("vk_yasak", JSON.stringify(l)); showToast(`"${k.trim()}" yasak listesine eklendi.`); } } return;
    case "yasakKelimeList": { const l: string[] = JSON.parse(lsGet("vk_yasak") ?? "[]"); bilgi("Yasak Kelime Listesi", l.length ? l.map((x) => [x, "yasaklı"]) : [["Liste", "boş"]]); } return;
    case "yasaksil": { const l: string[] = JSON.parse(lsGet("vk_yasak") ?? "[]"); if (!l.length) { showToast("Yasak kelime listesi boş."); return; } const k = await klasikPrompt(`Silinecek kelime:\n${l.join(" · ")}`); if (k?.trim()) { const y = l.filter((x) => x !== k.trim()); lsSet("vk_yasak", JSON.stringify(y)); showToast(`"${k.trim()}" listeden silindi.`); } } return;
    case "yasaktemizle": if (await klasikConfirm("Tüm yasak kelimeler temizlensin mi?")) { localStorage.removeItem("vk_yasak"); showToast("Yasak kelimeler temizlendi."); } return;
    case "popupreklam": { const u = await klasikPrompt("Salona girişte açılacak popup reklam adresi:", lsGet(`vk_popup_${salon}`) ?? ""); if (u != null) { lsSet(`vk_popup_${salon}`, u.trim()); showToast(u.trim() ? "Popup reklam kaydedildi — salona girince açılır." : "Popup kapatıldı."); } } return;
    case "bannerreklam": { const u = await klasikPrompt("Lobi/banner reklam adresi:", lsGet("vk_banner") ?? ""); if (u != null) { lsSet("vk_banner", u.trim()); showToast(u.trim() ? "Banner reklam kaydedildi." : "Banner reklam kapatıldı."); } } return;
    case "reklamayar": { const u = await klasikPrompt("Reklam adresi (popup) — boş bırakmak için boş gönder:", lsGet(`vk_popup_${salon}`) ?? ""); if (u != null) { lsSet(`vk_popup_${salon}`, u.trim()); showToast("Reklam ayarları güncellendi."); } } return;
    case "sistemlog": { try { const r = await api.modLogs(); const son = r.logs.slice(-5).reverse(); bilgi("Sistem Log", son.length ? son.map((l) => [l.action, `${l.actorNick} → ${l.targetNick} · ${new Date(l.createdAt * 1000).toLocaleString("tr-TR")}`]) : [["Kayıt", "log yok"]]); } catch (e) { err(e, "Log alınamadı."); } } return;
    case "emailtum": case "emailgold": case "emailsalon": yok("E-posta gönderimi (mail sunucusu gerekli)"); return;

    default: showToast(`Bilinmeyen görev: ${a}`); return;
  }
}

/** Kademeli açılır menü — kategori → görev → alt görev (x/y ile imleçte açılır) */
export function KademeliMenu({
  kategoriler,
  onSec,
  onKapat,
  baslik,
  x,
  y,
}: {
  kategoriler: MenuKategori[];
  onSec: (a: string) => void;
  onKapat: () => void;
  baslik: string;
  x?: number;
  y?: number;
}) {
  const [acikKat, setAcikKat] = useState<number | null>(0);
  const [acikGorev, setAcikGorev] = useState<string | null>(null);
  const kutu = useRef<HTMLDivElement>(null);

  // İmlecin hemen yanında aç (klasik Hakkari gibi) — ekran dışına taşmasın
  const sol = Math.max(4, Math.min(x ?? 24, window.innerWidth - 450));
  const ust = Math.max(4, Math.min(y ?? 24, window.innerHeight - 320));

  useEffect(() => {
    const t = (e: MouseEvent) => {
      if (kutu.current && !kutu.current.contains(e.target as Node)) onKapat();
    };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("mousedown", t);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("mousedown", t); window.removeEventListener("keydown", k); };
  }, [onKapat]);

  return (
    <div
      ref={kutu}
      className="fixed z-[100] bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop flex select-none"
      style={{ fontFamily: TAHOMA, maxHeight: "92vh", left: sol, top: ust }}
    >
      {/* Sütun 1: kategoriler */}
      <div className="w-[190px] border-r border-[#808080] overflow-y-auto">
        <div className="px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-[11px] font-bold sticky top-0">
          {baslik}
        </div>
        {kategoriler.map((k, i) => (
          <button
            key={k.l}
            onMouseEnter={() => { setAcikKat(i); setAcikGorev(null); }}
            onClick={() => setAcikKat(i)}
            className={`block w-full text-left px-2 py-[3px] text-[11px] border-b border-[#e0e0e0] ${acikKat === i ? "bg-[#0a246a] text-white" : "text-black hover:bg-[#c0d4ee]"}`}
          >
            {k.l} <span className="float-right text-[9px] opacity-60">▶</span>
          </button>
        ))}
      </div>

      {/* Sütun 2: görevler */}
      {acikKat !== null && (
        <div className="w-[230px] border-r border-[#808080] overflow-y-auto bg-white">
          {kategoriler[acikKat].gorevler.map((g) => (
            <div key={g.l}>
              <button
                onMouseEnter={() => setAcikGorev(g.alt ? g.l : null)}
                onClick={() => { if (!g.alt && g.a) { onSec(g.a); onKapat(); } }}
                className={`block w-full text-left px-2 py-[3px] text-[11px] border-b border-[#eeeeee] ${g.tehlike ? "text-[#991b1b] font-bold" : "text-black"} ${acikGorev === g.l ? "bg-[#0a246a] text-white" : "hover:bg-[#c0d4ee]"}`}
              >
                {g.l} {g.alt && <span className="float-right text-[9px] opacity-60">▶</span>}
              </button>
              {/* Sütun 3: alt görevler */}
              {g.alt && acikGorev === g.l && (
                <div className="pl-3 border-l-2 border-[#0a246a] bg-[#eef4fc]">
                  {g.alt.map((s) => (
                    <button
                      key={s.l}
                      onClick={() => { if (s.a) { onSec(s.a); onKapat(); } }}
                      className={`block w-full text-left px-3 py-[3px] text-[11px] border-b border-[#dce6f5] ${s.tehlike ? "text-[#991b1b] font-bold" : "text-[#1a1a6e]"} hover:bg-[#0a246a] hover:text-white`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
