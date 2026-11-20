# EEE FEST 2026 — Raffle Draw & Festival Pass Suite 🎟️⚡

Official coupon generation, printable batch compilation, and anti-counterfeit QR code verification system designed for **EEE FEST 2026**, organized by the **Department of Electrical & Electronic Engineering (EEE)** at **Daffodil International University (DIU)**.

Developed by **Anik Sarker**.

---

## 🌟 Key Updates & Features (v2.0)

1. **1,260 Unique Cryptographic Coupons**:
   - Each coupon has a unique 4-character alphanumeric code (e.g. `D78G`, `H92U`, `Z9D2`) guaranteeing both letters and digits, with zero ambiguous characters (`0/O`, `1/I` removed).
   - **4 Tear-off Stubs per Coupon** — Each stub now has **both a dedicated QR code and an inline coupon number**:
     - **Stub 1**: `RAFFLE DRAW` (Participant copy) — Festival Maroon QR code + inline code (`Cupon No: D78G`)
     - **Stub 2**: `LUNCH & DRINKS` (Food booth copy) — High-contrast Black QR code + inline code (`Cupon No: D78G`)
     - **Stub 3**: `RAFFLE DRAW` (Drop box copy) — Festival Maroon QR code + inline code (`Cupon No: D78G`)
     - **Stub 4**: `T-SHIRT` (Merchandise booth copy) — Navy Blue QR code + inline code (`Cupon No: D78G`)
   - **Pixel-Perfect Inline Alignment**: The coupon number is printed directly inline with the colon of `Cupon No:` with zero text overlap.

2. **315-Page High-Precision Printable PDF (`EEE_FEST_2026_Coupons_Printable.pdf`)**:
   - Exactly **4 coupons per A4 portrait page** (1,260 coupons ÷ 4 = 315 pages).
   - Vector-crisp text and sharp QR codes on a high-resolution 300 DPI Canva template.
   - Clean dashed cutting guidelines with scissors indicators (`✂`) for rapid trimming.
   - Running footer with page numbering and coupon range markers (e.g. `Page 1 of 315 | Coupons #0001 - #0004`).

3. **Multi-Role Admin & Super Admin System**:
   - **Super Admin Deck (`admin@eeefest.com` / `admin2026`)**:
     - **Live Scanning Controls**: Toggle switches to activate or pause scanning for any section (**Raffle Draw**, **Lunch & Drinks**, **T-Shirt**).
     - **Admin Management Portal**: Add new admins by entering their **Full Name**, **Email Address**, **Password**, and checking their **Authorized Scanning Sections**.
     - View and manage the roster of all registered booth admins.
   - **Role-Based Scanning Permissions**:
     - Admins can log in and scan only the sections they are authorized for.
     - If an admin attempts to scan an unauthorized section or if a section is disabled by the Super Admin, the scan is blocked with an explanatory alert.
     - Logs record the exact admin name and timestamp for every verified stub.

4. **100% Offline & Dual Deployment Ready**:
   - **Zero-Server Offline Mode**: Double-click `open_offline_portal.bat` or open `docs/index.html` directly in any web browser (`file:///`). It uses embedded offline data (`coupons_data.js`, `admins_data.js`, `settings_data.js`) with `localStorage` state persistence.
   - **Local Flask Server**: Double-click `start_server.bat` or run `python app.py` to start the live server at `http://127.0.0.1:5000` with real-time Excel updates.
   - **Live Cloud (GitHub Pages)**: [https://anik-creates.github.io/eee-fest-2026-raffle-draw/](https://anik-creates.github.io/eee-fest-2026-raffle-draw/)

5. **Master Excel Spreadsheet (`EEE_FEST_2026_Coupons.xlsx`)**:
   - Real-time row-by-row synchronization: updates status, timestamp, and scanning admin in columns for Raffle, Lunch, and T-Shirt.
   - Includes an executive Summary Dashboard sheet.

---

## 🔑 Default Admin Credentials

| Role | Name | Email | Password | Allowed Sections |
| :--- | :--- | :--- | :--- | :--- |
| **👑 Super Admin** | Anik Sarker | `admin@eeefest.com` | `admin2026` | **All Sections** + Admin Controls |
| **🎟️ Raffle Admin** | Raffle Booth | `raffle@eeefest.com` | `fest2026raffle` | Raffle Draw |
| **🍱 Food Admin** | Lunch Booth | `lunch@eeefest.com` | `fest2026lunch` | Lunch & Drinks |
| **👕 T-Shirt Admin** | Merchandise Booth | `tshirt@eeefest.com` | `fest2026tshirt` | T-Shirt Distribution |

> *The Super Admin can create additional admins anytime through the "Manage Admins" button in the portal.*

---

## 📁 Repository Structure

```text
├── EEE FEST  Cupon - 2026.png            # Master Canva design template (2909x975)
├── EEE_FEST_2026_Coupons_Printable.pdf    # Complete 315-page printable PDF (4 per A4 page)
├── EEE_FEST_2026_Coupons.xlsx            # Master Excel spreadsheet (auto-syncing)
├── coupons_db.json                       # Master JSON database of all 1,260 coupons
├── coupons_data.js                       # Standalone offline coupons data
├── admins_db.json                        # Master admin accounts database
├── admins_data.js                        # Standalone offline admins data
├── settings.json                         # Global scanning toggles config
├── settings_data.js                      # Standalone offline settings data
├── generate_coupons.py                   # Automated batch generator suite v2.0
├── app.py                                # Flask backend application & verification API
├── start_server.bat                      # One-click Windows local server launcher
├── open_offline_portal.bat               # One-click offline browser launcher (no Python required)
├── qrcodes/                              # 1,260 QR codes (color-themed variants)
├── templates/
│   └── index.html                        # Verification portal frontend
├── static/
│   ├── css/style.css                     # Neon cyberpunk festival stylesheet
│   └── js/
│       ├── app.js                        # Web Audio API, QR scanner, & dual runtime engine
│       ├── coupons_data.js
│       ├── admins_data.js
│       └── settings_data.js
└── docs/                                 # GitHub Pages deployment directory
    ├── index.html
    ├── style.css
    ├── app.js
    ├── coupons_db.json
    ├── coupons_data.js
    ├── admins_data.js
    └── settings_data.js
```

---

## 🚀 How to Run the Verification Portal

### Method 1: One-Click Offline (No Python Required)
1. Double-click `open_offline_portal.bat` or open `docs/index.html` in your web browser.
2. The entire portal loads instantly with all 1,260 coupons and admin accounts stored locally.

### Method 2: Local Python Server (Real-time Excel Sync)
1. Double-click `start_server.bat` (or run `python app.py`).
2. Open `http://127.0.0.1:5000` in your browser.
3. To connect smartphones and tablets over local Wi-Fi, open `http://<YOUR-PC-IP>:5000`.

### Method 3: Cloud (GitHub Pages)
Visit [https://anik-creates.github.io/eee-fest-2026-raffle-draw/](https://anik-creates.github.io/eee-fest-2026-raffle-draw/).

---

## 🖨️ Printing Instructions

1. Open `EEE_FEST_2026_Coupons_Printable.pdf` in Adobe Acrobat or any modern PDF viewer.
2. Select **Paper Size: A4**.
3. Set **Scale to 100% / Actual Size** (do NOT choose "Fit to Printable Area").
4. Print in high quality on 150–250 GSM paper or cardstock.
5. Cut along the dashed horizontal lines marked with `✂` to produce 4 coupons per sheet.

---

## 👨‍💻 Author & Credits

- **Organized by**: Department of EEE, Daffodil International University (DIU)
- **System Design & Development**: Anik Sarker
