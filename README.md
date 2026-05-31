# 🤖 J.A.R.V.I.S. — 3D Cyberpunk AI Desktop Assistant

A **futuristic, Iron Man–inspired** personal laptop assistant with a **3D holographic cyberpunk HUD** built with Flask, Three.js, and vanilla JavaScript. Features an AI chatbot (Gemini), real-time system monitoring, voice commands, fuzzy app launching (including UWP/Store apps), file browsing, email aggregation, process management, and a sandboxed terminal.

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-green?logo=flask)
![Three.js](https://img.shields.io/badge/Three.js-r164-orange?logo=three.js)
![Gemini](https://img.shields.io/badge/Gemini_AI-2.0_Flash-purple?logo=google)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Platform](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)

---

## ✨ Features

| Feature | Description |
|---|---|
| **🎮 3D Holographic HUD** | Three.js-powered Arc Reactor, neon grid, 1500+ particles, matrix rain, mouse parallax |
| **🧠 AI Chatbot (Gemini)** | Intelligent conversations powered by Google Gemini 2.0 Flash API |
| **🖥️ Core System Telemetry** | Real-time CPU, RAM, Disk, Battery gauges with animated SVG rings |
| **🎤 Voice Control** | Web Speech API with wake word "Jarvis", spacebar/Alt+J/Ctrl+Shift+J activation |
| **📦 Smart App Launcher** | Scan & launch 190+ apps with fuzzy matching + UWP/Store app support |
| **📁 File Explorer** | Browse files/folders with sidebar shortcuts (Desktop, Documents, Downloads) |
| **📧 Email Hub** | Outlook COM + IMAP integration with auto-categorization (Work/Personal/Financial/Alerts) |
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
- **Credentials secured** — `config.json` is in `.gitignore` (never committed)

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

# Copy the config template and add your credentials
copy config.example.json config.json
# Edit config.json with your email and (optional) Gemini API key

# Run the assistant
python main.py
```

Or simply double-click **`start_jarvis.bat`** — it handles everything automatically.

### Configuration

Edit `config.json`:

```json
{
    "email": "your_email@gmail.com",
    "app_password": "your_16_char_app_password",
    "imap_server": "imap.gmail.com",
    "gemini_api_key": "your_gemini_api_key_here"
}
```

- **Email**: For inbox integration (Gmail App Password required)
- **Gemini API Key**: Get free from [Google AI Studio](https://aistudio.google.com/apikey) — enables intelligent AI conversations

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
- **Frontend**: Vanilla HTML/CSS/JS, Three.js (r164), Font Awesome, Google Fonts
- **3D Engine**: Three.js — Arc Reactor, particle systems, neon grid, matrix rain
- **AI**: Google Gemini 2.0 Flash API (optional, free tier)
- **Design**: Cyberpunk neon glassmorphism, 3D CSS transforms, CRT scanlines
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)

## 📁 Project Structure

```
jarvis/
├── main.py                  # Flask backend (API routes + system services + AI chatbot)
├── config.json              # Your credentials (gitignored)
├── config.example.json      # Template for config setup
├── requirements.txt         # Python dependencies
├── start_jarvis.bat         # One-click launcher
├── templates/
│   └── index.html           # 3D HUD — layered canvas + holographic UI overlay
├── static/
│   ├── css/style.css        # Cyberpunk design system (1700+ lines)
│   └── js/
│       ├── app.js           # Client-side logic (1500+ lines)
│       └── three-scene.js   # Three.js 3D engine (Arc Reactor, particles, grid)
└── screenshots/             # Auto-captured screenshots
```

## 📝 License

MIT License — feel free to use, modify, and distribute.

---

*"I am J.A.R.V.I.S. — Just A Rather Very Intelligent System."*
