"""
EEE FEST 2026 - Raffle Draw & Festival Pass Verification Portal
Flask Backend Application
"""

import os
import json
import datetime
from flask import Flask, render_template, request, jsonify, send_file
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "coupons_db.json")
EXCEL_PATH = os.path.join(BASE_DIR, "EEE_FEST_2026_Coupons.xlsx")

app = Flask(__name__, template_folder="templates", static_folder="static")

# In-memory database
coupons_list = []
coupons_by_code = {}
recent_activity = []


def load_database():
    global coupons_list, coupons_by_code
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            coupons_list = json.load(f)
        coupons_by_code = {item["code"].upper(): item for item in coupons_list}
        print(f"Loaded {len(coupons_list)} coupons from database.")
    else:
        print("Warning: coupons_db.json not found! Please run generate_coupons.py first.")


def save_database():
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(coupons_list, f, indent=2)


def sync_excel_row(coupon):
    """Update the corresponding row in Excel spreadsheet in real-time."""
    if not os.path.exists(EXCEL_PATH):
        return
    try:
        wb = openpyxl.load_workbook(EXCEL_PATH)
        ws = wb["EEE FEST Coupons Master"]
        row_num = coupon["serial"] + 1  # 1-based header offset
        
        ws.cell(row=row_num, column=4, value=coupon.get("raffle_status", "AVAILABLE"))
        ws.cell(row=row_num, column=5, value=coupon.get("raffle_submitted_at", ""))
        ws.cell(row=row_num, column=6, value=coupon.get("lunch_status", "AVAILABLE"))
        ws.cell(row=row_num, column=7, value=coupon.get("lunch_redeemed_at", ""))
        ws.cell(row=row_num, column=8, value=coupon.get("tshirt_status", "AVAILABLE"))
        ws.cell(row=row_num, column=9, value=coupon.get("tshirt_redeemed_at", ""))
        
        wb.save(EXCEL_PATH)
    except Exception as e:
        print(f"Excel sync error: {e}")


load_database()


@app.route("/")
def index():
    return render_template("index.html")


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
        "recent_activity": recent_activity[:15]
    })


@app.route("/api/verify", methods=["POST"])
def verify_coupon():
    data = request.get_json() or {}
    raw_code = data.get("code", "").strip().upper()
    category = data.get("category", "raffle").lower()

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

    # 1. Check if coupon code exists in database
    coupon = coupons_by_code.get(raw_code)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")

    if not coupon:
        log_entry = {
            "time": timestamp,
            "code": raw_code,
            "status": "COUNTERFEIT",
            "category": category.upper(),
            "message": "Unregistered Code (Potential Counterfeit)"
        }
        recent_activity.insert(0, log_entry)
        return jsonify({
            "success": False,
            "status": "COUNTERFEIT",
            "code": raw_code,
            "message": f"COUNTERFEIT ALERT! Code '{raw_code}' does NOT exist in the official EEE FEST 2026 database."
        })

    # 2. Check category submission status
    if category == "lunch":
        status_key = "lunch_status"
        time_key = "lunch_redeemed_at"
        action_name = "Lunch & Drinks"
        claimed_value = "REDEEMED"
    elif category == "tshirt":
        status_key = "tshirt_status"
        time_key = "tshirt_redeemed_at"
        action_name = "T-Shirt"
        claimed_value = "REDEEMED"
    else:
        status_key = "raffle_status"
        time_key = "raffle_submitted_at"
        action_name = "Raffle Draw"
        claimed_value = "SUBMITTED"

    # Already submitted check
    if coupon.get(status_key) == claimed_value:
        prev_time = coupon.get(time_key, "Earlier")
        log_entry = {
            "time": timestamp,
            "code": raw_code,
            "serial": coupon["serial"],
            "status": "ALREADY_SUBMITTED",
            "category": action_name,
            "message": f"Duplicate scan: Already submitted at {prev_time}"
        }
        recent_activity.insert(0, log_entry)
        return jsonify({
            "success": False,
            "status": "ALREADY_SUBMITTED",
            "coupon": coupon,
            "message": f"ALREADY SUBMITTED! Coupon #{coupon['serial']:04d} ({raw_code}) was already registered for {action_name} on {prev_time}. Duplicate / counterfeit entry detected!"
        })

    # Valid and not yet submitted: Mark as submitted!
    coupon[status_key] = claimed_value
    coupon[time_key] = timestamp

    # Save to JSON and sync Excel
    save_database()
    sync_excel_row(coupon)

    log_entry = {
        "time": timestamp,
        "code": raw_code,
        "serial": coupon["serial"],
        "status": "SUCCESS",
        "category": action_name,
        "message": f"Successfully verified & registered ({action_name})"
    }
    recent_activity.insert(0, log_entry)

    return jsonify({
        "success": True,
        "status": "SUCCESS",
        "coupon": coupon,
        "message": f"SUCCESS! Coupon #{coupon['serial']:04d} ({raw_code}) verified & successfully registered for {action_name}."
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
    elif category == "tshirt":
        coupon["tshirt_status"] = "AVAILABLE"
        coupon["tshirt_redeemed_at"] = ""
    else:
        coupon["raffle_status"] = "AVAILABLE"
        coupon["raffle_submitted_at"] = ""

    save_database()
    sync_excel_row(coupon)

    return jsonify({"success": True, "message": f"Coupon {code} reset to AVAILABLE"})


@app.route("/api/export-excel", methods=["GET"])
def export_excel():
    if os.path.exists(EXCEL_PATH):
        return send_file(
            EXCEL_PATH,
            as_attachment=True,
            download_name=f"EEE_FEST_2026_Coupons_Updated_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
    return jsonify({"error": "Excel file not found"}), 404


if __name__ == "__main__":
    # Host on all interfaces so phones on the same Wi-Fi can connect
    print("=" * 60)
    print("EEE FEST 2026 - Verification Portal Server Starting")
    print("Access locally: http://localhost:5000")
    print("Access from mobile on same Wi-Fi: http://<your-pc-ip>:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
