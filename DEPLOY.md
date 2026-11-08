# FTP ile Doğru Yayınlama Rehberi — "index.html hata veriyor" sorunu

## Sorunun kaynağı (kısa)

Sitede iki farklı `index.html` var:

| Dosya | Ne işe yarar | FTP'ye yüklenir mi? |
|---|---|---|
| **Kök `index.html`** (proje kökünde) | Sadece geliştirme (Vite) için şablondur. İçinde `<script src="/src/main.tsx">` vardır — bu dosya sunucuda bulunmaz. | **Hayır — asla.** |
| **`dist/index.html`** | `npm run build` ile üretilir; tüm CSS + JS tek dosyanın içine gömülüdür (~287 KB). | **Evet — sadece bu.** |

Sunucuya kök `index.html` yüklenirse tarayıcı `/src/main.tsx`'i arar, bulamaz ve **boş sayfa + konsol hatası** oluşur. Şu an canlı sitede duran dosya tam olarak bu hatalı dosyadır.

> Kök `index.html`'yi projede düzeltmeyin/Değiştirmeyin — o dosya doğru; hatalı olan sunucuya yüklenen kopyası. Düzeltilmesi gereken sunucudaki dosyadır.

## Çözüm 1 — Otomatik (önerilen)

1. Proje kökünde `.env` dosyası oluşturun (bilgileri hosting panelinizden, cPanel → FTP Hesapları):

   ```env
   FTP_HOST=ftp.veradekorasyon.store
   FTP_USER=kullanici_adi
   FTP_PASS=sifre
   FTP_REMOTE_DIR=public_html/
   ```

2. Tek komut çalıştırın:

   ```bash
   npm run deploy
   ```

   Bu komut projeyi build eder ve `dist/index.html` + `yw_manifest.json`'ı otomatik olarak `public_html/` içine yükler.

## Çözüm 2 — Manuel (cPanel Dosya Yöneticisi)

1. Bilgisayarda projeyi derleyin:

   ```bash
   npm install
   npm run build
   ```

2. Hosting panelinde **Dosya Yöneticisi → `public_html/`** klasörünü açın.
3. Sunucudaki eski `index.html`'yi **silin**.
4. `dist/index.html` dosyasını (yaklaşık 287 KB) yükleyin — sürükleyip bırakabilirsiniz.
5. `dist/yw_manifest.json`'ı da yükleyebilirsiniz (opsiyonel).

## Çözüm 3 — Manuel (FileZilla vb. FTP istemcisi)

1. FTP istemcisiyle sunucuya bağlanın.
2. Uzak panelde `public_html/` klasörüne girin, eski `index.html`'yi silin.
3. Yerel tarafta projenin **`dist/`** klasörünü açın.
4. `index.html` dosyasını sürükleyip `public_html/` içine atın (FTP'de metin modu değil **binary/otomatik** mod kullanın).

## Doğrulama

- Siteyi **CTRL + SHIFT + R** ile (önbelleği atlayarak) açın; giriş ekranı (Nick + Şifre) görünmeli.
- Konsolda `/src/main.tsx ... 404` hatası **olmamalı**.
- İsterseniz bilgisayarda kontrol edin: `npm run smoke` — derlenmiş sayfanın gerçekten açıldığını headless Chromium ile test eder.

## Sık yapılan hatalar

- ❌ Kök `index.html`'yi yüklemek → boş sayfa (bu sorun).
- ❌ `dist/` klasörünü değil, projenin kökünü FTP'ye atmak → aynı sorun.
- ❌ Eski tarayıcı önbelleği → dosya doğru yüklendiği hâlde eski sayfa görünür; CTRL+SHIFT+R ile test edin.
- ❌ Yanlış klasör (`public_html` yerine alt klasör) → site alt dizinde açılır, kökte 404 verir.
