# 🤖 J.A.R.V.I.S. — Laptop Assistant Dashboard

A **futuristic, Iron Man–inspired** personal laptop assistant built with Flask and vanilla JavaScript. Features real-time system monitoring, voice commands, app launching, file browsing, email aggregation, process management, and a sandboxed terminal — all wrapped in a stunning glassmorphic UI.

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-green?logo=flask)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Platform](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)

---

## ✨ Features

| Feature | Description |
|---|---|
| **🖥️ Core System Telemetry** | Real-time CPU, RAM, Disk, Battery gauges with animated SVG rings |
| **🎤 Voice Control** | Web Speech API with wake word "Jarvis", spacebar/Alt+J/Ctrl+Shift+J activation |
| **📦 App Deck** | Scan & launch 190+ installed apps from Start Menu with search |
| **📁 File Explorer** | Browse files/folders with sidebar shortcuts (Desktop, Documents, Downloads) |
| **📧 Email Hub** | Outlook COM integration with auto-categorization (Work/Personal/Financial/Alerts) |
| **⚡ Sandboxed Shell** | Secure terminal with allowlist-only command execution |
| **🖥️ Task Manager** | View, filter, and terminate running processes with CPU/memory bars |
| **🔔 Toast Notifications** | Slide-in notifications with 4 types and animated progress bars |
| **⚡ Command Palette** | `Ctrl+K` spotlight search across commands, apps, and actions |
| **🎚️ Volume Control** | System volume slider with mute toggle via `pycaw` |
| **📸 Screenshots** | Capture and preview screenshots with download support |
| **🔒 Lock Screen** | One-click workstation lock |

## 🔐 Security

- **Allowlist-only** shell commands (no denylist bypass possible)
- **Path traversal protection** on file open and app launch endpoints
- **Rate limiting** on sensitive endpoints (terminal, app launch, file open)
- **Protected processes** — system-critical processes cannot be terminated
- **Pipe/chain operator blocking** — prevents `&&`, `||`, `|` shell escapes

## 🚀 Quick Start

### Prerequisites
- **Python 3.9+** installed on Windows
- **Google Chrome** (recommended for voice recognition)

### Installation

```bash
# Clone the repository
git clone https://github.com/PRUTU29/jarvis.git
cd jarvis

# Install dependencies
pip install -r requirements.txt

# Run the assistant
python main.py
```

Or simply double-click **`start_jarvis.bat`** — it handles everything automatically.

### Access
Open your browser to **http://localhost:5000**

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open Command Palette |
| `Spacebar` | Activate voice input |
| `Alt+J` | Activate voice input |
| `Ctrl+Shift+J` | Global hotkey (works even when browser is unfocused) |

## 🛠️ Tech Stack

- **Backend**: Python, Flask, psutil, pycaw, pyautogui, win32com
- **Frontend**: Vanilla HTML/CSS/JS, Font Awesome, Google Fonts
- **Design**: Glassmorphism, neon gradients, CRT scanline effects, animated SVG gauges
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)

## 📁 Project Structure

```
jarvis/
├── main.py                  # Flask backend (API routes + system services)
├── requirements.txt         # Python dependencies
├── start_jarvis.bat         # One-click launcher
├── templates/
│   └── index.html           # Main dashboard UI
├── static/
│   ├── css/style.css        # Glassmorphic design system (2200+ lines)
│   └── js/app.js            # Client-side logic (1400+ lines)
└── screenshots/             # Auto-captured screenshots
```

## 📝 License

MIT License — feel free to use, modify, and distribute.

---

*"I am J.A.R.V.I.S. — Just A Rather Very Intelligent System."*
