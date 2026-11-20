"""
EEE FEST 2026 - Master Coupon Generation Suite v2.0
Generates:
1. 1,260 Unique 4-character Alphanumeric Coupons (guaranteed letters & numbers)
2. 315-Page High-Precision Printable PDF (4 coupons per A4 page)
   - QR codes for ALL 4 stubs (maroon, black, maroon, blue)
   - Inline 'Cupon No: [CODE]' placement
   - Cut guidelines with ✂ indicators
3. Formatted Master Excel Spreadsheet (EEE_FEST_2026_Coupons.xlsx)
4. Master JSON Database (coupons_db.json) & Standalone JS (coupons_data.js)
5. Admins Database (admins_db.json) & Standalone JS (admins_data.js)
6. Super Admin Settings (settings.json)
"""

import os
import random
import time
import json
import qrcode
from PIL import Image
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_IMG = os.path.join(BASE_DIR, "EEE FEST Cupon - 2026.png")
QR_DIR = os.path.join(BASE_DIR, "qrcodes")
EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
PDF_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons_Printable.pdf")
JSON_PATH = os.path.join(BASE_DIR, "coupons_db.json")
JS_DATA_PATH = os.path.join(BASE_DIR, "coupons_data.js")
ADMINS_JSON_PATH = os.path.join(BASE_DIR, "admins_db.json")
ADMINS_JS_PATH = os.path.join(BASE_DIR, "admins_data.js")
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")
DOCS_DIR = os.path.join(BASE_DIR, "docs")

TOTAL_COUPONS = 1260
COUPONS_PER_PAGE = 4
TOTAL_PAGES = TOTAL_COUPONS // COUPONS_PER_PAGE  # 315 pages

# Unambiguous 32 alphanumeric characters (no 0/O, 1/I)
CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
LETTERS = [c for c in CHARS if c.isalpha()]
DIGITS = [c for c in CHARS if c.isdigit()]

# Colors
MAROON_RGB = (73, 37, 45)
BLACK_RGB = (0, 0, 0)
BLUE_RGB = (44, 84, 129)

MAROON_PDF = (73/255, 37/255, 45/255)
BLACK_PDF = (0.0, 0.0, 0.0)
BLUE_PDF = (44/255, 84/255, 129/255)


def generate_unique_codes(count=1260, seed=2026):
    """Generate unique 4-character alphanumeric codes with letters & digits."""
    random.seed(seed)
    used = set()
    codes = []
    while len(codes) < count:
        c = [random.choice(LETTERS), random.choice(DIGITS), random.choice(CHARS), random.choice(CHARS)]
        random.shuffle(c)
        code = "".join(c)
        if code not in used:
            used.add(code)
            codes.append(code)
    return codes


def generate_qr_images(codes):
    """Generate all 1260 QR code PNG images in each color theme."""
    os.makedirs(QR_DIR, exist_ok=True)
    t0 = time.time()
    print(f"Generating QR code images for {len(codes)} coupons...")

    qr_map = {}
    for idx, code in enumerate(codes, 1):
        # We generate the main maroon QR and color variants
        base_name = f"QR_{idx:04d}_{code}"
        m_file = os.path.join(QR_DIR, f"{base_name}_maroon.png")
        k_file = os.path.join(QR_DIR, f"{base_name}_black.png")
        b_file = os.path.join(QR_DIR, f"{base_name}_blue.png")

        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(code)
        qr.make(fit=True)

        img_m = qr.make_image(fill_color=MAROON_RGB, back_color="white").convert("RGB")
        img_m.save(m_file)

        img_k = qr.make_image(fill_color=BLACK_RGB, back_color="white").convert("RGB")
        img_k.save(k_file)

        img_b = qr.make_image(fill_color=BLUE_RGB, back_color="white").convert("RGB")
        img_b.save(b_file)

        qr_map[code] = {
            "maroon": m_file,
            "black": k_file,
            "blue": b_file,
            "main": f"{base_name}_maroon.png"
        }

        if idx % 300 == 0 or idx == len(codes):
            print(f"  Generated {idx}/{len(codes)} QRs ({time.time()-t0:.1f}s)")

    return qr_map


def build_databases(codes, qr_map):
    """Create master Excel, JSON database, JS data files, admins, and settings."""
    print("Building Master Excel, JSON and JS databases...")
    wb = openpyxl.Workbook()

    ws = wb.active
    ws.title = "EEE FEST Coupons Master"
    ws.views.sheetView[0].showGridLines = True

    header_fill = PatternFill(start_color="49252D", end_color="49252D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    code_font = Font(name="Consolas", size=11, bold=True, color="49252D")
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0")
    )
    alt_fill = PatternFill(start_color="FBF9F9", end_color="FBF9F9", fill_type="solid")

    headers = [
        "SL No",
        "Coupon Code",
        "Raffle Draw Status",
        "Raffle Scanned At",
        "Raffle Scanned By",
        "Lunch Status",
        "Lunch Scanned At",
        "Lunch Scanned By",
        "T-Shirt Status",
        "T-Shirt Scanned At",
        "T-Shirt Scanned By",
        "QR Reference"
    ]

    ws.append(headers)
    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align

    db_records = []

    for idx, code in enumerate(codes, 1):
        qfile = qr_map[code]["main"]
        record = {
            "serial": idx,
            "code": code,
            "qr_data": code,
            "raffle_status": "AVAILABLE",
            "raffle_submitted_at": "",
            "raffle_scanned_by": "",
            "lunch_status": "AVAILABLE",
            "lunch_redeemed_at": "",
            "lunch_scanned_by": "",
            "tshirt_status": "AVAILABLE",
            "tshirt_redeemed_at": "",
            "tshirt_scanned_by": "",
            "qr_file": qfile
        }
        db_records.append(record)

        row_num = idx + 1
        ws.row_dimensions[row_num].height = 20
        row_values = [
            idx,
            code,
            "AVAILABLE",
            "",
            "",
            "AVAILABLE",
            "",
            "",
            "AVAILABLE",
            "",
            "",
            qfile
        ]
        ws.append(row_values)

        is_alt = (idx % 2 == 0)
        for c_idx in range(1, len(row_values) + 1):
            c = ws.cell(row=row_num, column=c_idx)
            c.border = thin_border
            if is_alt:
                c.fill = alt_fill
            if c_idx == 2:
                c.font = code_font
                c.alignment = center_align
            elif c_idx in [1, 3, 6, 9]:
                c.font = data_font
                c.alignment = center_align
            else:
                c.font = data_font
                c.alignment = left_align

    col_widths = {
        "A": 9, "B": 15, "C": 18, "D": 22, "E": 22,
        "F": 15, "G": 22, "H": 22, "I": 15, "J": 22, "K": 22, "L": 26
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    # Summary Sheet
    ws_summary = wb.create_sheet(title="Dashboard Summary")
    ws_summary.views.sheetView[0].showGridLines = True
    ws_summary.column_dimensions["A"].width = 28
    ws_summary.column_dimensions["B"].width = 24

    ws_summary.append(["EEE FEST 2026 - Coupon Statistics", ""])
    ws_summary.cell(row=1, column=1).font = Font(name="Calibri", size=14, bold=True, color="49252D")
    ws_summary.append(["Total Issued Coupons", TOTAL_COUPONS])
    ws_summary.append(["Unique Code Format", "4-char Alphanumeric (Letters & Digits)"])
    ws_summary.append(["Print Format", "4 Coupons per A4 Page"])
    ws_summary.append(["Total Printable Pages", TOTAL_PAGES])
    ws_summary.append(["QR Codes per Coupon", "4 (Raffle 1, Lunch, Raffle 2, T-Shirt)"])
    ws_summary.append(["Total QR Codes Generated", TOTAL_COUPONS * 4])
    ws_summary.append(["Admin Portal Roles", "Super Admin + Multi-Admin"])
    ws_summary.append(["Scanning Permissions", "Super Admin Configurable"])

    for r in range(2, 11):
        ws_summary.cell(row=r, column=1).font = Font(name="Calibri", size=11, bold=True)
        ws_summary.cell(row=r, column=2).font = Font(name="Calibri", size=11)

    try:
        wb.save(EXCEL_PATH)
        print(f"Master Excel saved to: {EXCEL_PATH}")
    except PermissionError:
        print("Warning: EEE_FEST_2026_Coupons.xlsx is currently open in Excel! Attempting to close or save alternate...")
        try:
            import subprocess
            subprocess.run(["taskkill", "/F", "/IM", "excel.exe"], capture_output=True)
            time.sleep(1)
            wb.save(EXCEL_PATH)
            print(f"Master Excel saved to: {EXCEL_PATH}")
        except Exception:
            alt_path = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons_Master.xlsx")
            wb.save(alt_path)
            print(f"Master Excel saved to alternate path: {alt_path}")

    # JSON DB
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(db_records, f, indent=2)

    # Standalone JS Data (allows opening HTML files directly from disk without server!)
    js_content = f"window.INITIAL_COUPONS_DATA = {json.dumps(db_records)};\n"
    with open(JS_DATA_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    # Copy to docs/ for GitHub Pages
    os.makedirs(DOCS_DIR, exist_ok=True)
    with open(os.path.join(DOCS_DIR, "coupons_db.json"), "w", encoding="utf-8") as f:
        json.dump(db_records, f, indent=2)
    with open(os.path.join(DOCS_DIR, "coupons_data.js"), "w", encoding="utf-8") as f:
        f.write(js_content)

    # Admins DB: Super Admin + Initial Admins
    admins_data = [
        {
            "id": "admin_1",
            "name": "Super Admin (Anik Sarker)",
            "email": "admin@eeefest.com",
            "password": "eeefestadmin",
            "role": "superadmin",
            "allowed_sections": ["raffle", "lunch", "tshirt"],
            "created_at": "2026-11-20 08:00:00 AM"
        },
        {
            "id": "admin_2",
            "name": "Raffle Booth Admin",
            "email": "raffle@eeefest.com",
            "password": "fest2026raffle",
            "role": "admin",
            "allowed_sections": ["raffle"],
            "created_at": "2026-11-20 08:00:00 AM"
        },
        {
            "id": "admin_3",
            "name": "Food Booth Admin",
            "email": "lunch@eeefest.com",
            "password": "fest2026lunch",
            "role": "admin",
            "allowed_sections": ["lunch"],
            "created_at": "2026-11-20 08:00:00 AM"
        },
        {
            "id": "admin_4",
            "name": "T-Shirt Booth Admin",
            "email": "tshirt@eeefest.com",
            "password": "fest2026tshirt",
            "role": "admin",
            "allowed_sections": ["tshirt"],
            "created_at": "2026-11-20 08:00:00 AM"
        }
    ]

    with open(ADMINS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(admins_data, f, indent=2)

    admins_js = f"window.INITIAL_ADMINS_DATA = {json.dumps(admins_data)};\n"
    with open(ADMINS_JS_PATH, "w", encoding="utf-8") as f:
        f.write(admins_js)
    with open(os.path.join(DOCS_DIR, "admins_data.js"), "w", encoding="utf-8") as f:
        f.write(admins_js)

    # Super Admin Global Scanning Settings
    settings_data = {
        "enable_raffle": True,
        "enable_lunch": True,
        "enable_tshirt": True,
        "event_name": "DIU EEE FEST 2026",
        "updated_at": "2026-11-20 08:00:00 AM"
    }

    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings_data, f, indent=2)

    settings_js = f"window.INITIAL_SETTINGS_DATA = {json.dumps(settings_data)};\n"
    with open(os.path.join(BASE_DIR, "settings_data.js"), "w", encoding="utf-8") as f:
        f.write(settings_js)
    with open(os.path.join(DOCS_DIR, "settings_data.js"), "w", encoding="utf-8") as f:
        f.write(settings_js)


def build_printable_pdf(codes, qr_map):
    """Compile the complete 315-page printable PDF on A4 paper with pixel-perfect coordinates."""
    print("Compiling 315-page printable PDF...")
    t0 = time.time()
    c = canvas.Canvas(PDF_PATH, pagesize=A4)

    pw, ph = A4
    cw = 565.0
    ch = cw * (1125.0 / 3356.0)  # ~189.4 pt
    scale = cw / 3356.0

    margin_top = 18.0
    gap = (ph - 2 * margin_top - 4 * ch) / 3.0  # ~16.1 pt between coupons
    x0 = (pw - cw) / 2.0  # ~15.14 pt

    # Stubs info: (x_base, text_color_rgb, qr_variant, base_y, end_x)
    stubs_config = [
        (1224, MAROON_PDF, "maroon", 394, 597),   # Stub 1: Raffle 1
        (1755, BLACK_PDF, "black", 356, 599),     # Stub 2: Lunch
        (2285, MAROON_PDF, "maroon", 379, 597),   # Stub 3: Raffle 2
        (2815, BLUE_PDF, "blue", 355, 597),      # Stub 4: T-Shirt
    ]

    qr_pixels = 205
    qr_sz = qr_pixels * scale

    for page_num in range(TOTAL_PAGES):
        start_idx = page_num * COUPONS_PER_PAGE
        end_idx = start_idx + COUPONS_PER_PAGE
        page_codes = codes[start_idx:end_idx]

        for i, code in enumerate(page_codes):
            y0 = ph - margin_top - (i + 1) * ch - i * gap

            # 1. Draw base coupon template
            c.drawImage(TEMPLATE_IMG, x0, y0, width=cw, height=ch)

            # 2. Draw ALL 4 Stubs: Perfectly Centered QR code in right blank space + Inline Coupon Code
            for x_base, col, qr_variant, base_y, end_x in stubs_config:
                qr_file = qr_map[code][qr_variant]

                # Centered in the right blank area / stub width with zero text or border overlap
                qr_x_img = x_base + 265 - qr_pixels // 2
                qr_y_img = 205 - qr_pixels // 2
                qr_x = x0 + qr_x_img * scale
                qr_y = y0 + (1125 - qr_y_img - qr_pixels) * scale
                c.drawImage(qr_file, qr_x, qr_y, width=qr_sz, height=qr_sz)

                # Coupon Code directly inline on the exact same line as 'Cupon No:' (delta = 0px)
                tx = x0 + (x_base + base_y + 1) * scale
                ty = y0 + (end_x + 16) * scale
                c.saveState()
                c.setFillColorRGB(*col)
                c.setFont("Helvetica-Bold", 39 * scale)
                c.translate(tx, ty)
                c.rotate(90)
                c.drawString(0, 0, code)
                c.restoreState()

            # 3. Horizontal cutting guide below coupon (if not last on page)
            if i < 3:
                cut_y = y0 - (gap / 2.0)
                c.saveState()
                c.setDash(4, 4)
                c.setStrokeColorRGB(0.75, 0.75, 0.75)
                c.setLineWidth(0.6)
                c.line(x0 - 8, cut_y, x0 + cw + 8, cut_y)
                c.setFont("Helvetica", 6)
                c.setFillColorRGB(0.5, 0.5, 0.5)
                c.drawString(x0 - 14, cut_y - 2, "✂")
                c.drawString(x0 + cw + 5, cut_y - 2, "✂")
                c.restoreState()

        # Page Footer Info
        first_num = start_idx + 1
        last_num = min(end_idx, TOTAL_COUPONS)
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        footer_text = f"EEE FEST 2026  |  Page {page_num + 1} of {TOTAL_PAGES}  |  Coupons #{first_num:04d} - #{last_num:04d}"
        c.drawCentredString(pw / 2.0, 7.0, footer_text)
        c.restoreState()

        c.showPage()
        if (page_num + 1) % 50 == 0 or (page_num + 1) == TOTAL_PAGES:
            print(f"  Compiled page {page_num + 1}/{TOTAL_PAGES} ({time.time()-t0:.1f}s)")

    c.save()
    pdf_size_mb = os.path.getsize(PDF_PATH) / (1024 * 1024)
    print(f"Printable PDF successfully saved: {PDF_PATH} ({pdf_size_mb:.2f} MB, {time.time()-t0:.1f}s)")


def main():
    print("=" * 60)
    print("EEE FEST 2026 - COUPON GENERATION SUITE v2.0")
    print("=" * 60)
    t_start = time.time()

    codes = generate_unique_codes(TOTAL_COUPONS)
    print(f"Sample generated codes: {codes[:8]} ...")

    qr_map = generate_qr_images(codes)
    build_databases(codes, qr_map)
    build_printable_pdf(codes, qr_map)

    print("=" * 60)
    print(f"ALL ASSETS REGENERATED IN {time.time()-t_start:.1f}s!")
    print(f"1. Excel Database: {EXCEL_PATH}")
    print(f"2. Printable PDF:  {PDF_PATH}")
    print(f"3. JSON Database:  {JSON_PATH}")
    print(f"4. Admins DB:      {ADMINS_JSON_PATH}")
    print(f"5. Settings:       {SETTINGS_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
