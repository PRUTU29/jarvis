import os
import sys
import time
import platform
import subprocess
import webbrowser
import threading
import glob
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS

# Initialize Flask App
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Create necessary directories
os.makedirs(os.path.join('static', 'css'), exist_ok=True)
os.makedirs(os.path.join('static', 'js'), exist_ok=True)
os.makedirs(os.path.join('static', 'screenshots'), exist_ok=True)
os.makedirs('templates', exist_ok=True)

# System library imports with safe fallback for cross-platform/non-installed states
try:
    import psutil
except ImportError:
    psutil = None

try:
    import pyautogui
except ImportError:
    pyautogui = None

# Windows Audio Control Imports (pycaw)
has_pycaw = False
try:
    import comtypes
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    from ctypes import cast, POINTER
    has_pycaw = True
except Exception as e:
    print(f"[Warning] Pycaw audio control not fully loaded: {e}.")

# Keyboard global activation hotkeys (safe import)
has_keyboard = False
hotkey_triggered = False

def handle_global_hotkey():
    global hotkey_triggered
    print("[SYSTEM] Global activation hotkey (Ctrl+Shift+J) detected!")
    hotkey_triggered = True
    try:
        webbrowser.open("http://localhost:5000?hotkey=true")
    except Exception as e:
        print(f"Error opening browser via hotkey: {e}")

try:
    import keyboard
    has_keyboard = True
    keyboard.add_hotkey('ctrl+shift+j', handle_global_hotkey)
    print("[SYSTEM] Registered global activation hotkey: Ctrl+Shift+J")
except Exception as e:
    print(f"[Warning] Keyboard hotkey library not fully loaded: {e}.")

# PyWin32 Outlook COM safe imports
has_outlook = False
try:
    import win32com.client
    has_outlook = True
except Exception as e:
    print(f"[Warning] pywin32 not loaded or Outlook not available. Falling back to Mock Mail Aggregator: {e}")


# ==========================================================================
# 0. SECURITY UTILITIES
# ==========================================================================

def is_path_safe(file_path):
    """Validates that a file path is within allowed directories and not a system path."""
    if not file_path:
        return False
    try:
        real_path = os.path.realpath(os.path.abspath(file_path))
    except (ValueError, OSError):
        return False
    
    # Block path traversal patterns
    if '..' in file_path:
        return False
    
    # Allowed root directories
    user_profile = os.environ.get("USERPROFILE", "")
    program_data = os.environ.get("ProgramData", "C:\\ProgramData")
    allowed_roots = [
        os.path.realpath(user_profile),
        os.path.realpath(program_data),
        os.path.realpath(os.environ.get("APPDATA", "")),
    ]
    # Add all drive roots for file browsing (but block system folders)
    
    # Blocked system-critical paths
    blocked_paths = [
        os.path.realpath("C:\\Windows"),
        os.path.realpath("C:\\Windows\\System32"),
        os.path.realpath("C:\\Windows\\SysWOW64"),
    ]
    
    for blocked in blocked_paths:
        if real_path.startswith(blocked):
            return False
    
    return True


# ==========================================================================
# 0b. RATE LIMITING (Lightweight In-Memory)
# ==========================================================================

from collections import defaultdict

class RateLimiter:
    """Simple sliding window rate limiter — no external dependencies."""
    def __init__(self):
        self._requests = defaultdict(list)
    
    def is_allowed(self, key, max_requests, window_seconds=60):
        """Returns True if the request is allowed under the rate limit."""
        now = time.time()
        # Clean old entries outside the window
        self._requests[key] = [t for t in self._requests[key] if now - t < window_seconds]
        if len(self._requests[key]) >= max_requests:
            return False
        self._requests[key].append(now)
        return True

rate_limiter = RateLimiter()


# ==========================================================================
# 1. CORE SYSTEM UTILITIES (STATS & VOLUME & SCREENSHOTS)
# ==========================================================================

def get_system_stats():
    """Gathers CPU, Memory, Disk, and Battery usage status."""
    stats = {
        "cpu": 0,
        "ram": 0,
        "disk": 0,
        "battery": {
            "percent": 100,
            "power_plugged": True,
            "secsleft": -1
        },
        "os": platform.system(),
        "node": platform.node(),
        "uptime": "Unknown"
    }
    
    if psutil:
        try:
            stats["cpu"] = psutil.cpu_percent(interval=None)
            stats["ram"] = psutil.virtual_memory().percent
            stats["disk"] = psutil.disk_usage('C:\\' if platform.system() == 'Windows' else '/').percent
            
            battery = psutil.sensors_battery()
            if battery:
                stats["battery"] = {
                    "percent": battery.percent,
                    "power_plugged": battery.power_plugged,
                    "secsleft": battery.secsleft
                }
            
            boot_time = psutil.boot_time()
            uptime_seconds = time.time() - boot_time
            hours, remainder = divmod(int(uptime_seconds), 3600)
            minutes, seconds = divmod(remainder, 60)
            stats["uptime"] = f"{hours}h {minutes}m"
        except Exception as e:
            print(f"Error gathering stats: {e}")
            
    return stats

def get_volume_windows():
    if not has_pycaw:
        return 50, False
    try:
        comtypes.CoInitialize()
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        current_volume = int(round(volume.GetMasterVolumeLevelScalar() * 100))
        is_muted = bool(volume.GetMute())
        return current_volume, is_muted
    except Exception as e:
        print(f"Error getting volume: {e}")
        return 50, False
    finally:
        try: comtypes.CoUninitialize()
        except: pass

def set_volume_windows(volume_level, mute=None):
    if not has_pycaw:
        return False
    try:
        comtypes.CoInitialize()
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        
        if volume_level is not None:
            volume.SetMasterVolumeLevelScalar(max(0.0, min(1.0, volume_level / 100.0)), None)
            
        if mute is not None:
            volume.SetMute(1 if mute else 0, None)
            
        return True
    except Exception as e:
        print(f"Error setting volume: {e}")
        return False
    finally:
        try: comtypes.CoUninitialize()
        except: pass

def take_screenshot():
    if not pyautogui:
        return False, "pyautogui library not installed"
    try:
        screenshot_dir = os.path.join('static', 'screenshots')
        os.makedirs(screenshot_dir, exist_ok=True)
        screenshot_path = os.path.join(screenshot_dir, 'latest.png')
        screenshot = pyautogui.screenshot()
        screenshot.save(screenshot_path)
        return True, "/static/screenshots/latest.png"
    except Exception as e:
        return False, str(e)


# ==========================================================================
# 2. START MENU WINDOWS APPLICATION SCANNER
# ==========================================================================

# Global app cache
_app_cache = {"apps": [], "timestamp": 0, "ttl": 600}  # 10-min cache

APP_ALIASES = {
    "dolby": "Dolby Access", "dolby atmos": "Dolby Access",
    "amazon music": "Amazon Music", "amazon": "Amazon Music",
    "whatsapp": "WhatsApp", "wa": "WhatsApp",
    "mail": "Outlook", "outlook": "Outlook",
    "spotify": "Spotify", "netflix": "Netflix",
    "teams": "Microsoft Teams", "zoom": "Zoom",
    "vscode": "Visual Studio Code", "code": "Visual Studio Code",
    "word": "Word", "excel": "Excel", "powerpoint": "PowerPoint",
    "discord": "Discord", "telegram": "Telegram",
    "vlc": "VLC media player", "firefox": "Firefox",
    "notepad": "Notepad", "calculator": "Calculator",
    "chrome": "Google Chrome", "edge": "Microsoft Edge",
    "paint": "Paint", "snip": "Snipping Tool",
}

def get_installed_apps():
    """Scans Windows Start Menu, Taskbar, and UWP Store apps with caching."""
    global _app_cache
    
    # Check cache first
    if _app_cache["apps"] and (time.time() - _app_cache["timestamp"]) < _app_cache["ttl"]:
        return _app_cache["apps"]
    
    app_list = []
    
    # Standard Windows Start Menu locations
    scan_paths = []
    
    # 1. System-wide Start Menu Programs
    program_data_menu = os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "Microsoft\\Windows\\Start Menu\\Programs")
    if os.path.exists(program_data_menu):
        scan_paths.append((program_data_menu, "startmenu"))
        
    # 2. User-specific Start Menu Programs
    user_app_data = os.environ.get("APPDATA")
    if user_app_data:
        user_menu = os.path.join(user_app_data, "Microsoft\\Windows\\Start Menu\\Programs")
        if os.path.exists(user_menu):
            scan_paths.append((user_menu, "startmenu"))
    
    # 3. Taskbar pinned shortcuts
    taskbar_path = os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar')
    if os.path.exists(taskbar_path):
        scan_paths.append((taskbar_path, "taskbar"))
            
    seen_apps = set()
    
    for base_path, source in scan_paths:
        try:
            # Recursively find all shortcut files (.lnk)
            for root, dirs, files in os.walk(base_path):
                for f in files:
                    if f.endswith('.lnk'):
                        app_name = f[:-4] # Strip .lnk extension
                        full_path = os.path.join(root, f)
                        
                        # Clean up duplicates or standard system administrative links
                        lower_name = app_name.lower().strip()
                        if lower_name in seen_apps or any(block in lower_name for block in [
                            "uninstall", "readme", "setup", "help", "about", "license", "configure"
                        ]):
                            continue
                            
                        seen_apps.add(lower_name)
                        app_list.append({
                            "name": app_name,
                            "path": full_path,
                            "source": source
                        })
        except Exception as e:
            print(f"Error scanning programs path '{base_path}': {e}")
    
    # 4. Scan UWP/Store apps via PowerShell
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command',
             'Get-StartApps | ConvertTo-Json -Depth 1'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            import json as _json
            uwp_apps = _json.loads(result.stdout)
            if isinstance(uwp_apps, dict): uwp_apps = [uwp_apps]
            for ua in uwp_apps:
                name = ua.get('Name', '')
                app_id = ua.get('AppID', '')
                if name and app_id:
                    lower_name = name.lower().strip()
                    if lower_name not in seen_apps and not any(block in lower_name for block in ['uninstall', 'readme', 'setup', 'help', 'about']):
                        seen_apps.add(lower_name)
                        app_list.append({"name": name, "path": f"shell:AppsFolder\\{app_id}", "source": "uwp"})
    except Exception as e:
        print(f"[UWP Scanner] Could not enumerate Store apps: {e}")
            
    # Sort alphabetically
    app_list.sort(key=lambda x: x["name"].lower())
    
    # Fallback default items if scanner returned nothing
    if not app_list:
        app_list = [
            {"name": "Notepad", "path": "notepad.exe", "source": "fallback"},
            {"name": "Calculator", "path": "calc.exe", "source": "fallback"},
            {"name": "Command Prompt", "path": "cmd.exe", "source": "fallback"},
            {"name": "Paint", "path": "mspaint.exe", "source": "fallback"}
        ]
    
    # Cache the result
    _app_cache["apps"] = app_list
    _app_cache["timestamp"] = time.time()
        
    return app_list


def find_best_app_match(query, apps):
    """3-tier app matching: exact -> alias -> fuzzy substring."""
    query_lower = query.lower().strip()
    
    # Tier 1: Exact name match
    for app in apps:
        if app["name"].lower().strip() == query_lower:
            return app
    
    # Tier 2: Alias dictionary match
    if query_lower in APP_ALIASES:
        alias_target = APP_ALIASES[query_lower].lower()
        for app in apps:
            if app["name"].lower().strip() == alias_target:
                return app
    
    # Tier 3: Fuzzy substring match (best match by shortest name containing query)
    candidates = []
    for app in apps:
        app_lower = app["name"].lower()
        if query_lower in app_lower or app_lower in query_lower:
            candidates.append(app)
    
    if candidates:
        # Prefer shortest name (most specific match)
        candidates.sort(key=lambda a: len(a["name"]))
        return candidates[0]
    
    # Tier 4: Word-level partial match
    query_words = set(query_lower.split())
    best_match = None
    best_score = 0
    for app in apps:
        app_words = set(app["name"].lower().split())
        overlap = len(query_words & app_words)
        if overlap > best_score:
            best_score = overlap
            best_match = app
    
    return best_match if best_score > 0 else None


# ==========================================================================
# 3. DIRECTORY BROWSER & FILE SEARCH MODULE
# ==========================================================================

def browse_directory(target_path=None):
    """Lists files and folders inside directory safely with relative descriptors."""
    if not target_path or target_path == "":
        # Default browser root is the user profile directory
        target_path = os.environ.get("USERPROFILE", "C:\\")
    
    # Resolve sidebar shortcut prefixes to actual Windows paths
    user_profile = os.environ.get("USERPROFILE", "C:\\")
    shortcut_map = {
        "shortcut:user": user_profile,
        "shortcut:desktop": os.path.join(user_profile, "Desktop"),
        "shortcut:documents": os.path.join(user_profile, "Documents"),
        "shortcut:downloads": os.path.join(user_profile, "Downloads"),
    }
    if target_path in shortcut_map:
        target_path = shortcut_map[target_path]
        
    target_path = os.path.abspath(target_path)
    
    if not os.path.exists(target_path):
        return {"status": "error", "message": "Path does not exist, sir."}
    if not os.path.isdir(target_path):
        return {"status": "error", "message": "Path is not a directory, sir."}
        
    try:
        entries = os.listdir(target_path)
        folders = []
        files = []
        
        for item in entries:
            item_path = os.path.join(target_path, item)
            try:
                is_dir = os.path.isdir(item_path)
                stat = os.stat(item_path)
                size_bytes = stat.st_size
                
                # Format file size
                if size_bytes < 1024:
                    size_txt = f"{size_bytes} B"
                elif size_bytes < 1024 * 1024:
                    size_txt = f"{round(size_bytes / 1024.0, 1)} KB"
                else:
                    size_txt = f"{round(size_bytes / (1024.0 * 1024.0), 1)} MB"
                    
                # Classify File Types for nice UI Icons
                file_type = "folder" if is_dir else "file"
                ext = os.path.splitext(item)[1].lower() if not is_dir else ""
                
                if not is_dir:
                    if ext in [".pdf"]: file_type = "pdf"
                    elif ext in [".docx", ".doc", ".txt", ".rtf"]: file_type = "doc"
                    elif ext in [".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg"]: file_type = "image"
                    elif ext in [".exe", ".bat", ".cmd", ".msi"]: file_type = "executable"
                    elif ext in [".zip", ".rar", ".7z", ".tar", ".gz"]: file_type = "archive"
                    elif ext in [".mp3", ".wav", ".flac", ".m4a"]: file_type = "audio"
                    elif ext in [".mp4", ".mkv", ".avi", ".mov"]: file_type = "video"
                
                info = {
                    "name": item,
                    "path": item_path,
                    "type": file_type,
                    "size": "" if is_dir else size_txt,
                    "mtime": time.strftime('%Y-%m-%d %H:%M', time.localtime(stat.st_mtime))
                }
                
                if is_dir:
                    folders.append(info)
                else:
                    files.append(info)
            except Exception:
                # Silently skip items with no permissions (e.g. system volume folders)
                continue
                
        # Sort folders alphabetically, followed by files
        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())
        
        parent_path = os.path.dirname(target_path)
        if parent_path == target_path:
            parent_path = "" # Reached root partition
            
        return {
            "status": "success",
            "current_path": target_path,
            "parent_path": parent_path,
            "items": folders + files
        }
    except Exception as e:
        return {"status": "error", "message": f"Could not access directory: {str(e)}"}


# ==========================================================================
# 4. EMAIL CLASSIFICATION & OUTLOOK HUB
# ==========================================================================

MOCK_EMAILS = [
    {
        "id": 1,
        "sender": "Stripe Billing Office",
        "subject": "Invoice paid successfully - Receipt #1923 for J.A.R.V.I.S. Cloud Upgrade",
        "time": "Today, 11:20 AM",
        "body": "Thank you for your payment, sir. Your credit card ending in 4242 has been billed for $49.00 USD. Your subscription tier is now active. Review the details below or view your billing dashboard at stripe.com.",
        "category": "financial"
    },
    {
        "id": 2,
        "sender": "Project Director - Stark Industries",
        "subject": "Quarterly Technical Review Meeting Agenda - Jarvis Local Core Integration",
        "time": "Today, 09:15 AM",
        "body": "Sir, we have finalized the agenda for tomorrow's engineering stack alignment review. We will evaluate real-time telemetry processing bottlenecks, local Windows COM library hooks, and speech synthesis speeds. Meeting link attached.",
        "category": "work"
    },
    {
        "id": 3,
        "sender": "GitHub Notifications",
        "subject": "[GitHub] Security Alert: 3 dependencies flagged for urgent package updates",
        "time": "Yesterday, 06:40 PM",
        "body": "We detected security vulnerabilities in your active repository libraries. Specifically, Flask < 3.0.0 and Werkzeug cookies. Please run pip install --upgrade to secure your laptop host immediately.",
        "category": "alerts"
    },
    {
        "id": 4,
        "sender": "Virginia 'Pepper' Potts",
        "subject": "RE: Evening plans & flight schedule changes",
        "time": "Yesterday, 02:10 PM",
        "body": "Just checking in, Tony. Your flight is locked in for 6:00 PM tomorrow. Please make sure the laptop assistant holds all standby processes until you land. Talk soon.",
        "category": "personal"
    },
    {
        "id": 5,
        "sender": "Amazon Deals Team",
        "subject": "FLASH SALE: Deep learning GPUs, mechanical keyboards up to 45% OFF!",
        "time": "May 25, 2026",
        "body": "Don't miss these amazing developer accessory flash sales. Upgrade your hardware setup with mechanical switches, custom neon LED rigs, and ultra-high speed memory chips. Click to claim offer.",
        "category": "spam"
    },
    {
        "id": 6,
        "sender": "Workspace Administrator",
        "subject": "System Password Expiration Warning - 3 days remaining",
        "time": "May 24, 2026",
        "body": "Your Windows Active Directory password will expire in 3 days. Please press Ctrl+Alt+Del on your laptop to perform a secure remote credential update, or contact system assistance immediately.",
        "category": "alerts"
    }
]

def classify_email(sender, subject, body):
    """Automatically categorizes emails by parsing keywords."""
    snd = sender.lower()
    sub = subject.lower()
    bdy = body.lower()
    
    combined = f"{snd} {sub} {bdy}"
    
    if any(k in combined for k in ["invoice", "receipt", "paid", "bill", "invoice", "payment", "bank", "charge", "tax", "subscription", "pricing", "dollar", "usd", "inr", "order"]):
        return "financial"
    elif any(k in combined for k in ["meeting", "review", "agenda", "project", "client", "task", "report", "schedule", "deadline", "team", "align", "corporate", "office"]):
        return "work"
    elif any(k in combined for k in ["security", "warning", "expiration", "password", "login", "vulnerability", "alert", "reset", "attempt", "critical", "failed"]):
        return "alerts"
    elif any(k in combined for k in ["virginia", "pepper", "potts", "rhodey", "happy", "lunch", "dinner", "family", "hello", "hey", "trip", "weekend", "plans"]):
        return "personal"
    elif any(k in combined for k in ["offer", "deal", "discount", "free", "claim", "sale", "win", "prize", "buy now", "subscribe", "promotional", "shopping", "store"]):
        return "spam"
        
    return "inbox"

def get_emails():
    """Gathers emails from IMAP config if active, local Outlook if active, otherwise returns custom instructions inbox."""
    import imaplib
    import email
    from email.header import decode_header
    import json
    
    config_path = "config.json"
    
    # Auto-create template config.json if it doesn't exist!
    if not os.path.exists(config_path):
        try:
            default_config = {
                "email": "your_email@gmail.com",
                "app_password": "your_app_password_here (16 characters, no spaces)",
                "imap_server": "imap.gmail.com"
            }
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=4)
        except Exception as e:
            print(f"Failed to create config.json: {e}")

    # Try to load credentials
    credentials = None
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                credentials = json.load(f)
        except Exception as e:
            print(f"Error loading config.json: {e}")
            
    # Check if credentials are set and not placeholder
    is_configured = False
    if credentials:
        email_addr = credentials.get("email", "")
        app_pass = credentials.get("app_password", "")
        imap_server = credentials.get("imap_server", "imap.gmail.com")
        if email_addr and "@" in email_addr and "your_email" not in email_addr and "your_app_password" not in app_pass:
            is_configured = True
            
    if is_configured:
        email_list = []
        try:
            # Connect to IMAP server
            mail = imaplib.IMAP4_SSL(imap_server)
            mail.login(email_addr, app_pass)
            mail.select("inbox")
            
            # Fetch latest 20 emails
            status, messages = mail.search(None, "ALL")
            mail_ids = messages[0].split()
            
            if mail_ids:
                latest_ids = mail_ids[-20:][::-1] # Get top 20, newest first
                for i, mail_id in enumerate(latest_ids, start=1):
                    try:
                        status, msg_data = mail.fetch(mail_id, "(RFC822)")
                        for response_part in msg_data:
                            if isinstance(response_part, tuple):
                                msg = email.message_from_bytes(response_part[1])
                                
                                # Decode Subject
                                subject = "No Subject"
                                if msg["Subject"]:
                                    decoded = decode_header(msg["Subject"])[0]
                                    subject = decoded[0]
                                    if isinstance(subject, bytes):
                                        subject = subject.decode(decoded[1] or "utf-8", errors="ignore")
                                
                                # Decode Sender
                                sender = "Unknown Sender"
                                if msg["From"]:
                                    decoded = decode_header(msg["From"])[0]
                                    sender = decoded[0]
                                    if isinstance(sender, bytes):
                                        sender = sender.decode(decoded[1] or "utf-8", errors="ignore")
                                
                                # Extract Time
                                received_time = msg["Date"] or "Unknown Date"
                                try:
                                    parsed_time = email.utils.parsedate_to_datetime(received_time)
                                    received_time = parsed_time.strftime("%b %d, %I:%M %p")
                                except: pass
                                
                                # Extract Body
                                body = ""
                                if msg.is_multipart():
                                    for part in msg.walk():
                                        if part.get_content_type() == "text/plain":
                                            body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                            break
                                else:
                                    body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                                
                                body_snippet = body[:350].strip().replace('\r\n', ' ').replace('\n', ' ')
                                category = classify_email(sender, subject, body_snippet)
                                
                                email_list.append({
                                    "id": i,
                                    "sender": sender,
                                    "subject": subject,
                                    "time": received_time,
                                    "body": body if body else "No text payload available, sir.",
                                    "category": category
                                })
                    except Exception as e:
                        print(f"Failed parsing email item: {e}")
                        continue
            mail.close()
            mail.logout()
            
            if email_list:
                return email_list
        except Exception as e:
            print(f"IMAP retrieval error: {e}. Falling back to default.")

    # Try Outlook COM as fallback if credentials not configured or IMAP failed
    if has_outlook:
        email_list = []
        try:
            comtypes.CoInitialize()
            outlook = win32com.client.Dispatch("Outlook.Application")
            namespace = outlook.GetNamespace("MAPI")
            inbox = namespace.GetDefaultFolder(6)
            messages = inbox.Items
            messages.Sort("[ReceivedTime]", True)
            
            count = min(len(messages), 40)
            for i in range(1, count + 1):
                try:
                    msg = messages.Item(i)
                    subject = getattr(msg, "Subject", "No Subject")
                    sender = getattr(msg, "SenderName", "Unknown Sender")
                    body_snippet = getattr(msg, "Body", "")[:350].strip().replace('\r\n', ' ')
                    
                    try: received_time = msg.ReceivedTime.strftime("%b %d, %I:%M %p")
                    except: received_time = "Unknown"
                        
                    category = classify_email(sender, subject, body_snippet)
                    email_list.append({
                        "id": i,
                        "sender": sender,
                        "subject": subject,
                        "time": received_time,
                        "body": getattr(msg, "Body", "No body text available."),
                        "category": category
                    })
                except Exception as e:
                    print(f"Skipping single email: {e}")
                    continue
        except Exception as e:
            print(f"Outlook aggregation error: {e}")
        finally:
            try: comtypes.CoUninitialize()
            except: pass
            
        if email_list:
            return email_list

    # Default fallback: Clean instructional email explaining how to connect
    current_time_str = time.strftime("%b %d, %I:%M %p")
    return [
        {
            "id": 1,
            "sender": "J.A.R.V.I.S. Intelligence",
            "subject": "ACTION REQUIRED: Configure Real Mail Server Integration, Sir",
            "time": current_time_str,
            "body": (
                "Greetings, sir. Currently, your real email inbox is not linked to my processor. "
                "To display your actual personal emails instead of mock data, please follow these steps:\n\n"
                "1. Open the 'config.json' file that I have created in your project workspace folder.\n"
                "2. Enter your real Email Address (e.g. your_email@gmail.com).\n"
                "3. Enter your 16-character App Password (for GMail/Yahoo, generate an App Password in your account security settings; your standard password will be blocked).\n"
                "4. Change the imap_server if you use Outlook Web (imap-mail.outlook.com) or Yahoo (imap.mail.yahoo.com).\n"
                "5. Save the file and click the 'REFRESH' button on your mail folder sidebar.\n\n"
                "I will immediately initialize the secure IMAP channels and fetch your inbox, sir!"
            ),
            "category": "alerts"
        }
     ]

# ==========================================================================
# 5. SAFETY SYSTEM TERMINAL HANDLER
# ==========================================================================

def run_shell_command(command_str):
    """Executes a Windows command prompt directive safely with allowlist enforcement."""
    cmd = command_str.strip()
    if not cmd:
        return "Command is empty, sir."
    
    # Security: Block shell chaining & piping operators that could bypass allowlist
    dangerous_operators = ['&&', '||', '|', ';', '`', '$(',  '>', '<', '^']
    for op in dangerous_operators:
        if op in cmd:
            return f"[ERROR] Security Protocol: Shell operator '{op}' is not permitted in sandboxed mode, sir."
    
    # Security: Strict ALLOWLIST approach — only pre-approved safe commands
    ALLOWED_COMMANDS = [
        "ipconfig", "ping", "tracert", "traceroute", "nslookup", "netstat",
        "arp", "route print", "hostname", "whoami", "systeminfo",
        "tasklist", "wmic os", "wmic cpu", "wmic memorychip",
        "dir", "echo", "type", "find", "findstr", "where", "tree",
        "date /t", "time /t", "ver", "vol", "chcp",
        "powershell -c get-process", "powershell -c get-netipaddress",
        "powershell -c get-computerinfo", "powershell -c get-disk",
    ]
    
    cmd_lower = cmd.lower().strip()
    is_allowed = any(cmd_lower.startswith(allowed) for allowed in ALLOWED_COMMANDS)
    
    if not is_allowed:
        return (f"[ERROR] Secure Shell Protocol: Command '{cmd.split()[0]}' is not in the approved allowlist, sir. "
                f"Permitted commands include: ipconfig, ping, tracert, netstat, tasklist, dir, systeminfo, and more.")
    
    try:
        # Execute command with strict timeout to prevent Flask thread blocking
        process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            stdout, stderr = process.communicate(timeout=5.0)
            output = stdout if stdout else ""
            if stderr:
                output += f"\n[STDERR]\n{stderr}"
            if not output.strip():
                output = f"Command completed successfully with exit code {process.returncode}."
            return output
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return f"[ERROR] Command execution timed out after 5.0 seconds. Process terminated.\nOutput before timeout:\n{stdout}"
    except Exception as e:
        return f"[ERROR] Failed to execute terminal command: {str(e)}"


# ==========================================================================
# 5b. GEMINI AI CHATBOT ENGINE
# ==========================================================================

import json
import urllib.request
import urllib.error

# Conversation history for context
_chat_history = []
_MAX_HISTORY = 10

def load_config():
    """Loads config.json for API keys and email settings."""
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def chat_with_gemini(user_message):
    """Sends a message to Gemini API and returns the response."""
    global _chat_history
    config = load_config()
    api_key = config.get("gemini_api_key", "")
    
    if not api_key:
        return None  # No API key configured, skip AI
    
    # Build conversation with system prompt
    system_prompt = (
        "You are J.A.R.V.I.S., a witty, sophisticated, and highly capable AI assistant "
        "inspired by Tony Stark's AI from Iron Man. You address the user as 'sir'. "
        "You are running as a desktop assistant on the user's Windows laptop. "
        "Keep responses concise (2-3 sentences max) unless the user asks for detailed explanations. "
        "Be helpful, intelligent, and slightly humorous."
    )
    
    # Build contents array with history
    contents = []
    for entry in _chat_history[-_MAX_HISTORY:]:
        contents.append({"role": entry["role"], "parts": [{"text": entry["text"]}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})
    
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 300
        }
    }
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            ai_text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            
            if ai_text:
                # Save to history
                _chat_history.append({"role": "user", "text": user_message})
                _chat_history.append({"role": "model", "text": ai_text})
                # Trim history
                if len(_chat_history) > _MAX_HISTORY * 2:
                    _chat_history = _chat_history[-_MAX_HISTORY * 2:]
                return ai_text
    except urllib.error.HTTPError as e:
        print(f"[Gemini API] HTTP Error {e.code}: {e.read().decode()[:200]}")
    except Exception as e:
        print(f"[Gemini API] Error: {e}")
    
    return None


# ==========================================================================
# 6. COMMAND PARSER INTENT ENGINE (NATIVE OS CALLS)
# ==========================================================================

def parse_and_execute_command(command_text):
    """Parses natural language commands and executes OS controls."""
    cmd = command_text.lower().strip()
    response = {
        "status": "success",
        "action": "chat",
        "message": "I processed your request, sir.",
        "details": ""
    }
    
    # 0. Navigation / Panel switching commands
    if any(kw in cmd for kw in ["open mail", "open email", "show mail", "show email", "check mail", "check email", "show inbox"]):
        response["message"] = "Opening your Email Hub and fetching your inbox, sir."
        response["action"] = "tab"
        response["details"] = "mail"
        return response
        
    elif any(kw in cmd for kw in ["open files", "open explorer", "open file explorer", "show files", "show folder", "browse files"]):
        response["message"] = "Opening the File Explorer, sir."
        response["action"] = "tab"
        response["details"] = "files"
        return response
        
    elif any(kw in cmd for kw in ["open apps", "open app deck", "show apps", "show scanned apps"]):
        response["message"] = "Opening the Executive App Deck, sir."
        response["action"] = "tab"
        response["details"] = "apps"
        return response
        
    elif any(kw in cmd for kw in ["open shell", "open terminal", "show terminal", "open cmd console"]):
        response["message"] = "Initializing the sandboxed shell terminal, sir."
        response["action"] = "tab"
        response["details"] = "terminal"
        return response
        
    elif any(kw in cmd for kw in ["open tasks", "open task manager", "show tasks", "open processes", "show processes"]):
        response["message"] = "Opening the System Task Manager, sir."
        response["action"] = "tab"
        response["details"] = "processes"
        return response
        
    elif any(kw in cmd for kw in ["open telemetry", "core system", "show telemetry", "show gauges"]):
        response["message"] = "Displaying core system telemetry diagnostics, sir."
        response["action"] = "tab"
        response["details"] = "telemetry"
        return response

    # 1. Volume Controls
    if "volume to" in cmd or "set volume" in cmd:
        try:
            words = cmd.split()
            vol_val = None
            for w in words:
                if w.isdigit():
                    vol_val = int(w)
                    break
            if vol_val is not None:
                if set_volume_windows(vol_val):
                    response["message"] = f"Setting master volume to {vol_val} percent, sir."
                    response["action"] = "volume"
                    response["details"] = f"Volume set to {vol_val}%"
                else:
                    response["status"] = "error"
                    response["message"] = "Could not adjust system volume, sir."
            else:
                response["status"] = "error"
                response["message"] = "Please specify a volume percentage between 0 and 100, sir."
        except Exception as e:
            response["status"] = "error"
            response["message"] = f"Error adjusting volume: {str(e)}"
            
    elif "mute" in cmd and "unmute" not in cmd:
        if set_volume_windows(None, mute=True):
            response["message"] = "Muting all audio outputs, sir."
            response["action"] = "volume"
            response["details"] = "System Muted"
        else:
            response["status"] = "error"
            response["message"] = "Could not mute audio, sir."
            
    elif "unmute" in cmd:
        if set_volume_windows(None, mute=False):
            response["message"] = "Audio outputs unmuted, sir."
            response["action"] = "volume"
            response["details"] = "System Unmuted"
        else:
            response["status"] = "error"
            response["message"] = "Could not unmute audio, sir."

    # 2. Screenshots
    elif "screenshot" in cmd or "capture screen" in cmd or "capture desktop" in cmd:
        success, path_or_err = take_screenshot()
        if success:
            response["message"] = "Screenshot captured successfully, sir. Displaying on screen now."
            response["action"] = "screenshot"
            response["details"] = path_or_err
        else:
            response["status"] = "error"
            response["message"] = f"Failed to capture screenshot: {path_or_err}"

    # 3. Locking Laptop
    elif "lock my laptop" in cmd or "lock my pc" in cmd or "lock screen" in cmd or "lock laptop" in cmd:
        response["message"] = "Locking the desktop session immediately. Goodbye, sir."
        response["action"] = "lock"
        def lock_pc():
            time.sleep(1.0)
            if platform.system() == 'Windows':
                os.system("rundll32.exe user32.dll,LockWorkStation")
        threading.Thread(target=lock_pc).start()

    # 4. App Launchers
    elif "open" in cmd or "launch" in cmd:
        app_name = cmd.replace("open", "").replace("launch", "").strip()
        
        apps = get_installed_apps()
        launched = False
        
        # Use fuzzy matching
        best_match = find_best_app_match(app_name, apps)
        if best_match:
            try:
                os.startfile(best_match["path"])
                response["message"] = f"Opening {best_match['name']} for you, sir."
                response["action"] = "launch"
                response["details"] = f"Launched: {best_match['name']}"
                launched = True
            except Exception as e:
                print(f"Failed to launch {best_match['name']}: {e}")
        
        # Check standard Windows app keywords
        if not launched:
            windows_apps = {
                "notepad": "notepad.exe",
                "calculator": "calc.exe", "calc": "calc.exe",
                "paint": "mspaint.exe",
                "command prompt": "cmd.exe", "cmd": "cmd.exe",
                "task manager": "taskmgr.exe", "taskmgr": "taskmgr.exe",
                "explorer": "explorer.exe", "file explorer": "explorer.exe",
                "chrome": "chrome.exe", "edge": "msedge.exe",
                "settings": "ms-settings:",
            }
            for key, exe in windows_apps.items():
                if key in app_name:
                    try:
                        if exe.startswith("ms-"):
                            os.startfile(exe)
                        else:
                            subprocess.Popen(exe, shell=True)
                        response["message"] = f"Opening {key.capitalize()} for you, sir."
                        response["action"] = "launch"
                        launched = True
                        break
                    except: pass
                    
        # Special web URLs
        if not launched:
            web_map = {
                "browser": "https://www.google.com", "google": "https://www.google.com",
                "internet": "https://www.google.com", "youtube": "https://www.youtube.com",
                "spotify": "https://open.spotify.com", "github": "https://github.com",
                "gmail": "https://mail.google.com", "chatgpt": "https://chat.openai.com",
            }
            for key, url in web_map.items():
                if key in app_name:
                    webbrowser.open(url)
                    response["message"] = f"Opening {key.capitalize()} in your browser, sir."
                    response["action"] = "launch"
                    launched = True
                    break
            
        # WhatsApp special handling
        if not launched and "whatsapp" in app_name:
            try:
                os.startfile("whatsapp://")
                response["message"] = "Opening WhatsApp Desktop, sir."
            except Exception:
                webbrowser.open("https://web.whatsapp.com")
                response["message"] = "Launching WhatsApp Web, sir."
            response["action"] = "launch"
            launched = True
            
        if not launched:
            response["status"] = "error"
            response["message"] = f"I couldn't find an application matching '{app_name}' on your system, sir. Try saying the full app name."
                    
    # 5. Web Searching
    elif "search google for" in cmd or "search for" in cmd or "google" in cmd:
        query = cmd.replace("search google for", "").replace("search for", "").replace("google", "").strip()
        if query:
            url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
            webbrowser.open(url)
            response["message"] = f"Searching Google for '{query}', sir."
            response["action"] = "search"
            response["details"] = url
        else:
            response["status"] = "error"
            response["message"] = "What would you like me to search for, sir?"

    # 6. Basic Jarvis Greeting & Information Queries
    elif any(greet in cmd for greet in ["hello", "hi", "hey jarvis", "wake up"]):
        response["message"] = "At your service, sir. All systems are fully operational and ready for your command."
        response["action"] = "greet"
        
    elif any(kw in cmd for kw in ["what can you do", "what functions", "what all functions", "help", "capabilities", "features"]):
        response["message"] = "I can adjust master volume (e.g. 'volume to 50', 'mute'), capture screenshots ('take a screenshot'), lock your PC ('lock screen'), launch apps ('open Notepad'), perform Google searches ('search google for python'), check hardware diagnostics ('system status'), manage tasks ('list processes'), and browse local files. Use the Command Palette (Ctrl+K) to explore everything, sir!"
        response["action"] = "chat"

    elif "status" in cmd or "system status" in cmd or "diagnostics" in cmd or "hardware" in cmd:
        stats = get_system_stats()
        response["message"] = f"System diagnostics: CPU is at {stats['cpu']}%, RAM usage is {stats['ram']}%, Disk space utilized is {stats['disk']}%, and battery capacity is {stats['battery']['percent']}%."
        response["action"] = "status"
        response["details"] = stats

    elif "who are you" in cmd or "what is your name" in cmd:
        response["message"] = "I am JARVIS, your personal laptop assistant. I was designed to automate commands, monitor your hardware, and optimize your environment."
        response["action"] = "chat"

    elif "time" in cmd or "what time is it" in cmd:
        current_time = time.strftime("%I:%M %p")
        response["message"] = f"The time is exactly {current_time}, sir."
        response["action"] = "chat"

    elif "date" in cmd or "what day is it" in cmd:
        current_date = time.strftime("%A, %B %d, %Y")
        response["message"] = f"Today is {current_date}, sir."
        response["action"] = "chat"

    else:
        # Try AI chatbot if Gemini API key is configured
        ai_response = chat_with_gemini(command_text)
        if ai_response:
            response["message"] = ai_response
            response["action"] = "chat"
        else:
            response["message"] = f"I've logged the command: '{command_text}'. My AI brain is not yet configured — add a 'gemini_api_key' to config.json to enable intelligent conversations, sir."
            response["action"] = "chat"
        
    return response


# ==========================================================================
# 7. HTTP ENDPOINTS & ROUTERS
# ==========================================================================

@app.route('/')
def home():
    """Serves the main Jarvis web portal interface."""
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def api_stats():
    stats = get_system_stats()
    volume, muted = get_volume_windows()
    stats["volume"] = volume
    stats["muted"] = muted
    return jsonify(stats)

@app.route('/api/command', methods=['POST'])
def api_command():
    data = request.json or {}
    command_text = data.get("command", "")
    if not command_text:
        return jsonify({"status": "error", "message": "Command is empty, sir."}), 400
    
    result = parse_and_execute_command(command_text)
    return jsonify(result)

@app.route('/api/volume', methods=['POST'])
def api_volume():
    data = request.json or {}
    volume_level = data.get("volume", None)
    mute = data.get("mute", None)
    
    if volume_level is not None:
        try: volume_level = int(volume_level)
        except ValueError: return jsonify({"status": "error", "message": "Invalid volume level"}), 400
            
    success = set_volume_windows(volume_level, mute)
    if success:
        vol, muted = get_volume_windows()
        return jsonify({"status": "success", "volume": vol, "muted": muted})
    else:
        return jsonify({"status": "error", "message": "Failed to set volume"}), 500

@app.route('/api/screenshot', methods=['POST'])
def api_screenshot():
    success, path_or_err = take_screenshot()
    if success:
        return jsonify({"status": "success", "url": path_or_err})
    else:
        return jsonify({"status": "error", "message": path_or_err}), 500

@app.route('/api/hotkey/poll', methods=['GET'])
def api_hotkey_poll():
    global hotkey_triggered
    state = hotkey_triggered
    hotkey_triggered = False  # Reset on poll read
    return jsonify({"triggered": state})

# --- ADVANCED SYSTEM CHANNELS ---

@app.route('/api/apps/list', methods=['GET'])
def api_apps_list():
    """Endpoint returning all scanned Start Menu applications on the PC."""
    apps = get_installed_apps()
    return jsonify({"status": "success", "count": len(apps), "apps": apps})

@app.route('/api/apps/launch', methods=['POST'])
def api_apps_launch():
    """Endpoint to launch a scanned application by absolute shortcut path."""
    if not rate_limiter.is_allowed('apps_launch', max_requests=20):
        return jsonify({"status": "error", "message": "Rate limit exceeded. Please wait before launching more apps, sir."}), 429
    data = request.json or {}
    shortcut_path = data.get("path", "")
    if not shortcut_path:
        return jsonify({"status": "error", "message": "Path is empty"}), 400
    # Security: Only allow launching .lnk shortcut files from Start Menu
    is_uwp = shortcut_path.startswith("shell:AppsFolder")
    if not is_uwp and not shortcut_path.lower().endswith('.lnk'):
        return jsonify({"status": "error", "message": "Security: Only Start Menu shortcuts (.lnk) or Store apps can be launched, sir."}), 403
    if not is_uwp and not is_path_safe(shortcut_path):
        return jsonify({"status": "error", "message": "Security: Path is outside allowed directories, sir."}), 403
    try:
        os.startfile(shortcut_path)
        return jsonify({"status": "success", "message": f"Successfully launched shortcut, sir."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Launch failed: {str(e)}"}), 500

@app.route('/api/files/browse', methods=['GET'])
def api_files_browse():
    """Endpoint to browse directory items."""
    target_path = request.args.get("path", "")
    result = browse_directory(target_path)
    return jsonify(result)

@app.route('/api/files/search', methods=['GET'])
def api_files_search():
    """Endpoint to search filenames inside the user profile directory recursively."""
    query = request.args.get("query", "").strip().lower()
    if not query:
        return jsonify({"status": "error", "message": "Query is empty"}), 400
        
    search_root = os.environ.get("USERPROFILE", "C:\\")
    results = []
    
    # Fast search: check Desktop, Documents, and Downloads first for rapid indexing!
    priority_dirs = ["Desktop", "Documents", "Downloads"]
    checked_roots = []
    
    for folder in priority_dirs:
        sub_dir = os.path.join(search_root, folder)
        if os.path.exists(sub_dir):
            checked_roots.append(sub_dir)
            
    # Include user root as fallback
    checked_roots.append(search_root)
    
    seen_paths = set()
    matches_count = 0
    max_matches = 80 # Limit search list size for high performance
    
    for folder_path in checked_roots:
        if matches_count >= max_matches: break
        try:
            for root, dirs, files in os.walk(folder_path):
                if matches_count >= max_matches: break
                for f in files:
                    if query in f.lower():
                        full_p = os.path.join(root, f)
                        if full_p in seen_paths: continue
                        seen_paths.add(full_p)
                        
                        stat = os.stat(full_p)
                        size_b = stat.st_size
                        size_txt = f"{size_b} B" if size_b < 1024 else f"{round(size_b / 1024.0, 1)} KB" if size_b < 1024 * 1024 else f"{round(size_b / (1024.0 * 1024.0), 1)} MB"
                        
                        results.append({
                            "name": f,
                            "path": full_p,
                            "type": "file",
                            "size": size_txt,
                            "mtime": time.strftime('%Y-%m-%d %H:%M', time.localtime(stat.st_mtime))
                        })
                        matches_count += 1
                        if matches_count >= max_matches:
                            break
        except Exception:
            continue
            
    return jsonify({"status": "success", "count": len(results), "items": results})

@app.route('/api/files/open', methods=['POST'])
def api_files_open():
    """Endpoint to launch any local file inside the native OS handler."""
    if not rate_limiter.is_allowed('files_open', max_requests=20):
        return jsonify({"status": "error", "message": "Rate limit exceeded. Please wait before opening more files, sir."}), 429
    data = request.json or {}
    file_path = data.get("path", "")
    if not file_path:
        return jsonify({"status": "error", "message": "File path is empty"}), 400
    # Security: Validate path is within allowed directories
    if not is_path_safe(file_path):
        return jsonify({"status": "error", "message": "Security: Cannot open files in system-protected directories, sir."}), 403
    try:
        os.startfile(file_path)
        return jsonify({"status": "success", "message": f"Successfully launched file on laptop."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to open file: {str(e)}"}), 500

@app.route('/api/mail/list', methods=['GET'])
def api_mail_list():
    """Endpoint returning categorized emails from Outlook COM namespace or Mock Engine."""
    emails = get_emails()
    return jsonify({"status": "success", "count": len(emails), "emails": emails})

@app.route('/api/terminal/run', methods=['POST'])
def api_terminal_run():
    """Endpoint to execute safe Windows command shells securely."""
    if not rate_limiter.is_allowed('terminal_run', max_requests=10):
        return jsonify({"status": "error", "output": "[ERROR] Rate limit exceeded. Maximum 10 commands per minute, sir."}), 429
    data = request.json or {}
    command = data.get("command", "")
    output = run_shell_command(command)
    return jsonify({"status": "success", "output": output})

# --- PROCESS MANAGER ---

@app.route('/api/processes', methods=['GET'])
def api_processes():
    """Returns a list of running processes with CPU, memory, and status."""
    if not psutil:
        return jsonify({"status": "error", "message": "psutil not available"}), 500
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
        try:
            info = proc.info
            mem = info['memory_info']
            processes.append({
                "pid": info['pid'],
                "name": info['name'] or "Unknown",
                "cpu": info['cpu_percent'] or 0,
                "memory_mb": round(mem.rss / 1024 / 1024, 1) if mem else 0,
                "status": info['status'] or "unknown"
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    # Sort by CPU descending, return top 100
    processes.sort(key=lambda x: x['cpu'], reverse=True)
    return jsonify({"status": "success", "count": len(processes), "processes": processes[:100]})

@app.route('/api/processes/kill', methods=['POST'])
def api_processes_kill():
    """Safely terminates a process by PID."""
    if not rate_limiter.is_allowed('process_kill', max_requests=10):
        return jsonify({"status": "error", "message": "Rate limit exceeded, sir."}), 429
    data = request.json or {}
    pid = data.get("pid", None)
    if pid is None:
        return jsonify({"status": "error", "message": "PID is required, sir."}), 400
    try:
        pid = int(pid)
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid PID format, sir."}), 400
    
    # Block killing system-critical processes
    PROTECTED_NAMES = ["system", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
                       "lsass.exe", "svchost.exe", "winlogon.exe", "explorer.exe", "dwm.exe"]
    try:
        proc = psutil.Process(pid)
        proc_name = proc.name().lower()
        if proc_name in PROTECTED_NAMES:
            return jsonify({"status": "error", "message": f"Cannot terminate system-critical process '{proc.name()}', sir."}), 403
        proc.terminate()
        return jsonify({"status": "success", "message": f"Process '{proc.name()}' (PID {pid}) terminated, sir."})
    except psutil.NoSuchProcess:
        return jsonify({"status": "error", "message": f"Process with PID {pid} not found, sir."}), 404
    except psutil.AccessDenied:
        return jsonify({"status": "error", "message": f"Access denied — insufficient privileges to terminate PID {pid}, sir."}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error terminating process: {str(e)}"}), 500

if __name__ == '__main__':
    print("--------------------------------------------------")
    print("         J.A.R.V.I.S. SYSTEM INITIATED            ")
    print("  Flask local server running at http://localhost:5000")
    print("--------------------------------------------------")
    app.run(host='127.0.0.1', port=5000, debug=False)
