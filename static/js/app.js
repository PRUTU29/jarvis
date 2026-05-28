/* ==========================================================================
   J.A.R.V.I.S. Client Core Logic (Supercharged with Tabs, Files, and Mail)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Top-level Header Elements
    const digitalClock = document.getElementById('digital-clock');
    const systemNode = document.getElementById('system-node');
    const systemStatusText = document.getElementById('system-status-text');
    const systemUptime = document.getElementById('system-uptime');
    const systemOS = document.getElementById('system-os');

    // Telemetry Gauges (Shared Core Panel)
    const cpuGauge = document.getElementById('cpu-gauge');
    const cpuText = document.getElementById('cpu-text');
    const ramGauge = document.getElementById('ram-gauge');
    const ramText = document.getElementById('ram-text');
    const diskGauge = document.getElementById('disk-gauge');
    const diskText = document.getElementById('disk-text');
    const batteryGauge = document.getElementById('battery-gauge');
    const batteryText = document.getElementById('battery-text');
    const batteryPlugIcon = document.getElementById('battery-plug-icon');

    // Dialogue Panels & Mic
    const arcReactorButton = document.getElementById('arc-reactor-button');
    const centerPanel = document.querySelector('.center-panel');
    const reactorHint = document.getElementById('reactor-hint');
    const terminalBody = document.getElementById('terminal-body');
    const manualCmdInput = document.getElementById('manual-cmd-input');
    const sendCmdBtn = document.getElementById('send-cmd-btn');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const wakeWordToggle = document.getElementById('wake-word-toggle');

    // Quick Actions
    const volumeSlider = document.getElementById('volume-slider');
    const volumeMuteBtn = document.getElementById('volume-mute-btn');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeValTxt = document.getElementById('volume-val-txt');
    const quickScreenshotBtn = document.getElementById('quick-screenshot-btn');
    const quickLockBtn = document.getElementById('quick-lock-btn');
    const dashboardSearchForm = document.getElementById('dashboard-search-form');
    const dashboardSearchInput = document.getElementById('dashboard-search-input');
    const appButtons = document.querySelectorAll('.app-launch-icon');
    const screenshotModal = document.getElementById('screenshot-modal');
    const screenshotPreviewImg = document.getElementById('screenshot-preview-img');
    const screenshotDownloadLink = document.getElementById('screenshot-download-link');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Tabbed Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // PANEL 2: Scanned Apps Deck Elements
    const scannedAppsGrid = document.getElementById('scanned-apps-grid');
    const appsFilterInput = document.getElementById('apps-filter-input');
    const appsCountTxt = document.getElementById('apps-count-txt');

    // PANEL 3: File Explorer Elements
    const explorerBackBtn = document.getElementById('explorer-back-btn');
    const explorerPathTxt = document.getElementById('explorer-path-txt');
    const filesSearchInput = document.getElementById('files-search-input');
    const filesSearchBtn = document.getElementById('files-search-btn');
    const filesTbody = document.getElementById('files-tbody');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');

    // PANEL 4: Email Hub Elements
    const mailFolderBtns = document.querySelectorAll('.mail-folder-btn');
    const mailFolderTitle = document.getElementById('mail-folder-title');
    const mailFilterInput = document.getElementById('mail-filter-input');
    const mailListDeck = document.getElementById('mail-list-deck');
    const mailSourceTxt = document.getElementById('mail-source-txt');
    const syncMailBtn = document.getElementById('sync-mail-btn');
    
    // Email Modal
    const emailReaderModal = document.getElementById('email-reader-modal');
    const emailViewSubject = document.getElementById('email-view-subject');
    const emailViewSender = document.getElementById('email-view-sender');
    const emailViewTime = document.getElementById('email-view-time');
    const emailViewCategory = document.getElementById('email-view-category');
    const emailViewBody = document.getElementById('email-view-body');
    const closeEmailBtn = document.getElementById('close-email-btn');
    const closeEmailBtnFooter = document.getElementById('close-email-btn-footer');

    // PANEL 5: Sandboxed Shell Elements
    const fullTerminalOutput = document.getElementById('full-terminal-output');
    const fullTerminalInput = document.getElementById('full-terminal-input');
    const fullTerminalSendBtn = document.getElementById('full-terminal-send-btn');

    // State Variables
    let isMuted = false;
    let currentVolume = 50;
    let isSpeaking = false;
    let isListening = false;
    let isWakeWordMode = false;
    let isWokenUp = false;
    let standbyTimer = null;
    const STANDBY_TIMEOUT = 7000;
    
    // File Explorer & Mail State
    let currentDirectoryPath = "";
    let allEmailsList = [];
    let activeMailboxFolder = "all";
    
    const GAUGE_CIRCUMFERENCE = 251.2;

    // --- 1. DIGITAL CLOCK LOGIC ---
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        digitalClock.textContent = `${hours}:${minutes}:${seconds}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 2. SYNTHESIZE SCI-FI AUDIO CHIMES ---
    function playBeep(type = 'wake') {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            if (type === 'wake') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            } else if (type === 'sleep') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880.00, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440.00, ctx.currentTime + 0.18);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.18);
                osc.start();
                osc.stop(ctx.currentTime + 0.18);
            }
        } catch (e) {
            console.warn('Audio context blocked:', e);
        }
    }

    // --- 3. GAUGE ANIMATOR UTILITIES ---
    function setGaugeProgress(gaugeElement, valueTextElement, percent) {
        if (!gaugeElement) return;
        const roundedPercent = Math.round(percent);
        const strokeOffset = GAUGE_CIRCUMFERENCE - (roundedPercent / 100) * GAUGE_CIRCUMFERENCE;
        gaugeElement.style.strokeDashoffset = strokeOffset;
        if (valueTextElement) valueTextElement.textContent = roundedPercent;
    }

    // --- 4. CORE SYSTEM TELEMETRY ---
    async function fetchSystemTelemetry() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('API server unreachable');
            const data = await response.json();

            setGaugeProgress(cpuGauge, cpuText, data.cpu);
            setGaugeProgress(ramGauge, ramText, data.ram);
            setGaugeProgress(diskGauge, diskText, data.disk);
            
            const batteryPercent = data.battery ? data.battery.percent : 100;
            const isPlugged = data.battery ? data.battery.power_plugged : true;
            setGaugeProgress(batteryGauge, batteryText, batteryPercent);
            
            if (isPlugged) {
                batteryPlugIcon.classList.remove('hidden');
                batteryGauge.style.stroke = '#00ff66';
            } else {
                batteryPlugIcon.classList.add('hidden');
                batteryGauge.style.stroke = batteryPercent <= 20 ? 'var(--neon-red)' : batteryPercent <= 50 ? 'var(--neon-orange)' : '#00ff66';
            }

            if (systemUptime) systemUptime.textContent = data.uptime;
            if (systemOS) systemOS.textContent = data.os;
            if (systemNode) systemNode.textContent = data.node.toUpperCase();

            if (document.activeElement !== volumeSlider) {
                updateVolumeControls(data.volume, data.muted);
            }

            if (systemStatusText) {
                systemStatusText.textContent = "SECURE LINK ESTABLISHED";
                systemStatusText.style.color = "var(--text-muted)";
            }
        } catch (error) {
            console.error('Telemetry fetch error:', error);
            if (systemStatusText) {
                systemStatusText.textContent = "LINK INTERRUPTED - RETRYING";
                systemStatusText.style.color = "var(--neon-red)";
            }
        }
    }
    setInterval(fetchSystemTelemetry, 2000);
    fetchSystemTelemetry();

    // --- 5. POLL SYSTEM GLOBAL HOTKEY (CTRL+SHIFT+J) ---
    async function pollGlobalHotkey() {
        try {
            const response = await fetch('/api/hotkey/poll');
            if (response.ok) {
                const data = await response.json();
                if (data.triggered) {
                    appendTerminalLog('SYSTEM', 'Global activation shortcut [Ctrl+Shift+J] triggered!', 'system');
                    triggerVoiceMicAuto();
                }
            }
        } catch (error) {}
    }
    setInterval(pollGlobalHotkey, 800);

    function triggerVoiceMicAuto() {
        if (!recognition) return;
        window.focus();
        playBeep('wake');
        window.speechSynthesis.cancel();
        isSpeaking = false;
        centerPanel.classList.remove('speaking');
        try {
            recognition.start();
        } catch (err) {
            console.log('Mic already active:', err);
        }
    }

    // --- 6. TABS ROUTING DISPATCHER ---
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-target');
            
            // Cycle active button
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Cycle active panels
            tabPanels.forEach(panel => {
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });

            // Trigger specific tab loading hooks
            if (targetTab === 'apps') {
                fetchScannedApplications();
            } else if (targetTab === 'files') {
                fetchExplorerDirectory(currentDirectoryPath); // Default user root
            } else if (targetTab === 'mail') {
                fetchEmails(false);
            } else if (targetTab === 'terminal') {
                setTimeout(() => fullTerminalInput.focus(), 150);
            } else if (targetTab === 'processes') {
                fetchProcesses();
            }
        });
    });

    // --- 7. TERMINAL LOG SYSTEM (BOTTOM MAIN CHAT) ---
    function appendTerminalLog(sender, text, type = 'system') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}-line`;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        line.innerHTML = `<span class="system-line">[${timestamp}]</span> <span class="sender-prefix">${sender}:</span> ${text}`;
        terminalBody.appendChild(line);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    clearLogBtn.addEventListener('click', () => {
        terminalBody.innerHTML = '';
        appendTerminalLog('SYSTEM', 'Log cleared. Monitor listening...', 'system');
    });


    // ==========================================================================
    // 8. EXECUTIVE APPLICATION DECK (PANEL 2)
    // ==========================================================================
    let scannedApplications = [];

    async function fetchScannedApplications() {
        scannedAppsGrid.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-circle-notch fa-spin"></i> Indexing local systems shortcuts...</div>`;
        try {
            const response = await fetch('/api/apps/list');
            const data = await response.json();
            
            if (data.status === "success") {
                scannedApplications = data.apps;
                appsCountTxt.textContent = data.count;
                renderAppsDeck(scannedApplications);
            } else {
                scannedAppsGrid.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-triangle-exclamation"></i> Failed to index system programs, sir.</div>`;
            }
        } catch (err) {
            console.error(err);
            scannedAppsGrid.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-triangle-exclamation"></i> Network error connecting to programs indexing API.</div>`;
        }
    }

    function renderAppsDeck(apps) {
        if (apps.length === 0) {
            scannedAppsGrid.innerHTML = `<div class="sys-loader">No applications found matching filter criteria, sir.</div>`;
            return;
        }

        scannedAppsGrid.innerHTML = '';
        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            
            // Choose app icon dynamically
            let iconClass = 'fa-solid fa-cube';
            const name = app.name.toLowerCase();
            if (name.includes('notepad')) iconClass = 'fa-solid fa-file-lines';
            else if (name.includes('calc')) iconClass = 'fa-solid fa-calculator';
            else if (name.includes('chrome')) iconClass = 'fa-brands fa-chrome';
            else if (name.includes('cmd') || name.includes('command')) iconClass = 'fa-solid fa-terminal';
            else if (name.includes('code') || name.includes('studio')) iconClass = 'fa-solid fa-code';
            else if (name.includes('word')) iconClass = 'fa-solid fa-file-word';
            else if (name.includes('excel')) iconClass = 'fa-solid fa-file-excel';
            else if (name.includes('powerpoint')) iconClass = 'fa-solid fa-file-powerpoint';
            else if (name.includes('spotify')) iconClass = 'fa-brands fa-spotify';
            else if (name.includes('steam')) iconClass = 'fa-brands fa-steam';
            else if (name.includes('photoshop')) iconClass = 'fa-solid fa-image-portrait';
            else if (name.includes('settings') || name.includes('control')) iconClass = 'fa-solid fa-gears';

            card.innerHTML = `
                <div class="app-card-icon"><i class="${iconClass}"></i></div>
                <div class="app-card-info">
                    <h3>${app.name}</h3>
                    <span>LAUNCH EXECUTIVE</span>
                </div>
            `;

            card.addEventListener('click', async () => {
                appendTerminalLog('SYSTEM', `Triggering native launcher sequence for shortcut: '${app.name}'`, 'system');
                playBeep('wake');
                try {
                    const response = await fetch('/api/apps/launch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: app.path })
                    });
                    const res = await response.json();
                    if (res.status === "success") {
                        appendTerminalLog('JARVIS', `Application launched: '${app.name}'`, 'jarvis');
                    } else {
                        appendTerminalLog('SYSTEM', `Launch failed: ${res.message}`, 'system');
                    }
                } catch (err) {
                    appendTerminalLog('SYSTEM', 'Link transmission failure calling local app launcher API.', 'system');
                }
            });

            scannedAppsGrid.appendChild(card);
        });
    }

    // Interactive Apps Filters
    appsFilterInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = scannedApplications.filter(app => app.name.toLowerCase().includes(query));
        renderAppsDeck(filtered);
    });


    // ==========================================================================
    // 9. NATIVE DISK FILE EXPLORER (PANEL 3)
    // ==========================================================================
    
    async function fetchExplorerDirectory(path) {
        filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Reading local directory files...</td></tr>`;
        try {
            const url = path ? `/api/files/browse?path=${encodeURIComponent(path)}` : '/api/files/browse';
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === "success") {
                currentDirectoryPath = data.current_path;
                explorerPathTxt.textContent = currentDirectoryPath;
                
                // Toggle back button if root reached
                explorerBackBtn.disabled = !data.parent_path;
                explorerBackBtn.setAttribute('data-parent', data.parent_path || '');

                renderExplorerItems(data.items);
            } else {
                filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-triangle-exclamation" style="color: var(--neon-red)"></i> Access Denied: ${data.message}</td></tr>`;
            }
        } catch (err) {
            filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-triangle-exclamation" style="color: var(--neon-red)"></i> Failed connecting to local File Explorer database.</td></tr>`;
        }
    }

    function renderExplorerItems(items) {
        if (items.length === 0) {
            filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading">Directory folder is empty, sir.</td></tr>`;
            return;
        }

        filesTbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            // Icon choosing
            let iconClass = 'fa-solid fa-file';
            if (item.type === 'folder') iconClass = 'fa-solid fa-folder';
            else if (item.type === 'pdf') iconClass = 'fa-solid fa-file-pdf';
            else if (item.type === 'doc') iconClass = 'fa-solid fa-file-word';
            else if (item.type === 'image') iconClass = 'fa-solid fa-file-image';
            else if (item.type === 'executable') iconClass = 'fa-solid fa-file-code';
            else if (item.type === 'archive') iconClass = 'fa-solid fa-file-zipper';
            else if (item.type === 'audio') iconClass = 'fa-solid fa-file-audio';
            else if (item.type === 'video') iconClass = 'fa-solid fa-file-video';

            tr.innerHTML = `
                <td><i class="${iconClass}"></i> ${item.name}</td>
                <td style="text-transform: uppercase;">${item.type}</td>
                <td>${item.size || '--'}</td>
                <td>${item.mtime}</td>
            `;

            tr.addEventListener('click', () => {
                if (item.type === 'folder') {
                    // Navigate inside directory
                    fetchExplorerDirectory(item.path);
                } else {
                    // Launch local file via default system app
                    triggerLocalFileOpen(item.path, item.name);
                }
            });

            filesTbody.appendChild(tr);
        });
    }

    async function triggerLocalFileOpen(path, name) {
        appendTerminalLog('SYSTEM', `Requesting default Windows host to open file: '${name}'`, 'system');
        playBeep('wake');
        try {
            const response = await fetch('/api/files/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            const data = await response.json();
            if (data.status === "success") {
                appendTerminalLog('JARVIS', `Launched local document: '${name}' successfully.`, 'jarvis');
            } else {
                appendTerminalLog('SYSTEM', `Open failed: ${data.message}`, 'system');
            }
        } catch (err) {
            appendTerminalLog('SYSTEM', 'Link transmission failure calling local document open API.', 'system');
        }
    }

    // Breadcrumbs Navigation up
    explorerBackBtn.addEventListener('click', () => {
        const parent = explorerBackBtn.getAttribute('data-parent');
        if (parent) fetchExplorerDirectory(parent);
    });

    // Sidebar Shortcuts Bindings
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const type = link.getAttribute('data-shortcut');
            fetchExplorerDirectory(`shortcut:${type}`);
        });
    });

    // Recurse Directory File Search
    async function triggerExplorerSearch() {
        const query = filesSearchInput.value.trim();
        if (!query) return;

        filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching local drives recursively...</td></tr>`;
        try {
            const response = await fetch(`/api/files/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.status === "success") {
                explorerPathTxt.textContent = `Search matches for: "${query}"`;
                explorerBackBtn.disabled = false;
                // Go back button returns to normal user directory
                explorerBackBtn.setAttribute('data-parent', currentDirectoryPath || 'C:\\');
                renderExplorerItems(data.items);
            } else {
                filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-triangle-exclamation"></i> Search failed: ${data.message}</td></tr>`;
            }
        } catch (err) {
            filesTbody.innerHTML = `<tr><td colspan="4" class="table-loading"><i class="fa-solid fa-triangle-exclamation"></i> Failed linking to search engine.</td></tr>`;
        }
    }

    filesSearchBtn.addEventListener('click', triggerExplorerSearch);
    filesSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') triggerExplorerSearch();
    });


    // ==========================================================================
    // 10. EMAIL INTELLIGENCE HUB (PANEL 4)
    // ==========================================================================
    
    async function fetchEmails(sync = false) {
        mailListDeck.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-circle-notch fa-spin"></i> Syncing local Microsoft Outlook databases...</div>`;
        try {
            const response = await fetch('/api/mail/list');
            const data = await response.json();

            if (data.status === "success") {
                allEmailsList = data.emails;
                
                // Scan source type
                const hasOutlookActive = allEmailsList.length > 0 && !allEmailsList[0].id.toString().includes("mock");
                mailSourceTxt.textContent = hasOutlookActive ? "LOCAL OUTLOOK" : "MOCK INTELLIGENCE";

                updateEmailBadges(allEmailsList);
                renderEmailsDeck(allEmailsList, activeMailboxFolder);
            } else {
                mailListDeck.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-triangle-exclamation"></i> Failed to aggregate emails, sir.</div>`;
            }
        } catch (err) {
            console.error(err);
            mailListDeck.innerHTML = `<div class="sys-loader"><i class="fa-solid fa-triangle-exclamation"></i> Network error connecting to mail aggregator.</div>`;
        }
    }

    function updateEmailBadges(emails) {
        // Calculate folders count
        const counts = { all: emails.length, work: 0, financial: 0, alerts: 0, personal: 0, spam: 0 };
        emails.forEach(email => {
            if (counts[email.category] !== undefined) {
                counts[email.category]++;
            }
        });

        // Set counts text
        document.querySelector('.count-all').textContent = counts.all;
        document.querySelector('.count-work').textContent = counts.work;
        document.querySelector('.count-financial').textContent = counts.financial;
        document.querySelector('.count-alerts').textContent = counts.alerts;
        document.querySelector('.count-personal').textContent = counts.personal;
        document.querySelector('.count-spam').textContent = counts.spam;
    }

    function renderEmailsDeck(emails, categoryFilter) {
        const query = mailFilterInput.value.toLowerCase().trim();
        
        // Filter by category
        let filtered = emails;
        if (categoryFilter !== 'all') {
            filtered = emails.filter(m => m.category === categoryFilter);
        }

        // Filter by query search
        if (query) {
            filtered = filtered.filter(m => 
                m.subject.toLowerCase().includes(query) || 
                m.sender.toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            mailListDeck.innerHTML = `<div class="sys-loader">No messages in folder matching query filters, sir.</div>`;
            return;
        }

        mailListDeck.innerHTML = '';
        filtered.forEach(email => {
            const card = document.createElement('div');
            card.className = `mail-item cat-${email.category}`;
            card.innerHTML = `
                <div class="mail-item-header">
                    <span class="mail-item-sender">${email.sender}</span>
                    <span class="mail-item-time">${email.time}</span>
                </div>
                <div class="mail-item-subject">${email.subject}</div>
                <div class="mail-item-body">${email.body}</div>
            `;

            card.addEventListener('click', () => {
                openEmailReaderModal(email);
            });

            mailListDeck.appendChild(card);
        });
    }

    function openEmailReaderModal(email) {
        emailViewSubject.textContent = email.subject;
        emailViewSender.textContent = email.sender;
        emailViewTime.textContent = email.time;
        emailViewCategory.textContent = email.category;
        
        // Color badge based on category
        emailViewCategory.className = `email-view-badge cat-${email.category}`;
        emailViewCategory.style.background = 
            email.category === 'work' ? 'var(--neon-blue)' :
            email.category === 'financial' ? 'var(--neon-orange)' :
            email.category === 'alerts' ? 'var(--neon-red)' :
            email.category === 'personal' ? 'var(--neon-purple)' : '#555555';

        emailViewBody.innerHTML = email.body.replace(/\n/g, '<br>');
        emailReaderModal.classList.remove('hidden');
    }

    // Close Modals
    function closeEmailReader() {
        emailReaderModal.classList.add('hidden');
    }
    closeEmailBtn.addEventListener('click', closeEmailReader);
    closeEmailBtnFooter.addEventListener('click', closeEmailReader);
    emailReaderModal.addEventListener('click', (e) => {
        if (e.target === emailReaderModal) closeEmailReader();
    });

    // Mail Folders Side Filter Bindings
    mailFolderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mailFolderBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            activeMailboxFolder = btn.getAttribute('data-folder');
            mailFolderTitle.textContent = activeMailboxFolder.toUpperCase() + " MESSAGES";
            renderEmailsDeck(allEmailsList, activeMailboxFolder);
        });
    });

    // Force Synchronize
    syncMailBtn.addEventListener('click', () => {
        fetchEmails(true);
    });

    // Dynamic search filter keyups
    mailFilterInput.addEventListener('input', () => {
        renderEmailsDeck(allEmailsList, activeMailboxFolder);
    });


    // ==========================================================================
    // 11. SANDBOX SYSTEM COMMAND SHELL (PANEL 5)
    // ==========================================================================
    
    async function triggerShellCommand() {
        const cmd = fullTerminalInput.value.trim();
        if (!cmd) return;

        // Print input echo line
        const echoLine = document.createElement('div');
        echoLine.className = 'term-line';
        echoLine.innerHTML = `<span class="term-prompt">C:\\Users\\Laptop&gt;</span> ${cmd}`;
        fullTerminalOutput.appendChild(echoLine);
        fullTerminalInput.value = '';

        // Print spinner loader line
        const loaderLine = document.createElement('div');
        loaderLine.className = 'term-line';
        loaderLine.innerHTML = `<span class="system-line"><i class="fa-solid fa-circle-notch fa-spin"></i> Executing local OS process instruction...</span>`;
        fullTerminalOutput.appendChild(loaderLine);
        fullTerminalOutput.scrollTop = fullTerminalOutput.scrollHeight;

        try {
            const response = await fetch('/api/terminal/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
            const data = await response.json();
            
            // Delete loader line
            loaderLine.remove();

            const resLine = document.createElement('pre');
            resLine.className = 'term-line';
            
            // Format standard outputs vs error logs
            if (data.output.startsWith('[ERROR]')) {
                resLine.className += ' term-error';
            } else {
                resLine.className += ' term-success';
            }
            resLine.textContent = data.output;
            fullTerminalOutput.appendChild(resLine);
        } catch (err) {
            loaderLine.remove();
            const errLine = document.createElement('div');
            errLine.className = 'term-line term-error';
            errLine.textContent = `[ERROR] Failed to communicate with sandboxed command shell API: ${err.message}`;
            fullTerminalOutput.appendChild(errLine);
        }
        
        fullTerminalOutput.scrollTop = fullTerminalOutput.scrollHeight;
    }

    fullTerminalSendBtn.addEventListener('click', triggerShellCommand);
    fullTerminalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') triggerShellCommand();
    });


    // ==========================================================================
    // 12. SPEECH SYNTHESIS ENGINE (VOICE BACK)
    // ==========================================================================
    function speakResponse(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;
        
        const voicePreferences = [
            'Google UK English Male',
            'Microsoft Hazel Desktop',
            'Microsoft David',
            'en-GB',
            'en-US'
        ];

        for (const pref of voicePreferences) {
            selectedVoice = voices.find(v => v.name.includes(pref) || v.lang.includes(pref));
            if (selectedVoice) break;
        }

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.pitch = 0.95; 
        utterance.rate = 1.02;  
        
        utterance.onstart = () => {
            isSpeaking = true;
            centerPanel.classList.remove('listening');
            centerPanel.classList.add('speaking');
            reactorHint.textContent = "J.A.R.V.I.S. RESPONDING...";
        };

        utterance.onend = () => {
            isSpeaking = false;
            centerPanel.classList.remove('speaking');
            if (isWakeWordMode) {
                reactorHint.textContent = "WAKE WORD DETECT ACTIVE: SAY 'JARVIS'";
                resumeContinuousListening();
            } else {
                reactorHint.textContent = "TAP REACTOR CORE TO TRANSMIT SPEECH";
            }
        };

        utterance.onerror = (e) => {
            isSpeaking = false;
            centerPanel.classList.remove('speaking');
            if (isWakeWordMode) resumeContinuousListening();
            else reactorHint.textContent = "TAP REACTOR CORE TO TRANSMIT SPEECH";
        };

        window.speechSynthesis.speak(utterance);
    }

    // ==========================================================================
    // 13. SPEECH RECOGNITION (VOICE COMMAND & WAKE)
    // ==========================================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            centerPanel.classList.add('listening');
            if (isWakeWordMode) {
                reactorHint.textContent = isWokenUp ? "AWAITING INTENT COMMAND..." : "SAY 'JARVIS' TO WAKE ASSISTANT";
            } else {
                reactorHint.textContent = "J.A.R.V.I.S. IS LISTENING...";
            }
        };

        recognition.onerror = (event) => {
            isListening = false;
            centerPanel.classList.remove('listening');
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                appendTerminalLog('SYSTEM', `Speech warning: ${event.error}`, 'system');
            }
        };

        recognition.onend = () => {
            isListening = false;
            centerPanel.classList.remove('listening');
            if (isWakeWordMode && !isSpeaking) {
                resumeContinuousListening();
            } else if (!isSpeaking) {
                reactorHint.textContent = "TAP REACTOR CORE TO TRANSMIT SPEECH";
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const lowercaseTranscript = transcript.toLowerCase().trim();

            if (isWakeWordMode) {
                if (!isWokenUp) {
                    if (lowercaseTranscript.includes('jarvis') || lowercaseTranscript.includes('hey jarvis') || lowercaseTranscript.includes('wake up')) {
                        isWokenUp = true;
                        playBeep('wake');
                        appendTerminalLog('SYSTEM', 'Voice Wake Word detected!', 'system');
                        appendTerminalLog('USER', `"${transcript}" [Wake Word]`, 'user');
                        appendTerminalLog('JARVIS', 'At your service, sir. What shall I execute?', 'jarvis');
                        speakResponse("At your service, sir.");
                        startStandbyDialogueTimer();
                    }
                } else {
                    resetStandbyDialogueTimer();
                    let cmdToRun = transcript;
                    if (lowercaseTranscript.startsWith('jarvis ')) cmdToRun = transcript.substring(7);
                    else if (lowercaseTranscript.startsWith('hey jarvis ')) cmdToRun = transcript.substring(11);
                    transmitCommand(cmdToRun);
                }
            } else {
                transmitCommand(transcript);
            }
        };
    }

    function resumeContinuousListening() {
        if (!isWakeWordMode || isSpeaking || isListening) return;
        try { recognition.start(); } catch (e) {}
    }

    function startStandbyDialogueTimer() {
        clearTimeout(standbyTimer);
        standbyTimer = setTimeout(() => {
            if (isWokenUp) {
                isWokenUp = false;
                playBeep('sleep');
                appendTerminalLog('JARVIS', 'Standby dialog window closed passively.', 'jarvis');
                speakResponse("Going to standby, sir.");
            }
        }, STANDBY_TIMEOUT);
    }

    function resetStandbyDialogueTimer() {
        clearTimeout(standbyTimer);
        if (isWokenUp) startStandbyDialogueTimer();
    }

    // Arc Reactor Click
    arcReactorButton.addEventListener('click', () => {
        if (!recognition) {
            appendTerminalLog('SYSTEM', 'Speech recognition engine not supported in your browser.', 'system');
            return;
        }

        if (isWakeWordMode) {
            wakeWordToggle.checked = false;
            isWakeWordMode = false;
            isWokenUp = false;
            clearTimeout(standbyTimer);
            playBeep('sleep');
            appendTerminalLog('SYSTEM', 'Voice Wake Word mode disabled.', 'system');
        }

        if (isListening) {
            recognition.stop();
        } else {
            window.speechSynthesis.cancel();
            isSpeaking = false;
            centerPanel.classList.remove('speaking');
            playBeep('wake');
            try { recognition.start(); } catch (err) { console.error(err); }
        }
    });

    // Toggle switch Voice Wake
    wakeWordToggle.addEventListener('change', (e) => {
        if (!recognition) {
            e.target.checked = false;
            appendTerminalLog('SYSTEM', 'Speech engine is unavailable.', 'system');
            return;
        }

        isWakeWordMode = e.target.checked;
        isWokenUp = false;
        clearTimeout(standbyTimer);

        if (isWakeWordMode) {
            playBeep('wake');
            appendTerminalLog('SYSTEM', 'Voice Activation Mode online. Say "Jarvis" or "Hey Jarvis" to command.', 'system');
            reactorHint.textContent = "WAKE WORD MODE ONLINE: SAY 'JARVIS'";
            
            window.speechSynthesis.cancel();
            isSpeaking = false;
            centerPanel.classList.remove('speaking');
            
            if (isListening) recognition.stop();
            setTimeout(resumeContinuousListening, 300);
        } else {
            playBeep('sleep');
            appendTerminalLog('SYSTEM', 'Voice Activation Mode disabled.', 'system');
            reactorHint.textContent = "TAP REACTOR CORE TO TRANSMIT SPEECH";
            if (isListening) recognition.stop();
        }
    });

    // Transmit commands
    async function transmitCommand(commandString) {
        if (!commandString.trim()) return;
        appendTerminalLog('USER', `"${commandString}"`, 'user');
        
        try {
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: commandString })
            });

            if (!response.ok) throw new Error('Network dispatch error');
            const data = await response.json();

            appendTerminalLog('JARVIS', data.message, 'jarvis');
            speakResponse(data.message);

            if (data.action === "screenshot" && data.status === "success") {
                openScreenshotPreview(data.details);
            } else if (data.action === "volume" && data.status === "success") {
                fetchSystemTelemetry();
            } else if (data.action === "status" && data.status === "success") {
                fetchSystemTelemetry();
            }
        } catch (error) {
            console.error(error);
            appendTerminalLog('SYSTEM', `Command dispatch failed: ${error.message}`, 'system');
            speakResponse("I encountered an error dispatching your command, sir.");
        }
    }


    // ==========================================================================
    // 14. QUICK HARDWARE AUDIO & ACTIONS DECK
    // ==========================================================================
    
    function updateVolumeControls(volume, muted) {
        currentVolume = volume;
        isMuted = muted;
        volumeSlider.value = volume;
        volumeValTxt.textContent = `${volume}%`;

        if (muted) {
            volumeIcon.className = 'fa-solid fa-volume-xmark';
            volumeMuteBtn.classList.add('muted');
        } else {
            volumeMuteBtn.classList.remove('muted');
            volumeIcon.className = volume === 0 ? 'fa-solid fa-volume-off' : volume < 40 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high';
        }
    }

    async function sendVolumeAPI(volumeVal, muteVal) {
        try {
            const bodyData = {};
            if (volumeVal !== null) bodyData.volume = volumeVal;
            if (muteVal !== null) bodyData.mute = muteVal;

            const response = await fetch('/api/volume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            if (response.ok) {
                const data = await response.json();
                updateVolumeControls(data.volume, data.muted);
            }
        } catch (error) {
            console.error(error);
        }
    }

    let volumeDebounceTimer = null;
    volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        volumeValTxt.textContent = `${val}%`;
        // Debounce: only send API call after 150ms of no further slider movement
        clearTimeout(volumeDebounceTimer);
        volumeDebounceTimer = setTimeout(() => sendVolumeAPI(val, null), 150);
    });

    volumeMuteBtn.addEventListener('click', () => {
        sendVolumeAPI(null, !isMuted);
    });

    quickScreenshotBtn.addEventListener('click', () => {
        transmitCommand("take a screenshot");
    });

    quickLockBtn.addEventListener('click', () => {
        transmitCommand("lock my pc");
    });

    dashboardSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = dashboardSearchInput.value.trim();
        if (query) {
            transmitCommand(`search google for ${query}`);
            dashboardSearchInput.value = '';
        }
    });

    appButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetApp = btn.getAttribute('data-app');
            transmitCommand(`open ${targetApp}`);
        });
    });

    // Screenshot Modal Preview
    function openScreenshotPreview(imageUrl) {
        const refreshedUrl = `${imageUrl}?t=${new Date().getTime()}`;
        screenshotPreviewImg.src = refreshedUrl;
        screenshotDownloadLink.href = refreshedUrl;
        screenshotModal.classList.remove('hidden');
    }

    closeModalBtn.addEventListener('click', () => screenshotModal.classList.add('hidden'));
    screenshotModal.addEventListener('click', (e) => {
        if (e.target === screenshotModal) screenshotModal.classList.add('hidden');
    });

    // Local Space key captures
    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'j') {
            e.preventDefault();
            triggerVoiceMicAuto();
            return;
        }

        if (e.code === 'Space' && 
            document.activeElement !== manualCmdInput && 
            document.activeElement !== dashboardSearchInput &&
            document.activeElement !== filesSearchInput &&
            document.activeElement !== mailFilterInput &&
            document.activeElement !== fullTerminalInput &&
            document.activeElement !== appsFilterInput) {
            
            e.preventDefault();
            triggerVoiceMicAuto();
        }
    });

    // Launch Parameter activation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('hotkey') === 'true' || urlParams.get('activate') === 'true') {
        setTimeout(triggerVoiceMicAuto, 1800);
    }

    // Welcome speak (Browser autoplay security policy compliant)
    let hasGreeted = false;
    
    function triggerGreeting() {
        if (hasGreeted) return;
        hasGreeted = true;
        speakResponse("Greetings, sir. J.A.R.V.I.S. laptop assistant online and at your service.");
        
        // Print indicator log
        appendTerminalLog('JARVIS', 'Greetings, sir. J.A.R.V.I.S. laptop assistant online and at your service.', 'jarvis');
    }

    // Try on load (succeeds if user already clicked/refreshed)
    setTimeout(() => {
        try {
            triggerGreeting();
        } catch(e) {}
    }, 1200);

    // Secure user interaction hook to authorize Web Speech synthesizers
    const initGreetingOnInteraction = () => {
        try {
            triggerGreeting();
        } catch(e) {}
        
        window.removeEventListener('click', initGreetingOnInteraction);
        window.removeEventListener('keydown', initGreetingOnInteraction);
    };

    window.addEventListener('click', initGreetingOnInteraction);
    window.addEventListener('keydown', initGreetingOnInteraction);

    // ===================================================================
    //  TOAST NOTIFICATION SYSTEM
    // ===================================================================
    const toastContainer = document.getElementById('toast-container');
    const TOAST_ICONS = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-xmark',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info'
    };

    window.showToast = function(title, message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
            <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
        toastContainer.appendChild(toast);

        const timer = setTimeout(() => dismissToast(toast), duration);
        toast._timer = timer;
    };

    function dismissToast(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        clearTimeout(toast._timer);
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 300);
    }

    // ===================================================================
    //  PROCESS MANAGER
    // ===================================================================
    const processTbody = document.getElementById('process-tbody');
    const processCountTxt = document.getElementById('process-count-txt');
    const processMemTotal = document.getElementById('process-mem-total');
    const processFilterInput = document.getElementById('process-filter-input');
    const refreshProcessesBtn = document.getElementById('refresh-processes-btn');
    let allProcesses = [];

    async function fetchProcesses() {
        try {
            processTbody.innerHTML = '<tr><td colspan="6" class="table-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Scanning system processes...</td></tr>';
            const res = await fetch('/api/processes');
            const data = await res.json();
            if (data.status === 'success') {
                allProcesses = data.processes || [];
                processCountTxt.textContent = data.count || allProcesses.length;
                const totalMem = allProcesses.reduce((sum, p) => sum + p.memory_mb, 0);
                processMemTotal.textContent = `${Math.round(totalMem)} MB`;
                renderProcessTable(allProcesses);
            }
        } catch (err) {
            processTbody.innerHTML = '<tr><td colspan="6" class="table-loading" style="color:var(--neon-red);">Failed to fetch processes.</td></tr>';
        }
    }

    function renderProcessTable(procs) {
        if (procs.length === 0) {
            processTbody.innerHTML = '<tr><td colspan="6" class="table-loading">No processes match your filter.</td></tr>';
            return;
        }
        processTbody.innerHTML = procs.map(p => {
            const cpuVal = p.cpu || 0;
            const cpuClass = cpuVal > 50 ? 'critical' : cpuVal > 20 ? 'warning' : '';
            const statusClass = p.status === 'running' ? 'running' : p.status === 'sleeping' ? 'sleeping' : 'stopped';
            return `
                <tr>
                    <td class="file-col-name" style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem;">${p.pid}</td>
                    <td class="file-col-name">${p.name}</td>
                    <td>
                        <div class="cpu-bar-container">
                            <div style="width:60px;height:5px;background:rgba(255,255,255,0.05);border-radius:3px;">
                                <div class="cpu-bar ${cpuClass}" style="width:${Math.min(cpuVal, 100)}%;"></div>
                            </div>
                            <span style="font-size:0.72rem; font-family:var(--font-mono); color:var(--text-muted);">${cpuVal.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.75rem;">${p.memory_mb} MB</td>
                    <td><span class="status-badge ${statusClass}">${p.status}</span></td>
                    <td><button class="kill-btn" data-pid="${p.pid}" data-name="${p.name}">TERMINATE</button></td>
                </tr>`;
        }).join('');

        // Attach kill event handlers
        processTbody.querySelectorAll('.kill-btn').forEach(btn => {
            btn.addEventListener('click', () => killProcess(btn.dataset.pid, btn.dataset.name));
        });
    }

    async function killProcess(pid, name) {
        try {
            const res = await fetch('/api/processes/kill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pid: parseInt(pid) })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast('Process Terminated', data.message, 'success');
                fetchProcesses(); // Refresh list
            } else {
                showToast('Termination Failed', data.message, 'error');
            }
        } catch (err) {
            showToast('Error', `Failed to terminate process: ${err.message}`, 'error');
        }
    }

    // Process filter
    if (processFilterInput) {
        processFilterInput.addEventListener('input', () => {
            const query = processFilterInput.value.toLowerCase();
            const filtered = allProcesses.filter(p => p.name.toLowerCase().includes(query));
            renderProcessTable(filtered);
        });
    }

    if (refreshProcessesBtn) {
        refreshProcessesBtn.addEventListener('click', fetchProcesses);
    }

    // ===================================================================
    //  COMMAND PALETTE (Ctrl+K)
    // ===================================================================
    const paletteModal = document.getElementById('command-palette-modal');
    const paletteInput = document.getElementById('palette-search-input');
    const paletteResults = document.getElementById('palette-results');
    let paletteActiveIdx = -1;
    let cachedAppsForPalette = [];

    // Built-in commands
    const PALETTE_COMMANDS = [
        { icon: 'fa-solid fa-gauge-high', title: 'Core System', desc: 'View system telemetry', badge: 'Tab', action: () => switchToTab('telemetry') },
        { icon: 'fa-solid fa-cubes', title: 'App Deck', desc: 'Browse installed applications', badge: 'Tab', action: () => switchToTab('apps') },
        { icon: 'fa-solid fa-folder-open', title: 'File Explorer', desc: 'Browse files and folders', badge: 'Tab', action: () => switchToTab('files') },
        { icon: 'fa-solid fa-envelope', title: 'Email Hub', desc: 'View emails from Outlook', badge: 'Tab', action: () => switchToTab('mail') },
        { icon: 'fa-solid fa-terminal', title: 'Shell Terminal', desc: 'Execute shell commands', badge: 'Tab', action: () => switchToTab('terminal') },
        { icon: 'fa-solid fa-microchip', title: 'Task Manager', desc: 'View & kill running processes', badge: 'Tab', action: () => switchToTab('processes') },
        { icon: 'fa-solid fa-camera', title: 'Take Screenshot', desc: 'Capture current screen', badge: 'Action', action: () => sendCommand('screenshot') },
        { icon: 'fa-solid fa-lock', title: 'Lock Screen', desc: 'Lock the workstation', badge: 'Action', action: () => sendCommand('lock screen') },
        { icon: 'fa-solid fa-volume-high', title: 'Volume Up', desc: 'Set volume to 80%', badge: 'Action', action: () => sendCommand('volume to 80') },
        { icon: 'fa-solid fa-volume-low', title: 'Volume Down', desc: 'Set volume to 20%', badge: 'Action', action: () => sendCommand('volume to 20') },
        { icon: 'fa-solid fa-volume-xmark', title: 'Mute Audio', desc: 'Mute system volume', badge: 'Action', action: () => sendCommand('mute') },
    ];

    function switchToTab(tabName) {
        const btn = document.querySelector(`.tab-btn[data-target="${tabName}"]`);
        if (btn) btn.click();
    }

    function sendCommand(cmd) {
        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        }).then(r => r.json()).then(data => {
            if (data.message) showToast('J.A.R.V.I.S.', data.message, 'info');
        });
    }

    // Open/Close palette
    function openPalette() {
        paletteModal.classList.remove('hidden');
        paletteInput.value = '';
        paletteActiveIdx = -1;
        renderPaletteResults('');
        setTimeout(() => paletteInput.focus(), 100);
        // Cache apps list
        fetch('/api/apps/list').then(r => r.json()).then(data => {
            if (data.apps) cachedAppsForPalette = data.apps;
        }).catch(() => {});
    }

    function closePalette() {
        paletteModal.classList.add('hidden');
        paletteInput.value = '';
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (paletteModal.classList.contains('hidden')) {
                openPalette();
            } else {
                closePalette();
            }
        }
        if (e.key === 'Escape' && !paletteModal.classList.contains('hidden')) {
            closePalette();
        }
    });

    paletteModal.addEventListener('click', (e) => {
        if (e.target === paletteModal) closePalette();
    });

    // Search & render
    paletteInput.addEventListener('input', () => {
        const q = paletteInput.value.toLowerCase();
        paletteActiveIdx = -1;
        renderPaletteResults(q);
    });

    function renderPaletteResults(query) {
        let items = [];

        // Match built-in commands
        PALETTE_COMMANDS.forEach(cmd => {
            if (!query || cmd.title.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query)) {
                items.push(cmd);
            }
        });

        // Match apps
        if (query.length >= 2) {
            cachedAppsForPalette.forEach(app => {
                if (app.name.toLowerCase().includes(query)) {
                    items.push({
                        icon: 'fa-solid fa-rocket',
                        title: app.name,
                        desc: 'Launch application',
                        badge: 'App',
                        action: () => {
                            fetch('/api/apps/launch', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: app.path })
                            }).then(r => r.json()).then(d => {
                                showToast('App Launched', `${app.name} started successfully`, 'success');
                            });
                        }
                    });
                }
            });
        }

        if (items.length === 0) {
            paletteResults.innerHTML = '<div class="palette-hint">No results found. Try a different search term.</div>';
            return;
        }

        paletteResults.innerHTML = items.slice(0, 15).map((item, idx) => `
            <div class="palette-item" data-idx="${idx}">
                <i class="${item.icon}"></i>
                <div class="palette-item-info">
                    <div class="palette-item-title">${item.title}</div>
                    <div class="palette-item-desc">${item.desc}</div>
                </div>
                <span class="palette-item-badge">${item.badge}</span>
            </div>
        `).join('');

        // Store items reference for action execution
        paletteResults._items = items.slice(0, 15);

        // Click handlers
        paletteResults.querySelectorAll('.palette-item').forEach((el, i) => {
            el.addEventListener('click', () => {
                closePalette();
                if (paletteResults._items[i]) paletteResults._items[i].action();
            });
        });
    }

    // Keyboard navigation in palette
    paletteInput.addEventListener('keydown', (e) => {
        const items = paletteResults.querySelectorAll('.palette-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            paletteActiveIdx = Math.min(paletteActiveIdx + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle('active', i === paletteActiveIdx));
            items[paletteActiveIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            paletteActiveIdx = Math.max(paletteActiveIdx - 1, 0);
            items.forEach((el, i) => el.classList.toggle('active', i === paletteActiveIdx));
            items[paletteActiveIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (paletteActiveIdx >= 0 && paletteResults._items[paletteActiveIdx]) {
                closePalette();
                paletteResults._items[paletteActiveIdx].action();
            }
        }
    });

    // Show welcome toast on load
    setTimeout(() => showToast('System Online', 'J.A.R.V.I.S. is fully operational. Press Ctrl+K for quick commands.', 'info', 6000), 1500);

});
