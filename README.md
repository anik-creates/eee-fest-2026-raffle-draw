# EEE FEST 2026 — Raffle Draw & Festival Pass Suite 🎟️⚡

Official coupon generation, printable batch compilation, and anti-counterfeit QR code verification system designed for **EEE FEST 2026**, organized by the **Department of Electrical & Electronic Engineering (EEE)** at **Daffodil International University (DIU)**.

---

## 🌟 Overview & Key Features

1. **1,260 Unique Cryptographic Coupons**:
   - Each coupon has a unique 4-character alphanumeric code (e.g. `D78G`, `H92U`, `Z9D2`) guaranteeing both letters and digits, with zero ambiguous characters (`0/O`, `1/I` removed).
   - Each coupon contains **4 tear-off stubs** with identical matching codes:
     - **Stub 1**: `RAFFLE DRAW` (Participant copy) — Includes festival maroon QR code
     - **Stub 2**: `LUNCH & DRINKS` (Food booth copy) — Includes matching black coupon number
     - **Stub 3**: `RAFFLE DRAW` (Drop box copy) — Includes festival maroon QR code
     - **Stub 4**: `T-SHIRT` (Merchandise booth copy) — Includes matching blue coupon number

2. **315-Page High-Precision Printable PDF (`EEE_FEST_2026_Coupons_Printable.pdf`)**:
   - Exactly **4 coupons per A4 portrait page** (1,260 coupons ÷ 4 = 315 pages).
   - High-resolution 300 DPI raster backdrop with vector text and sharp vector-aligned QR codes.
   - Clean dashed cutting guidelines with scissors indicators (`✂`) for fast cutting with a guillotine or paper trimmer.
   - Page numbering and coupon range markers on every page (e.g. `Page 1 of 315 | Coupons #0001 - #0004`).

3. **Master Excel Database (`EEE_FEST_2026_Coupons.xlsx`)**:
   - Formatted Excel sheet tracking Serial Number, Coupon Code, QR Data, Raffle Status, Submission Timestamps, Lunch Status, T-Shirt Status, and QR file references.
   - Includes an executive Summary Dashboard.
   - **Real-Time Two-Way Sync**: When coupons are scanned and submitted on the web portal, the Excel sheet is automatically updated in real-time!

4. **Live Anti-Counterfeit Verification Portal**:
   - **Live Camera Scanner**: High-speed camera scanning powered by `html5-qrcode` for mobile phones, tablets, and laptops.
   - **Multi-Camera & Torch Support**: Flip between front/rear cameras and scan under low-light festival conditions.
   - **Manual Code Entry**: Fast typing fallback with auto-uppercase and instant keyboard submission.
   - **Three-Tier Verification Protection**:
     - 🟢 **VALID & SUBMITTED**: Green badge, audio chime, marks ticket as registered with exact timestamp.
     - 🟡 **DUPLICATE / ALREADY SUBMITTED**: Warning buzzer, alerts admin with previous submission timestamp to prevent duplicate or reused stubs.
     - 🔴 **COUNTERFEIT ALERT**: Alarm sound, flags codes not present in the official 1,260 database.
   - **Live Audit Feed & Live Statistics**: Real-time counter of total issued (1,260), claimed, and remaining unsubmitted.
   - **Live Table & Instant Search**: Filter by status and search instantly by code or serial number.

5. **Dual Deployment Modes**:
   - **Local Server (`app.py` / `start_server.bat`)**: Full Python Flask backend running on `http://localhost:5000` with direct live Excel updates.
   - **GitHub Pages / Standalone Cloud (`docs/`)**: Client-side version that runs anywhere from a browser with `localStorage` state persistence.

---

## 📁 Repository Structure

```text
├── EEE FEST  Cupon - 2026.png            # Master Canva design template (2909x975)
├── EEE_FEST_2026_Coupons_Printable.pdf    # Complete 315-page printable PDF (4 per A4 page)
├── EEE_FEST_2026_Coupons.xlsx            # Master Excel spreadsheet (auto-syncing)
├── coupons_db.json                       # Master JSON database of all 1,260 coupons
├── generate_coupons.py                   # Automated batch generator script
├── app.py                                # Flask web application & verification API
├── start_server.bat                      # One-click Windows launcher
├── qrcodes/                              # 1,260 high-res QR code PNG images
├── templates/
│   └── index.html                        # Verification portal frontend template
├── static/
│   ├── css/style.css                     # Neon cyberpunk festival stylesheet
│   └── js/app.js                         # Web Audio API & QR scanner engine
└── docs/                                 # GitHub Pages standalone deployment
    ├── index.html
    ├── style.css
    ├── app.js
    └── coupons_db.json
```

---

## 🚀 Quick Start Guide

### 1. Run the Local Verification Server (Windows)
Double-click `start_server.bat` or run:

```bash
python app.py
```

Open your browser at `http://localhost:5000`.

To connect from other mobile phones or tablets at the registration booth on the same local Wi-Fi network:
```text
http://<YOUR-PC-LOCAL-IP>:5000
```

### 2. Regenerate Coupons (Optional)
If you ever want to regenerate all 1,260 coupons, Excel, QRs, and the PDF:
```bash
python generate_coupons.py
```

---

## 🖨️ Printing Instructions

1. Open `EEE_FEST_2026_Coupons_Printable.pdf` in Adobe Acrobat or any modern PDF viewer.
2. Select **Paper Size: A4**.
3. Set **Scale to 100% / Actual Size** (do NOT use "Fit to Printable Area").
4. Print in high quality on 150–250 GSM paper or cardstock.
5. Cut along the dashed horizontal lines marked with `✂` to yield 4 crisp coupons per sheet.

---

## 👨‍💻 Author & Credits

- **Organized by**: Department of EEE, Daffodil International University (DIU)
- **Design & System Development**: Anik Sarker
