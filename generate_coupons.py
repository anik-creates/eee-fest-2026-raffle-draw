"""
EEE FEST 2026 - Raffle Draw & Festival Pass Coupon Generator
Generates 1,260 unique coupons with:
- 4-character alphanumeric codes (with letters and numbers, zero ambiguous chars)
- Individual QR codes for the 2 Raffle Draw coupon parts
- Master formatted Excel spreadsheet with all details
- Master JSON database for website verification
- 315-page printable PDF (4 coupons per A4 sheet, with cut guides)
"""

import os
import random
import time
import json
import qrcode
from PIL import Image, ImageDraw, ImageFont
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_IMG = os.path.join(BASE_DIR, "EEE FEST  Cupon - 2026.png")
QR_DIR = os.path.join(BASE_DIR, "qrcodes")
EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
PDF_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons_Printable.pdf")
JSON_PATH = os.path.join(BASE_DIR, "coupons_db.json")

TOTAL_COUPONS = 1260
COUPONS_PER_PAGE = 4
TOTAL_PAGES = TOTAL_COUPONS // COUPONS_PER_PAGE  # 315 pages

# Unambiguous 32 alphanumeric characters (no 0/O, 1/I)
CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
LETTERS = [c for c in CHARS if c.isalpha()]
DIGITS = [c for c in CHARS if c.isdigit()]

# Colors
MAROON_RGB = (73, 37, 45)
MAROON_PDF = (73/255, 37/255, 45/255)
BLACK_PDF = (0, 0, 0)
BLUE_PDF = (44/255, 84/255, 129/255)


def generate_unique_codes(count=1260, seed=2026):
    """Generate unique 4-character alphanumeric codes with letters & digits."""
    random.seed(seed)
    used = set()
    codes = []
    while len(codes) < count:
        # Guarantee at least one letter and at least one digit
        c = [random.choice(LETTERS), random.choice(DIGITS), random.choice(CHARS), random.choice(CHARS)]
        random.shuffle(c)
        code = "".join(c)
        if code not in used:
            used.add(code)
            codes.append(code)
    return codes


def generate_qr_images(codes):
    """Generate all 1260 QR code PNG images in festival maroon."""
    os.makedirs(QR_DIR, exist_ok=True)
    qr_paths = []
    print(f"Generating {len(codes)} QR code images...")
    t0 = time.time()
    for idx, code in enumerate(codes, 1):
        filename = f"QR_{idx:04d}_{code}.png"
        filepath = os.path.join(QR_DIR, filename)
        qr = qrcode.QRCode(box_size=4, border=1)
        qr.add_data(code)
        qr.make(fit=True)
        img = qr.make_image(fill_color=MAROON_RGB, back_color="white").convert("RGB")
        img = img.resize((105, 105), Image.Resampling.LANCZOS)
        img.save(filepath, format="PNG")
        qr_paths.append(filepath)
        if idx % 250 == 0 or idx == len(codes):
            print(f"  Generated {idx}/{len(codes)} QRs ({time.time()-t0:.1f}s)")
    return qr_paths


def build_excel_and_json(codes, qr_paths):
    """Create formatted Master Excel spreadsheet and JSON database."""
    print("Building Master Excel spreadsheet and JSON database...")
    wb = openpyxl.Workbook()

    # Sheet 1: Master Coupons Table
    ws = wb.active
    ws.title = "EEE FEST Coupons Master"
    ws.views.sheetView[0].showGridLines = True

    # Styling definitions
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
        "QR Data",
        "Raffle Draw Status",
        "Raffle Submitted At",
        "Lunch Status",
        "Lunch Redeemed At",
        "T-Shirt Status",
        "T-Shirt Redeemed At",
        "QR File Name"
    ]

    ws.append(headers)
    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align

    db_records = []

    for idx, (code, qpath) in enumerate(zip(codes, qr_paths), 1):
        qfile = os.path.basename(qpath)
        record = {
            "serial": idx,
            "code": code,
            "qr_data": code,
            "raffle_status": "AVAILABLE",
            "raffle_submitted_at": "",
            "lunch_status": "AVAILABLE",
            "lunch_redeemed_at": "",
            "tshirt_status": "AVAILABLE",
            "tshirt_redeemed_at": "",
            "qr_file": qfile
        }
        db_records.append(record)

        row_num = idx + 1
        ws.row_dimensions[row_num].height = 20
        row_values = [
            idx,
            code,
            code,
            "AVAILABLE",
            "",
            "AVAILABLE",
            "",
            "AVAILABLE",
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
            elif c_idx in [1, 3, 4, 6, 8]:
                c.font = data_font
                c.alignment = center_align
            else:
                c.font = data_font
                c.alignment = left_align

    # Column widths
    col_widths = {
        "A": 10,  # SL No
        "B": 15,  # Coupon Code
        "C": 15,  # QR Data
        "D": 20,  # Raffle Status
        "E": 24,  # Raffle Submitted At
        "F": 16,  # Lunch Status
        "G": 24,  # Lunch Redeemed At
        "H": 16,  # T-Shirt Status
        "I": 24,  # T-Shirt Redeemed At
        "J": 26   # QR File Name
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    # Sheet 2: Summary Dashboard
    ws_summary = wb.create_sheet(title="Dashboard Summary")
    ws_summary.views.sheetView[0].showGridLines = True
    ws_summary.column_dimensions["A"].width = 25
    ws_summary.column_dimensions["B"].width = 20

    ws_summary.append(["EEE FEST 2026 - Coupon Statistics", ""])
    ws_summary.cell(row=1, column=1).font = Font(name="Calibri", size=14, bold=True, color="49252D")
    ws_summary.append(["Total Issued Coupons", TOTAL_COUPONS])
    ws_summary.append(["Unique Code Format", "4-char Alphanumeric (Random)"])
    ws_summary.append(["Print Format", "4 Coupons per A4 Page"])
    ws_summary.append(["Total Printable Pages", TOTAL_PAGES])
    ws_summary.append(["Raffle Draw QR Count", TOTAL_COUPONS * 2])
    ws_summary.append(["Verification Portal", "Local Web App & GitHub Pages"])
    ws_summary.append(["Counterfeit Protection", "Live Database Anti-Duplicate Check"])

    for r in range(2, 10):
        ws_summary.cell(row=r, column=1).font = Font(name="Calibri", size=11, bold=True)
        ws_summary.cell(row=r, column=2).font = Font(name="Calibri", size=11)

    wb.save(EXCEL_PATH)
    print(f"Master Excel saved to: {EXCEL_PATH}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(db_records, f, indent=2)
    print(f"JSON database saved to: {JSON_PATH}")


def build_printable_pdf(codes, qr_paths):
    """Compile the complete 315-page printable PDF on A4 paper."""
    print("Compiling 315-page printable PDF...")
    t0 = time.time()
    c = canvas.Canvas(PDF_PATH, pagesize=A4)

    pw, ph = A4
    cw = 565.0
    ch = cw * (975.0 / 2909.0)  # ~189.43 pt
    scale = cw / 2909.0

    margin_top = 18.0
    gap = (ph - 2 * margin_top - 4 * ch) / 3.0  # ~16.05 pt between coupons
    x0 = (pw - cw) / 2.0  # ~15.14 pt

    # Stubs info for text: (pixel_x, pixel_y, color_rgb)
    # Rotating 90 deg counter-clockwise in PDF:
    stubs_text_info = [
        (1060 + 297, 350, MAROON_PDF),
        (1520 + 297, 350, BLACK_PDF),
        (1980 + 297, 350, MAROON_PDF),
        (2440 + 297, 350, BLUE_PDF),
    ]

    qr_sz = 105 * scale

    for page_num in range(TOTAL_PAGES):
        start_idx = page_num * COUPONS_PER_PAGE
        end_idx = start_idx + COUPONS_PER_PAGE
        page_codes = codes[start_idx:end_idx]
        page_qrs = qr_paths[start_idx:end_idx]

        for i, (code, qr_file) in enumerate(zip(page_codes, page_qrs)):
            y0 = ph - margin_top - (i + 1) * ch - i * gap

            # 1. Draw base coupon template
            c.drawImage(TEMPLATE_IMG, x0, y0, width=cw, height=ch)

            # 2. Draw 2 QR codes (Stub 1 and Stub 3)
            # Stub 1 QR
            qr1_x = x0 + (1060 + 135) * scale
            qr1_y = y0 + ch - (80 + 105) * scale
            c.drawImage(qr_file, qr1_x, qr1_y, width=qr_sz, height=qr_sz)

            # Stub 3 QR
            qr3_x = x0 + (1980 + 135) * scale
            qr3_y = y0 + ch - (80 + 105) * scale
            c.drawImage(qr_file, qr3_x, qr3_y, width=qr_sz, height=qr_sz)

            # 3. Draw 4 Coupon Numbers
            c.setFont("Helvetica-Bold", 38 * scale)
            for px, py, col in stubs_text_info:
                c.saveState()
                c.setFillColorRGB(*col)
                tx = x0 + px * scale
                ty = y0 + ch - py * scale
                c.translate(tx, ty)
                c.rotate(90)
                c.drawString(0, -2, code)
                c.restoreState()

            # 4. Draw horizontal cutting guide below coupon (if not last on page)
            if i < 3:
                cut_y = y0 - (gap / 2.0)
                c.saveState()
                c.setDash(4, 4)
                c.setStrokeColorRGB(0.75, 0.75, 0.75)
                c.setLineWidth(0.6)
                c.line(x0 - 8, cut_y, x0 + cw + 8, cut_y)
                # Small scissors indicator text
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
    print("EEE FEST 2026 - COUPON GENERATION SUITE")
    print("=" * 60)
    t_start = time.time()

    codes = generate_unique_codes(TOTAL_COUPONS)
    print(f"Sample generated codes: {codes[:8]} ...")

    qr_paths = generate_qr_images(codes)
    build_excel_and_json(codes, qr_paths)
    build_printable_pdf(codes, qr_paths)

    print("=" * 60)
    print(f"ALL ASSETS GENERATED IN {time.time()-t_start:.1f}s!")
    print(f"1. Excel Database: {EXCEL_PATH}")
    print(f"2. Printable PDF:  {PDF_PATH}")
    print(f"3. JSON Database:  {JSON_PATH}")
    print(f"4. QR Codes:       {QR_DIR} ({len(qr_paths)} files)")
    print("=" * 60)


if __name__ == "__main__":
    main()
