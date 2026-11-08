# veradekorasyon.store — Online Oyun Portalı

101 Okey, Okey, Domino ve Batak salonları, gerçek zamanlı sohbet ve yönetim sistemi.
Teknoloji: **React 18 + TypeScript + Vite + Tailwind CSS**; backend: **Youbase (Hono + D1)**.

Proje mimarisi ve tüm kararlar: [YOUWARE.md](./YOUWARE.md) · FTP yayını detayları: [DEPLOY.md](./DEPLOY.md)

## Gereksinimler

| Ne | Sürüm | Not |
|---|---|---|
| Node.js | 18+ (önerilen 20+) | `node -v` ile kontrol edin |
| npm | Node ile gelir | `npm -v` |
| Python | 3 (yalnız deploy için) | FTP script'i `ftplib` kullanır, kurulum gerektirmez |

## Kurulum (ilk seferde)

```bash
# 1) Proje dosyalarını indirin (Youware'den "Kodu İndir" veya git clone)
# 2) Bağımlılıkları kurun
npm install

# 3) Geliştirme sunucusunu başlatın
npm run dev
```

Tarayıcıda **http://localhost:5173** açın; giriş ekranı görünmüştür.

> Backend zaten bulutta hazır (staging URL kodda tanımlı) — ayrıca sunucu kurmanıza gerek yok.
> İlk kayıt olan üye otomatik **Admin** olur; sonrasında panel + gold üyelik çalışır.

## Admin paneline giriş

- Panel, ayrı bir adres değil: **siteye giriş yaptıktan sonra üst bardaki "Yönetim" butonudur** (Salonlar ve Gold Üyelik'in yanında).
- Buton yalnızca **Site Yetkilisi ve üzeri** kademedeki üyelere görünür (Yetkili → Koordinatör → Yönetici → Admin).
- Veritabanına **kayıt olan ilk üye otomatik Admin** olur. İlk üye sizseniz kendi hesabınızla giriş yapın; "Yönetim" butonu zaten görünecektir.
- Butonu görmüyorsanız hesabınız henüz Deneme/Gold Üye'dir — Admin hesabıyla giriş yapıp **Yönetim → Üye İşlemleri**nden kendi hesabınıza yetki atayın.
- Yetki kademeleri ve panel yetkileri: Yetkili = susturma, Koordinatörü = gold verme, Yönetici = kademe atama, Admin = ban dahil tam yetki (`src/lib/ranks.ts`).

## Sık kullanılan komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (hızlı, canlı yenilemeli) |
| `npm run build` | Üretim derlemesi → `dist/index.html` (her şey tek dosyada) |
| `npm run preview` | Derlenmiş sürümü yerelde önizle |
| `npm run smoke` | Derlanmış sayfayı gerçek headless Chromium'da açıp test eder |
| `npm run deploy` | Build alır + `dist/` içeriğini FTP ile `public_html/`'e yükler |

## Yayına alma (FTP)

1. Proje kökünde `.env` dosyası oluşturun:

   ```env
   FTP_HOST=2.59.117.26
   FTP_USER=ftpkullanici
   FTP_PASS=ftpsifre
   FTP_REMOTE_DIR=public_html/
   ```

2. Tek komut:

   ```bash
   npm run deploy
   ```

3. Siteyi **CTRL+SHIFT+R** ile açıp kontrol edin.

⚠️ **Önemli:** FTP'ye sadece `dist/index.html` yüklenir (build çıktısı). Proje kökündeki `src/main.tsx`'i referans veren `index.html` **asla yüklenmez** — o yalnızca geliştirme şablonudur. Ayrıntı: [DEPLOY.md](./DEPLOY.md).

> `.env` dosyası `.gitignore` içindedir; FTP bilgileriniz depoya karışmaz.

## Proje yapısı

```
src/
├── components/    # Header, ChatPanel, OkeyTile, DominoBone, RankBadge
├── lib/           # okey.ts, domino.ts (oyun motorları + AI), api.ts (backend istemcisi)
├── pages/         # Login, Lobby, Salon, OkeyGame, DominoGame, AdminPanel, Gold
├── store/         # useApp.ts (Zustand oturum durumu)
└── App.tsx        # Rota yönlendirme
scripts/
├── deploy-ftp.py  # Otomatik FTP deploy
└── smoke-test.mjs # Headless Chromium duman testi
backend/           # Youbase (Hono + Drizzle + D1) kaynak kodu
```
