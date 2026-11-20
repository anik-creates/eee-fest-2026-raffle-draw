# EEE FEST 2026 - Master Verification & Management Portal Suite

Official coupon generation, printable batch compilation, and anti-counterfeit QR code verification system designed for **EEE FEST 2026**, organized by the **Department of Electrical & Electronic Engineering (EEE)** at **Daffodil International University (DIU)**.

System Architect & Developer: **Anik Sarker**

---

## Live Deployments & Access

* **Vercel Cloud Production**: [https://eeefest.vercel.app](https://eeefest.vercel.app)
* **GitHub Pages Mirror**: [https://anik-creates.github.io/eee-fest-2026-raffle-draw/](https://anik-creates.github.io/eee-fest-2026-raffle-draw/)
* **Local Offline Launcher (Zero Python required)**: Double-click `open_offline_portal.bat` or open `index.html` in any browser.
* **Local Python Server (Live Excel Sync)**: Double-click `start_server.bat` (serves on `http://127.0.0.1:5000`).

---

## Key Features & Architecture

### 1. High-Precision Printable Batch PDF (`EEE_FEST_2026_Coupons_Printable.pdf`)
* **1,260 Cryptographically Unique Coupons**:
  * 4-character alphanumeric codes with guaranteed mix of letters and digits.
  * Zero ambiguous characters (`0/O`, `1/I` excluded).
* **4 Tear-off Stubs per Coupon with Color-Coded QR Codes**:
  * **Stub 1: Raffle Draw (Participant Copy)** - Festival Maroon QR code
  * **Stub 2: Lunch & Drinks (Food Distribution)** - High-Contrast Black QR code
  * **Stub 3: Raffle Draw (Drop Box Copy)** - Festival Maroon QR code
  * **Stub 4: T-Shirt (Merchandise Distribution)** - Navy Blue QR code
* **Pixel-Perfect Alignment**:
  * `Cupon No:` and the coupon code are printed on the **exact same horizontal line**: `Cupon No: D78G`.
  * The QR code is placed **directly beside the coupon code**, inside the ticket border, with zero text collision.
* Exactly **4 coupons per A4 portrait page** (315 pages total) with cutting guidelines and scissors markers.

### 2. Multi-Role Admin & Super Admin System
* **Super Admin Control Deck**:
  * **Live Scanning Controls**: Toggle switches to activate or pause scanning for any section (**Raffle Draw**, **Lunch & Drinks**, **T-Shirt**).
  * **Admin Management Portal**: Add new admins by providing **Full Name**, **Email Address**, **Password**, and checking their **Authorized Scanning Sections**.
  * **Dynamic Coupon Generation**: Super Admin can generate additional batches of coupons (4, 8, 12, 16, 20...) on the fly. The new codes are automatically added to the database and a printable PDF is compiled and downloaded instantly.
* **Strict Admin Permission Enforcement**:
  * If the Super Admin assigns an admin only **T-Shirt**, that admin can **ONLY scan for T-Shirt**.
  * All other sections are locked with `UNAUTHORIZED` indicators.
  * Any attempt to scan for a non-permitted category is rejected with: `ACCESS DENIED: Your admin account is only authorized to scan for [Section].`
* **Real-Time Duplicate Prevention**:
  * Once a coupon stub is redeemed/submitted, any subsequent scan of that same code is blocked:
    `DUPLICATE ENTRY DETECTED: Coupon #[SL] ([CODE]) was already registered for [SECTION] on [TIMESTAMP] by [ADMIN]. Duplicate entry blocked!`
* **Reset & Delete Entry Controls**:
  * Verification status can be reset back to `AVAILABLE` directly from the result card or master table.
  * Individual coupons can be permanently deleted with confirmation.

### 3. Firebase Cloud & Offline Dual Runtime
* **Firebase Firestore Cloud Database (`fest2026-35ba3`)**:
  * Real-time synchronization of coupons, admin accounts, scanning settings, and audit logs across all connected devices.
* **Offline Dual Runtime**:
  * Local storage fallback ensures 100% zero-latency operation even during internet outages or offline events.
  * Real-time Excel sheet synchronization (`EEE_FEST_2026_Coupons.xlsx`) when running with the local Flask server.

---

## Default Admin Credentials

| Role | Name | Email | Password | Allowed Sections |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Anik Sarker | `admin@eeefest.com` | `eeefestadmin` | **All Sections** + Admin Controls |
| **Raffle Admin** | Raffle Booth | `raffle@eeefest.com` | `fest2026raffle` | Raffle Draw |
| **Food Admin** | Lunch Booth | `lunch@eeefest.com` | `fest2026lunch` | Lunch & Drinks |
| **T-Shirt Admin** | Merchandise Booth | `tshirt@eeefest.com` | `fest2026tshirt` | T-Shirt Distribution |

---

## Repository Structure

```text
├── EEE FEST  Cupon - 2026.png            # Master Canva design template (2909x975)
├── EEE_FEST_2026_Coupons_Printable.pdf    # Complete 315-page printable PDF (4 per A4 page)
├── EEE_FEST_2026_Coupons.xlsx            # Master Excel spreadsheet (auto-syncing)
├── eee_fest_logo.png                     # Transparent high-res navbar logo
├── index.html                            # Root portal entrypoint (Vercel deployment)
├── style.css                             # Professional stylesheet (zero emojis, mobile friendly)
├── app.js                                # Frontend engine (Firebase sync + Web Audio + QR scanner)
├── coupons_db.json                       # Master JSON database of all 1,260 coupons
├── coupons_data.js                       # Standalone offline coupons data
├── admins_db.json                        # Master admin accounts database
├── admins_data.js                        # Standalone offline admins data
├── settings.json                         # Global scanning toggles config
├── settings_data.js                      # Standalone offline settings data
├── vercel.json                           # Vercel deployment configuration
├── generate_coupons.py                   # Automated batch generator suite v2.0
├── app.py                                # Flask backend application & verification API
├── start_server.bat                      # One-click Windows local server launcher
├── open_offline_portal.bat               # One-click offline browser launcher
├── qrcodes/                              # 1,260 QR codes (color-themed variants)
├── templates/
│   └── index.html                        # Flask template
├── static/
│   ├── css/style.css                     # Static stylesheet
│   └── js/app.js                         # Static engine
└── docs/                                 # GitHub Pages deployment directory
    ├── index.html
    ├── style.css
    ├── app.js
    ├── eee_fest_logo.png
    ├── coupons_db.json
    ├── coupons_data.js
    ├── admins_data.js
    └── settings_data.js
```

---

## Printing Instructions

1. Open `EEE_FEST_2026_Coupons_Printable.pdf` in Adobe Acrobat or any modern PDF viewer.
2. Select **Paper Size: A4**.
3. Set **Scale to 100% / Actual Size** (do not select "Fit to Printable Area").
4. Print in high quality on 150-250 GSM paper or cardstock.
5. Cut along the dashed horizontal lines marked with cut indicators to produce 4 coupons per sheet.

---

## Credits

* **Organized by**: Department of Electrical & Electronic Engineering (EEE), Daffodil International University (DIU)
* **System Design & Development**: Anik Sarker
