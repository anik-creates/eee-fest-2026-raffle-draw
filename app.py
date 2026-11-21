"""
EEE FEST 2026 - Master Verification Portal Backend Suite
Supports:
- Role-based Admin Authentication (Super Admin + Scanners)
- Super Admin Dynamic Section Controls (Toggle Raffle, Lunch, T-Shirt)
- Admin Management (Add/Delete Admins with email, password, role & permissions)
- Real-time Anti-Counterfeit & Duplicate QR Verification
- Real-time Excel (.xlsx) Synchronization
"""

import os
import json
import time
import datetime
from flask import Flask, render_template, request, jsonify, send_file
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "coupons_db.json")
JS_DATA_PATH = os.path.join(BASE_DIR, "coupons_data.js")
ADMINS_JSON_PATH = os.path.join(BASE_DIR, "admins_db.json")
ADMINS_JS_PATH = os.path.join(BASE_DIR, "admins_data.js")
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")
SETTINGS_JS_PATH = os.path.join(BASE_DIR, "settings_data.js")
EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
DOCS_DIR = os.path.join(BASE_DIR, "docs")

app = Flask(__name__, template_folder="templates", static_folder="static")

# In-memory states
coupons_list = []
coupons_by_code = {}
admins_list = []
settings_state = {
    "enable_raffle": True,
    "enable_lunch": True,
    "enable_tshirt": True,
    "event_name": "DIU EEE FEST 2026",
    "updated_at": "2026-11-20 08:00:00 AM"
}
recent_activity = []


def load_all_databases():
    global coupons_list, coupons_by_code, admins_list, settings_state

    # 1. Coupons DB
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            coupons_list = json.load(f)
        coupons_by_code = {item["code"].upper(): item for item in coupons_list}
        print(f"Loaded {len(coupons_list)} coupons from database.")
    else:
        print("Warning: coupons_db.json not found! Please run generate_coupons.py.")

    # 2. Admins DB
    if os.path.exists(ADMINS_JSON_PATH):
        with open(ADMINS_JSON_PATH, "r", encoding="utf-8") as f:
            admins_list = json.load(f)
        print(f"Loaded {len(admins_list)} admins from database.")
    else:
        # Fallback default Super Admin
        admins_list = [
            {
                "id": "admin_1",
                "name": "Super Admin (Anik Sarker)",
                "email": "admin@eeefest.com",
                "password": "eeefestadmin",
                "role": "superadmin",
                "allowed_sections": ["raffle", "lunch", "tshirt"],
                "created_at": "2026-11-20 08:00:00 AM"
            }
        ]
        save_admins_database()

    # 3. Settings
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            settings_state.update(json.load(f))
        print("Loaded system settings.")


def save_coupons_database():
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(coupons_list, f, indent=2)

    # Sync standalone JS files
    js_content = f"window.INITIAL_COUPONS_DATA = {json.dumps(coupons_list)};\n"
    with open(JS_DATA_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    if os.path.exists(DOCS_DIR):
        with open(os.path.join(DOCS_DIR, "coupons_data.js"), "w", encoding="utf-8") as f:
            f.write(js_content)
        with open(os.path.join(DOCS_DIR, "coupons_db.json"), "w", encoding="utf-8") as f:
            json.dump(coupons_list, f, indent=2)


def save_admins_database():
    with open(ADMINS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(admins_list, f, indent=2)

    admins_js = f"window.INITIAL_ADMINS_DATA = {json.dumps(admins_list)};\n"
    with open(ADMINS_JS_PATH, "w", encoding="utf-8") as f:
        f.write(admins_js)
    if os.path.exists(DOCS_DIR):
        with open(os.path.join(DOCS_DIR, "admins_data.js"), "w", encoding="utf-8") as f:
            f.write(admins_js)


def save_settings_database():
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings_state, f, indent=2)

    settings_js = f"window.INITIAL_SETTINGS_DATA = {json.dumps(settings_state)};\n"
    with open(SETTINGS_JS_PATH, "w", encoding="utf-8") as f:
        f.write(settings_js)
    if os.path.exists(DOCS_DIR):
        with open(os.path.join(DOCS_DIR, "settings_data.js"), "w", encoding="utf-8") as f:
            f.write(settings_js)


def sync_excel_row(coupon):
    """Update the corresponding row in Excel spreadsheet in real-time."""
    if not os.path.exists(EXCEL_PATH):
        return
    try:
        wb = openpyxl.load_workbook(EXCEL_PATH)
        ws = wb["EEE FEST Coupons Master"]
        row_num = coupon["serial"] + 1  # 1-based header offset

        # Columns:
        # 1: SL No, 2: Coupon Code, 3: Created At
        # 4: Raffle Draw Status, 5: Raffle Scanned At, 6: Raffle Scanned By
        # 7: Lunch Status, 8: Lunch Scanned At, 9: Lunch Scanned By
        # 10: T-Shirt Status, 11: T-Shirt Scanned At, 12: T-Shirt Scanned By
        ws.cell(row=row_num, column=3, value=coupon.get("created_at", ""))
        ws.cell(row=row_num, column=4, value=coupon.get("raffle_status", "AVAILABLE"))
        ws.cell(row=row_num, column=5, value=coupon.get("raffle_submitted_at", ""))
        ws.cell(row=row_num, column=6, value=coupon.get("raffle_scanned_by", ""))

        ws.cell(row=row_num, column=7, value=coupon.get("lunch_status", "AVAILABLE"))
        ws.cell(row=row_num, column=8, value=coupon.get("lunch_redeemed_at", ""))
        ws.cell(row=row_num, column=9, value=coupon.get("lunch_scanned_by", ""))

        ws.cell(row=row_num, column=10, value=coupon.get("tshirt_status", "AVAILABLE"))
        ws.cell(row=row_num, column=11, value=coupon.get("tshirt_redeemed_at", ""))
        ws.cell(row=row_num, column=12, value=coupon.get("tshirt_scanned_by", ""))

        wb.save(EXCEL_PATH)
    except PermissionError:
        print("Warning: Excel is currently open. Row update skipped for now to avoid lock.")
    except Exception as e:
        print(f"Excel sync error: {e}")


load_all_databases()


@app.route("/")
def index():
    return render_template("index.html")


# ==========================================
# AUTH & ADMIN MANAGEMENT ENDPOINTS
# ==========================================

@app.route("/api/auth/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    admin = next((a for a in admins_list if a.get("email", "").lower() == email), None)
    if not admin or admin.get("password") != password:
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    admin_profile = {
        "id": admin["id"],
        "name": admin["name"],
        "email": admin["email"],
        "role": admin.get("role", "admin"),
        "allowed_sections": admin.get("allowed_sections", ["raffle"])
    }
    return jsonify({
        "success": True,
        "message": f"Welcome back, {admin['name']}!",
        "admin": admin_profile
    })


@app.route("/api/admins", methods=["GET"])
def get_admins():
    # Return admins without raw passwords
    safe_admins = [
        {
            "id": a["id"],
            "name": a["name"],
            "email": a["email"],
            "role": a.get("role", "admin"),
            "allowed_sections": a.get("allowed_sections", []),
            "created_at": a.get("created_at", "")
        }
        for a in admins_list
    ]
    return jsonify({"success": True, "admins": safe_admins})


@app.route("/api/admins", methods=["POST"])
def add_admin():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    allowed_sections = data.get("allowed_sections", ["raffle"])

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required."}), 400

    if any(a.get("email", "").lower() == email for a in admins_list):
        return jsonify({"success": False, "message": f"An admin with email '{email}' already exists."}), 409

    if not isinstance(allowed_sections, list) or len(allowed_sections) == 0:
        allowed_sections = ["raffle"]

    new_admin = {
        "id": f"admin_{int(time.time()*1000)}",
        "name": name,
        "email": email,
        "password": password,
        "role": "admin",
        "allowed_sections": allowed_sections,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
    }

    admins_list.append(new_admin)
    save_admins_database()

    return jsonify({
        "success": True,
        "message": f"Admin '{name}' ({email}) created successfully!",
        "admin": {
            "id": new_admin["id"],
            "name": new_admin["name"],
            "email": new_admin["email"],
            "role": new_admin["role"],
            "allowed_sections": new_admin["allowed_sections"],
            "created_at": new_admin["created_at"]
        }
    })


@app.route("/api/admins/<admin_id>", methods=["DELETE"])
def delete_admin(admin_id):
    global admins_list
    target = next((a for a in admins_list if a.get("id") == admin_id), None)
    if not target:
        return jsonify({"success": False, "message": "Admin not found."}), 404

    if target.get("role") == "superadmin":
        return jsonify({"success": False, "message": "Super Admin account cannot be deleted!"}), 403

    admins_list = [a for a in admins_list if a.get("id") != admin_id]
    save_admins_database()

    return jsonify({"success": True, "message": f"Admin '{target.get('name')}' removed successfully."})


# ==========================================
# SETTINGS ENDPOINTS (SUPER ADMIN CONTROL)
# ==========================================

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify({"success": True, "settings": settings_state})


@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json() or {}
    if "enable_raffle" in data:
        settings_state["enable_raffle"] = bool(data["enable_raffle"])
    if "enable_lunch" in data:
        settings_state["enable_lunch"] = bool(data["enable_lunch"])
    if "enable_tshirt" in data:
        settings_state["enable_tshirt"] = bool(data["enable_tshirt"])

    settings_state["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
    save_settings_database()

    return jsonify({
        "success": True,
        "message": "Scanning section controls updated successfully!",
        "settings": settings_state
    })


# ==========================================
# VERIFICATION & STATS
# ==========================================

@app.route("/api/stats", methods=["GET"])
def get_stats():
    category = request.args.get("category", "raffle").lower()

    total = len(coupons_list)
    if category == "lunch":
        submitted = sum(1 for c in coupons_list if c.get("lunch_status") == "REDEEMED")
    elif category == "tshirt":
        submitted = sum(1 for c in coupons_list if c.get("tshirt_status") == "REDEEMED")
    else:
        submitted = sum(1 for c in coupons_list if c.get("raffle_status") == "SUBMITTED")

    remaining = total - submitted
    percentage = round((submitted / total * 100), 1) if total > 0 else 0

    return jsonify({
        "total": total,
        "submitted": submitted,
        "remaining": remaining,
        "percentage": percentage,
        "settings": settings_state,
        "recent_activity": recent_activity[:15]
    })


@app.route("/api/verify", methods=["POST"])
def verify_coupon():
    data = request.get_json() or {}
    raw_code = data.get("code", "").strip().upper()
    category = data.get("category", "raffle").lower()
    admin_email = data.get("admin_email", "").strip().lower()

    # Extract code if a full URL was scanned
    if "CODE=" in raw_code:
        raw_code = raw_code.split("CODE=")[-1].split("&")[0].strip()
    elif "/" in raw_code:
        raw_code = raw_code.split("/")[-1].strip()

    if not raw_code:
        return jsonify({
            "success": False,
            "status": "INVALID",
            "message": "Empty coupon code received."
        }), 400

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")

    # Determine Category parameters
    if category == "lunch":
        status_key = "lunch_status"
        time_key = "lunch_redeemed_at"
        by_key = "lunch_scanned_by"
        action_name = "Lunch & Drinks"
        claimed_value = "REDEEMED"
        setting_key = "enable_lunch"
    elif category == "tshirt":
        status_key = "tshirt_status"
        time_key = "tshirt_redeemed_at"
        by_key = "tshirt_scanned_by"
        action_name = "T-Shirt"
        claimed_value = "REDEEMED"
        setting_key = "enable_tshirt"
    else:
        category = "raffle"
        status_key = "raffle_status"
        time_key = "raffle_submitted_at"
        by_key = "raffle_scanned_by"
        action_name = "Raffle Draw"
        claimed_value = "SUBMITTED"
        setting_key = "enable_raffle"

    # 1. Super Admin Section Control Check: Is this section active?
    if not settings_state.get(setting_key, True):
        log_entry = {
            "time": timestamp,
            "code": raw_code,
            "status": "DISABLED",
            "category": action_name,
            "message": f"Scan rejected: {action_name} scanning disabled by Super Admin"
        }
        recent_activity.insert(0, log_entry)
        return jsonify({
            "success": False,
            "status": "SECTION_DISABLED",
            "message": f"Scanning for {action_name} is currently DISABLED by the Super Admin."
        })

    # 2. Admin Permission Check: Is this admin allowed to scan this section?
    admin = next((a for a in admins_list if a.get("email", "").lower() == admin_email), None)
    admin_name = admin["name"] if admin else "Admin Desk"
    if admin and admin.get("role") != "superadmin":
        allowed = admin.get("allowed_sections", [])
        if category not in allowed:
            log_entry = {
                "time": timestamp,
                "code": raw_code,
                "status": "DENIED",
                "category": action_name,
                "message": f"Permission denied for admin '{admin_name}'"
            }
            recent_activity.insert(0, log_entry)
            return jsonify({
                "success": False,
                "status": "PERMISSION_DENIED",
                "message": f"ACCESS DENIED: Your admin account ({admin_name}) is only authorized for: {', '.join([s.title() for s in allowed])}."
            })

    # 3. Code Existence Check (Anti-Counterfeit)
    coupon = coupons_by_code.get(raw_code)
    if not coupon:
        log_entry = {
            "time": timestamp,
            "code": raw_code,
            "status": "COUNTERFEIT",
            "category": action_name,
            "message": "Unregistered Code (Potential Counterfeit)"
        }
        recent_activity.insert(0, log_entry)
        return jsonify({
            "success": False,
            "status": "COUNTERFEIT",
            "code": raw_code,
            "message": f"COUNTERFEIT ALERT! Code '{raw_code}' does NOT exist in the official EEE FEST 2026 database."
        })

    # 4. Already Submitted / Duplicate Check
    if coupon.get(status_key) == claimed_value:
        prev_time = coupon.get(time_key, "Earlier")
        prev_by = coupon.get(by_key, "Another Admin")
        log_entry = {
            "time": timestamp,
            "code": raw_code,
            "serial": coupon["serial"],
            "status": "ALREADY_SUBMITTED",
            "category": action_name,
            "message": f"Duplicate scan: Already submitted at {prev_time} by {prev_by}"
        }
        recent_activity.insert(0, log_entry)
        return jsonify({
            "success": False,
            "status": "ALREADY_SUBMITTED",
            "coupon": coupon,
            "message": f"ALREADY SUBMITTED! Coupon #{coupon['serial']:04d} ({raw_code}) was already registered for {action_name} on {prev_time} by {prev_by}. Duplicate entry blocked!"
        })

    # 5. Success: Mark as submitted
    coupon[status_key] = claimed_value
    coupon[time_key] = timestamp
    coupon[by_key] = admin_name

    save_coupons_database()
    sync_excel_row(coupon)

    log_entry = {
        "time": timestamp,
        "code": raw_code,
        "serial": coupon["serial"],
        "status": "SUCCESS",
        "category": action_name,
        "message": f"Verified & redeemed by {admin_name}"
    }
    recent_activity.insert(0, log_entry)

    return jsonify({
        "success": True,
        "status": "SUCCESS",
        "coupon": coupon,
        "message": f"VERIFIED! Coupon #{coupon['serial']:04d} ({raw_code}) successfully registered for {action_name} by {admin_name}."
    })


@app.route("/api/coupons", methods=["GET"])
def list_coupons():
    query = request.args.get("q", "").strip().upper()
    status_filter = request.args.get("status", "all").lower()
    category = request.args.get("category", "raffle").lower()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))

    status_key = f"{category}_status" if category in ["lunch", "tshirt"] else "raffle_status"
    claimed_val = "REDEEMED" if category in ["lunch", "tshirt"] else "SUBMITTED"

    filtered = coupons_list
    if query:
        filtered = [
            c for c in filtered
            if query in c["code"] or query == str(c["serial"]) or query in f"#{c['serial']:04d}"
        ]

    if status_filter == "submitted":
        filtered = [c for c in filtered if c.get(status_key) == claimed_val]
    elif status_filter == "available":
        filtered = [c for c in filtered if c.get(status_key) == "AVAILABLE"]

    total_filtered = len(filtered)
    start = (page - 1) * per_page
    end = start + per_page
    items = filtered[start:end]

    return jsonify({
        "total": total_filtered,
        "page": page,
        "per_page": per_page,
        "items": items
    })


@app.route("/api/reset", methods=["POST"])
def reset_coupon():
    data = request.get_json() or {}
    code = data.get("code", "").strip().upper()
    category = data.get("category", "raffle").lower()

    coupon = coupons_by_code.get(code)
    if not coupon:
        return jsonify({"success": False, "message": "Coupon not found"}), 404

    if category == "lunch":
        coupon["lunch_status"] = "AVAILABLE"
        coupon["lunch_redeemed_at"] = ""
        coupon["lunch_scanned_by"] = ""
    elif category == "tshirt":
        coupon["tshirt_status"] = "AVAILABLE"
        coupon["tshirt_redeemed_at"] = ""
        coupon["tshirt_scanned_by"] = ""
    else:
        coupon["raffle_status"] = "AVAILABLE"
        coupon["raffle_submitted_at"] = ""
        coupon["raffle_scanned_by"] = ""

    save_coupons_database()
    sync_excel_row(coupon)

    return jsonify({"success": True, "message": f"Coupon {code} reset to AVAILABLE"})


@app.route("/api/reset-all", methods=["POST"])
def reset_all_coupons():
    global coupons_list, coupons_by_code
    for c in coupons_list:
        c["raffle_status"] = "AVAILABLE"
        c["raffle_submitted_at"] = ""
        c["raffle_scanned_by"] = ""
        c["lunch_status"] = "AVAILABLE"
        c["lunch_redeemed_at"] = ""
        c["lunch_scanned_by"] = ""
        c["tshirt_status"] = "AVAILABLE"
        c["tshirt_redeemed_at"] = ""
        c["tshirt_scanned_by"] = ""

    save_coupons_database()

    # Reset Master Excel rows
    try:
        import openpyxl
        EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
        if os.path.exists(EXCEL_PATH):
            wb = openpyxl.load_workbook(EXCEL_PATH)
            ws = wb.active
            for row_idx in range(2, ws.max_row + 1):
                ws.cell(row=row_idx, column=3, value="AVAILABLE")
                ws.cell(row=row_idx, column=4, value="")
                ws.cell(row=row_idx, column=5, value="")
                ws.cell(row=row_idx, column=6, value="AVAILABLE")
                ws.cell(row=row_idx, column=7, value="")
                ws.cell(row=row_idx, column=8, value="")
                ws.cell(row=row_idx, column=9, value="AVAILABLE")
                ws.cell(row=row_idx, column=10, value="")
                ws.cell(row=row_idx, column=11, value="")
            wb.save(EXCEL_PATH)
            DOCS_DIR = os.path.join(BASE_DIR, "docs")
            os.makedirs(DOCS_DIR, exist_ok=True)
            import shutil
            shutil.copy2(EXCEL_PATH, os.path.join(DOCS_DIR, "EEE_FEST_2026_Coupons.xlsx"))
    except Exception as ex:
        print(f"Excel reset error: {ex}")

    return jsonify({"success": True, "message": "All coupons successfully reset to AVAILABLE."})


@app.route("/api/manual-coupon", methods=["POST"])
def add_manual_coupon():
    global coupons_list, coupons_by_code
    data = request.get_json() or {}
    code = data.get("code", "").strip().upper()
    serial = data.get("serial")

    if not code:
        return jsonify({"success": False, "message": "Coupon code is required."}), 400
    if code in coupons_by_code:
        return jsonify({"success": False, "message": f"Coupon code {code} already exists in database."}), 409

    if not serial:
        serial = len(coupons_list) + 1
    else:
        serial = int(serial)

    QR_DIR = os.path.join(BASE_DIR, "qrcodes")
    os.makedirs(QR_DIR, exist_ok=True)
    base_name = f"QR_{serial:04d}_{code}"
    m_file = os.path.join(QR_DIR, f"{base_name}_maroon.png")
    k_file = os.path.join(QR_DIR, f"{base_name}_black.png")
    b_file = os.path.join(QR_DIR, f"{base_name}_blue.png")

    try:
        import qrcode
        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(code)
        qr.make(fit=True)
        qr.make_image(fill_color=(73, 37, 45), back_color="white").convert("RGB").save(m_file)
        qr.make_image(fill_color=(0, 0, 0), back_color="white").convert("RGB").save(k_file)
        qr.make_image(fill_color=(44, 84, 129), back_color="white").convert("RGB").save(b_file)
    except Exception as e:
        print(f"Manual QR generation: {e}")

    rec = {
        "serial": serial,
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
        "qr_file": f"{base_name}_maroon.png"
    }
    coupons_list.append(rec)
    coupons_by_code[code] = rec
    save_coupons_database()

    # Append to Master Excel
    try:
        import openpyxl
        EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
        if os.path.exists(EXCEL_PATH):
            wb = openpyxl.load_workbook(EXCEL_PATH)
            ws = wb.active
            ws.append([
                rec["serial"], rec["code"],
                rec["raffle_status"], rec["raffle_submitted_at"], rec["raffle_scanned_by"],
                rec["lunch_status"], rec["lunch_redeemed_at"], rec["lunch_scanned_by"],
                rec["tshirt_status"], rec["tshirt_redeemed_at"], rec["tshirt_scanned_by"],
                rec["qr_file"]
            ])
            wb.save(EXCEL_PATH)
            DOCS_DIR = os.path.join(BASE_DIR, "docs")
            os.makedirs(DOCS_DIR, exist_ok=True)
            import shutil
            shutil.copy2(EXCEL_PATH, os.path.join(DOCS_DIR, "EEE_FEST_2026_Coupons.xlsx"))
    except Exception as ex:
        print(f"Excel manual append: {ex}")

    return jsonify({"success": True, "message": f"Coupon {code} added successfully.", "coupon": rec})


@app.route("/api/delete-all", methods=["POST"])
def delete_all_coupons():
    global coupons_list, coupons_by_code
    data = request.get_json() or {}
    password = data.get("password", "").strip()
    if password != "eeefestadmin":
        return jsonify({"success": False, "message": "Incorrect Super Admin password. Deletion unauthorized."}), 403

    coupons_list = []
    coupons_by_code = {}
    save_coupons_database()

    # Wipe Excel data rows
    try:
        import openpyxl
        EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
        if os.path.exists(EXCEL_PATH):
            wb = openpyxl.load_workbook(EXCEL_PATH)
            ws = wb.active
            if ws.max_row > 1:
                ws.delete_rows(2, ws.max_row)
            wb.save(EXCEL_PATH)
            DOCS_DIR = os.path.join(BASE_DIR, "docs")
            os.makedirs(DOCS_DIR, exist_ok=True)
            import shutil
            shutil.copy2(EXCEL_PATH, os.path.join(DOCS_DIR, "EEE_FEST_2026_Coupons.xlsx"))
    except Exception as ex:
        print(f"Excel deletion: {ex}")

    return jsonify({"success": True, "message": "All coupons have been permanently deleted from database."})


@app.route("/api/coupons/<code_val>", methods=["DELETE"])
def delete_coupon(code_val):
    global coupons_list, coupons_by_code
    clean_code = code_val.strip().upper()
    if clean_code not in coupons_by_code:
        return jsonify({"success": False, "message": "Coupon not found"}), 404

    target = coupons_by_code[clean_code]
    coupons_list = [c for c in coupons_list if c["code"] != clean_code]
    del coupons_by_code[clean_code]

    save_coupons_database()
    return jsonify({"success": True, "message": f"Coupon {clean_code} successfully deleted."})


ADDON_PDF_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons_Addon.pdf")

@app.route("/api/generate-addon", methods=["POST"])
def generate_addon_coupons():
    import random
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    import qrcode

    data = request.get_json() or {}
    count = int(data.get("count", 1300))
    start_from_1 = bool(data.get("start_from_1", False))
    if count < 1:
        count = 4
    if count > 5000:
        count = 5000

    CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    LETTERS = [c for c in CHARS if c.isalpha()]
    DIGITS = [c for c in CHARS if c.isdigit()]

    existing_codes = set(coupons_by_code.keys()) if not start_from_1 else set()
    new_codes = []
    while len(new_codes) < count:
        c = [random.choice(LETTERS), random.choice(DIGITS), random.choice(CHARS), random.choice(CHARS)]
        random.shuffle(c)
        code = "".join(c)
        if code not in existing_codes and code not in new_codes:
            new_codes.append(code)

    start_serial = 1 if start_from_1 else (len(coupons_list) + 1)
    new_records = []
    QR_DIR = os.path.join(BASE_DIR, "qrcodes")
    os.makedirs(QR_DIR, exist_ok=True)

    MAROON_RGB = (73, 37, 45)
    BLACK_RGB = (0, 0, 0)
    BLUE_RGB = (44, 84, 129)
    MAROON_PDF = (73/255, 37/255, 45/255)
    BLACK_PDF = (0.0, 0.0, 0.0)
    BLUE_PDF = (44/255, 84/255, 129/255)

    qr_map = {}
    for idx_offset, code in enumerate(new_codes):
        serial = start_serial + idx_offset
        base_name = f"QR_{serial:04d}_{code}"
        m_file = os.path.join(QR_DIR, f"{base_name}_maroon.png")
        k_file = os.path.join(QR_DIR, f"{base_name}_black.png")
        b_file = os.path.join(QR_DIR, f"{base_name}_blue.png")

        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(code)
        qr.make(fit=True)
        qr.make_image(fill_color=MAROON_RGB, back_color="white").convert("RGB").save(m_file)
        qr.make_image(fill_color=BLACK_RGB, back_color="white").convert("RGB").save(k_file)
        qr.make_image(fill_color=BLUE_RGB, back_color="white").convert("RGB").save(b_file)

        qr_map[code] = {
            "maroon": m_file,
            "black": k_file,
            "blue": b_file,
            "main": f"{base_name}_maroon.png"
        }

        record = {
            "serial": serial,
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
            "qr_file": f"{base_name}_maroon.png"
        }
        coupons_list.append(record)
        coupons_by_code[code] = record
        new_records.append(record)

    save_coupons_database()

    # Append to Master Excel spreadsheet
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")
        if os.path.exists(EXCEL_PATH):
            wb = openpyxl.load_workbook(EXCEL_PATH)
            ws = wb.active
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
            for rec in new_records:
                row_num = ws.max_row + 1
                ws.row_dimensions[row_num].height = 20
                row_values = [
                    rec["serial"],
                    rec["code"],
                    rec.get("raffle_status", "AVAILABLE"),
                    rec.get("raffle_submitted_at", ""),
                    rec.get("raffle_scanned_by", ""),
                    rec.get("lunch_status", "AVAILABLE"),
                    rec.get("lunch_redeemed_at", ""),
                    rec.get("lunch_scanned_by", ""),
                    rec.get("tshirt_status", "AVAILABLE"),
                    rec.get("tshirt_redeemed_at", ""),
                    rec.get("tshirt_scanned_by", ""),
                    rec.get("qr_file", "")
                ]
                ws.append(row_values)
                is_alt = (rec["serial"] % 2 == 0)
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
            wb.save(EXCEL_PATH)
            # Copy to docs/
            import shutil
            DOCS_DIR = os.path.join(BASE_DIR, "docs")
            os.makedirs(DOCS_DIR, exist_ok=True)
            shutil.copy2(EXCEL_PATH, os.path.join(DOCS_DIR, "EEE_FEST_2026_Coupons.xlsx"))
            print(f"Appended {len(new_records)} coupons to {EXCEL_PATH}")
    except Exception as ex:
        print(f"Note on Excel append: {ex}")

    # Compile Addon PDF
    TEMPLATE_IMG = os.path.join(BASE_DIR, "EEE FEST Cupon - 2026.png")
    c = canvas.Canvas(ADDON_PDF_PATH, pagesize=A4)
    pw, ph = A4
    cw = 565.0
    template_w = 4251.0
    template_h = 1425.0
    scale = cw / template_w
    ch = cw * (template_h / template_w)
    margin_top = 18.0
    gap = (ph - 2 * margin_top - 4 * ch) / 3.0
    x0 = (pw - cw) / 2.0

    stubs_config = [
        ("Raffle 1", 1891.5, 265.0, MAROON_PDF, "maroon", 2054.0, 668.0),
        ("Raffle 2", 2554.5, 265.0, MAROON_PDF, "maroon", 2704.0, 673.0),
        ("Lunch",    3217.5, 265.0, BLACK_PDF,  "black",  3339.0, 668.0),
        ("T-Shirt",  3880.5, 265.0, BLUE_PDF,   "blue",   4019.0, 673.0),
    ]
    qr_pixels = 260.0
    qr_sz = qr_pixels * scale

    addon_pages = (len(new_codes) + 3) // 4
    for p in range(addon_pages):
        page_codes = new_codes[p*4 : (p+1)*4]
        for i, code in enumerate(page_codes):
            y0 = ph - margin_top - (i + 1) * ch - i * gap
            c.drawImage(TEMPLATE_IMG, x0, y0, width=cw, height=ch)

            for name, cx, cy, col, qr_variant, base_x, colon_y in stubs_config:
                qr_file = qr_map[code][qr_variant]
                qr_x_img = cx - qr_pixels / 2.0
                qr_y_img = cy - qr_pixels / 2.0
                qr_x = x0 + qr_x_img * scale
                qr_y = y0 + (template_h - qr_y_img - qr_pixels) * scale
                c.drawImage(qr_file, qr_x, qr_y, width=qr_sz, height=qr_sz)

                tx = x0 + base_x * scale
                ty = y0 + (template_h - colon_y + 18.0) * scale
                c.saveState()
                c.setFillColorRGB(*col)
                c.setFont("Helvetica-Bold", 49.4 * scale)
                c.translate(tx, ty)
                c.rotate(90)
                c.drawString(0, 0, code)
                c.restoreState()

            if i < 3:
                cut_y = y0 - (gap / 2.0)
                c.saveState()
                c.setDash(4, 4)
                c.setStrokeColorRGB(0.75, 0.75, 0.75)
                c.setLineWidth(0.6)
                c.line(x0 - 8, cut_y, x0 + cw + 8, cut_y)
                c.restoreState()

        c.showPage()
    c.save()

    return jsonify({
        "success": True,
        "message": f"Generated {count} new coupons (#{start_serial} - #{start_serial+count-1})!",
        "count": count,
        "new_coupons": new_records,
        "pdf_download_url": "/api/download-addon-pdf"
    })


@app.route("/api/download-addon-pdf", methods=["GET"])
def download_addon_pdf():
    if os.path.exists(ADDON_PDF_PATH):
        return send_file(
            ADDON_PDF_PATH,
            as_attachment=True,
            download_name=f"EEE_FEST_2026_Coupons_Addon_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
    return jsonify({"error": "Addon PDF not found"}), 404


@app.route("/api/export-excel", methods=["GET"])
def export_excel():
    if os.path.exists(EXCEL_PATH):
        return send_file(
            EXCEL_PATH,
            as_attachment=True,
            download_name=f"EEE_FEST_2026_Coupons_Master_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
    return jsonify({"error": "Excel file not found"}), 404


if __name__ == "__main__":
    print("=" * 60)
    print("EEE FEST 2026 - Master Verification Portal Server Starting")
    print("Access locally: http://127.0.0.1:5000")
    print("Access from mobile on same Wi-Fi: http://<your-pc-ip>:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
