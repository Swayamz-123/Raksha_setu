import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 465))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_TO   = os.getenv("EMAIL_TO")

CRISIS_META = {
    "medical":          {"emoji": "🚑", "color": "#dc2626", "label": "Medical Emergency"},
    "accident":         {"emoji": "🚗", "color": "#b45309", "label": "Road Accident"},
    "fire":             {"emoji": "🔥", "color": "#ea580c", "label": "Fire Emergency"},
    "crime":            {"emoji": "🚔", "color": "#7c3aed", "label": "Crime / Threat"},
    "natural_disaster": {"emoji": "⛈️", "color": "#0369a1", "label": "Natural Disaster"},
    "other":            {"emoji": "🆘", "color": "#374151", "label": "Emergency"},
    "none":             {"emoji": "✅", "color": "#10b981", "label": "No Emergency"},
}


def _get_meta(crisis_type):
    return CRISIS_META.get((crisis_type or "other").lower(), CRISIS_META["other"])


def send_emergency_email(recipient_email, emergency_data):
    crisis_type = emergency_data.get("crisisType", "other")
    meta = _get_meta(crisis_type)
    name = emergency_data.get("name", "Unknown")
    intensity = emergency_data.get("intensity", "?")
    flag = emergency_data.get("flag", "Emergency")
    summary = emergency_data.get("emergencyMessage", "")
    model_used = emergency_data.get("modelUsed", "AI")
    maps_link = emergency_data.get("mapsLink", "#")
    lat = emergency_data.get("latitude", "N/A")
    lng = emergency_data.get("longitude", "N/A")
    address = emergency_data.get("address", "N/A")
    phone = emergency_data.get("phone", "N/A")
    emergency_phone = emergency_data.get("emergencyPhone", "N/A")

    print(f"[EMAIL] Sending {crisis_type} alert to {recipient_email}...")

    # Format summary to be more readable (remove "Intensity: X:" prefix if present)
    formatted_summary = summary
    if summary.startswith("Intensity:"):
        parts = summary.split(":", 2)
        if len(parts) >= 3:
            formatted_summary = parts[2].strip()

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:{meta['color']};padding:30px 20px;text-align:center;">
<div style="font-size:48px;margin-bottom:10px;">{meta['emoji']}</div>
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">{meta['label']}</h1>
<p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Emergency Alert System</p>
</td></tr>

<!-- Alert Banner -->
<tr><td style="padding:20px;background:#fff3cd;border-bottom:3px solid #ffc107;">
<p style="margin:0;color:#856404;font-size:15px;font-weight:bold;text-align:center;">
⚠️ EMERGENCY DETECTED - Severity Level: {intensity}/100
</p>
</td></tr>

<!-- Content -->
<tr><td style="padding:30px 20px;">

<h2 style="color:#333;font-size:18px;margin:0 0 20px;border-bottom:2px solid #eee;padding-bottom:10px;">Incident Details</h2>

<table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:25px;">
<tr>
<td style="width:140px;color:#666;font-size:14px;padding:8px 0;"><strong>Type:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{meta['label']}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Status:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{flag}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Person:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{name}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Contact:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{phone}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Emergency Contact:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{emergency_phone}</td>
</tr>
</table>

<h2 style="color:#333;font-size:18px;margin:0 0 15px;border-bottom:2px solid #eee;padding-bottom:10px;">Location Information</h2>

<table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:25px;">
<tr>
<td style="width:140px;color:#666;font-size:14px;padding:8px 0;"><strong>Address:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{address}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Coordinates:</strong></td>
<td style="color:#333;font-size:14px;padding:8px 0;">{lat}, {lng}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px;padding:8px 0;"><strong>Map Link:</strong></td>
<td style="padding:8px 0;"><a href="{maps_link}" style="color:#1a73e8;text-decoration:none;font-size:14px;">View on Google Maps</a></td>
</tr>
</table>

<h2 style="color:#333;font-size:18px;margin:0 0 15px;border-bottom:2px solid #eee;padding-bottom:10px;">Situation Assessment</h2>

<div style="background:#f8f9fa;border-left:4px solid {meta['color']};padding:15px;margin-bottom:25px;">
<p style="margin:0;color:#333;font-size:14px;line-height:1.6;">{formatted_summary}</p>
</div>

<!-- Emergency Numbers -->
<div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:15px;margin-bottom:20px;">
<p style="margin:0 0 10px;color:#1565c0;font-size:14px;font-weight:bold;">Emergency Contact Numbers (India)</p>
<table width="100%" cellpadding="4" cellspacing="0">
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚑 Ambulance</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>102 / 108</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚒 Fire Brigade</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>101</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚔 Police</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>100</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🆘 Emergency Services</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>112</strong></td>
</tr>
</table>
</div>

</td></tr>

<!-- Footer -->
<tr><td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0;">
<p style="margin:0 0 5px;color:#666;font-size:12px;">Raksha Setu Emergency Response System</p>
<p style="margin:0;color:#999;font-size:11px;">This is an automated alert. Please respond immediately.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{meta['emoji']} AI ALERT — {meta['label']} | Intensity {intensity}/100"
    msg["From"] = f'"Raksha Setu Monitor" <{EMAIL_USER}>'
    msg["To"] = recipient_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, recipient_email, msg.as_string())
        print(f"[EMAIL] Alert sent to {recipient_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed: {e}")
        return False
