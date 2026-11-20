/**
 * EEE FEST 2026 - Master Verification & Admin Portal Engine
 * Dual Architecture: Live Flask Backend + Client-Side Offline Runtime
 */

// Global State
let currentCategory = 'raffle';
let isLiveApi = false;
let currentAdmin = null; // { id, name, email, role, allowed_sections }
let settingsState = {
  enable_raffle: true,
  enable_lunch: true,
  enable_tshirt: true,
  event_name: 'DIU EEE FEST 2026'
};

// Scanner State
let html5QrCode = null;
let isScannerRunning = false;
let currentCameraIndex = 0;
let availableCameras = [];
let lastScannedCode = null;
let lastScanTime = 0;

// Table Pagination State
let currentPage = 1;
const itemsPerPage = 25;
let searchQuery = '';
let statusFilter = 'all';

// In-Memory Offline Storage (LocalStorage backed)
let localCoupons = [];
let localAdmins = [];
let localActivity = [];

// ========================================================
// SOUND EFFECTS SYNTHESIZER (Web Audio API)
// ========================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Two-tone rising major third chime
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  }

  playWarning() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.35);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playError() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.1, 0.2].forEach(offset => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, now + offset);
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }
}

const sfx = new SoundEngine();

// ========================================================
// INITIALIZATION
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  await initStorageAndConnection();
  initCategoryTabs();
  initAuthUI();
  initSuperAdminControls();
  initScanner();
  initManualForm();
  initTableControls();
  initExportButton();
  updateUIForCurrentCategory();
  refreshStatsAndTable();
});

// Detect environment and seed offline storage if needed
async function initStorageAndConnection() {
  const statusLabel = document.getElementById('connectionStatusLabel');

  // Load session admin if saved
  const savedAdmin = localStorage.getItem('eeefest_logged_admin');
  if (savedAdmin) {
    try {
      currentAdmin = JSON.parse(savedAdmin);
    } catch (e) {
      currentAdmin = null;
    }
  }

  // Probe live Flask backend
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    if (res.ok) {
      isLiveApi = true;
      statusLabel.innerText = 'LIVE SERVER (1,260 COUPONS LOADED)';
      statusLabel.style.color = 'var(--success)';
      const data = await res.json();
      if (data.settings) {
        settingsState = data.settings;
      }
      return;
    }
  } catch (err) {
    // API not reachable or running on file:///
    isLiveApi = false;
  }

  // Offline / Client-Side Fallback Mode
  statusLabel.innerText = 'CLIENT RUNTIME (OFFLINE READY)';
  statusLabel.style.color = 'var(--primary)';

  // Seed coupons
  const storedCoupons = localStorage.getItem('eeefest_coupons');
  if (storedCoupons) {
    localCoupons = JSON.parse(storedCoupons);
  } else if (window.INITIAL_COUPONS_DATA) {
    localCoupons = JSON.parse(JSON.stringify(window.INITIAL_COUPONS_DATA));
    localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));
  }

  // Seed admins
  const storedAdmins = localStorage.getItem('eeefest_admins');
  if (storedAdmins) {
    localAdmins = JSON.parse(storedAdmins);
  } else if (window.INITIAL_ADMINS_DATA) {
    localAdmins = JSON.parse(JSON.stringify(window.INITIAL_ADMINS_DATA));
    localStorage.setItem('eeefest_admins', JSON.stringify(localAdmins));
  }

  // Seed settings
  const storedSettings = localStorage.getItem('eeefest_settings');
  if (storedSettings) {
    settingsState = JSON.parse(storedSettings);
  } else if (window.INITIAL_SETTINGS_DATA) {
    settingsState = JSON.parse(JSON.stringify(window.INITIAL_SETTINGS_DATA));
    localStorage.setItem('eeefest_settings', JSON.stringify(settingsState));
  }
}

// ========================================================
// AUTH & ADMIN MANAGEMENT
// ========================================================
function initAuthUI() {
  const authNav = document.getElementById('authNavContainer');
  const loginModal = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeLoginBtn = document.getElementById('closeLoginModalBtn');
  const loginForm = document.getElementById('adminLoginForm');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  // Render Navbar auth state
  renderAuthNavbar();

  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
      loginErrorMsg.style.display = 'none';
      loginModal.style.display = 'flex';
    });
  }

  if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', () => {
      loginModal.style.display = 'none';
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmailInput').value.trim().toLowerCase();
    const password = document.getElementById('loginPasswordInput').value.trim();
    loginErrorMsg.style.display = 'none';

    try {
      if (isLiveApi) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          currentAdmin = data.admin;
          localStorage.setItem('eeefest_logged_admin', JSON.stringify(currentAdmin));
          loginModal.style.display = 'none';
          renderAuthNavbar();
          updateUIForCurrentCategory();
          sfx.playSuccess();
        } else {
          loginErrorMsg.innerText = data.message || 'Login failed';
          loginErrorMsg.style.display = 'block';
          sfx.playError();
        }
      } else {
        // Offline Auth
        const admin = localAdmins.find(a => a.email.toLowerCase() === email && a.password === password);
        if (admin) {
          currentAdmin = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            allowed_sections: admin.allowed_sections
          };
          localStorage.setItem('eeefest_logged_admin', JSON.stringify(currentAdmin));
          loginModal.style.display = 'none';
          renderAuthNavbar();
          updateUIForCurrentCategory();
          sfx.playSuccess();
        } else {
          loginErrorMsg.innerText = 'Invalid email or password.';
          loginErrorMsg.style.display = 'block';
          sfx.playError();
        }
      }
    } catch (err) {
      loginErrorMsg.innerText = 'Connection error during login.';
      loginErrorMsg.style.display = 'block';
    }
  });
}

function renderAuthNavbar() {
  const authNav = document.getElementById('authNavContainer');
  const superDeck = document.getElementById('superAdminDeck');

  if (!currentAdmin) {
    // Guest / Not logged in
    authNav.innerHTML = `
      <button id="openLoginBtn" class="btn btn-sm btn-primary">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
        Admin Login
      </button>
    `;
    document.getElementById('openLoginBtn').addEventListener('click', () => {
      document.getElementById('loginModal').style.display = 'flex';
    });
    if (superDeck) superDeck.style.display = 'none';
  } else {
    // Logged in
    const isSuper = currentAdmin.role === 'superadmin';
    const sectionsText = isSuper ? 'ALL SECTIONS' : currentAdmin.allowed_sections.map(s => s.toUpperCase()).join(', ');
    
    authNav.innerHTML = `
      <div class="user-badge">
        <span>👤 <strong>${currentAdmin.name}</strong></span>
        <span class="role-tag ${isSuper ? 'superadmin' : ''}">${isSuper ? 'SUPER ADMIN' : sectionsText}</span>
        <button id="logoutBtn" class="btn btn-sm btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;">Logout</button>
      </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      currentAdmin = null;
      localStorage.removeItem('eeefest_logged_admin');
      renderAuthNavbar();
      updateUIForCurrentCategory();
    });

    if (superDeck) {
      superDeck.style.display = isSuper ? 'block' : 'none';
      if (isSuper) {
        document.getElementById('toggleRaffle').checked = !!settingsState.enable_raffle;
        document.getElementById('toggleLunch').checked = !!settingsState.enable_lunch;
        document.getElementById('toggleTshirt').checked = !!settingsState.enable_tshirt;
      }
    }
  }
}

// Window helper for quick demo fill
window.fillLoginForm = function(email, password) {
  document.getElementById('loginEmailInput').value = email;
  document.getElementById('loginPasswordInput').value = password;
};

// ========================================================
// SUPER ADMIN SECTION CONTROLS & ADMIN ROSTER
// ========================================================
function initSuperAdminControls() {
  const toggleRaffle = document.getElementById('toggleRaffle');
  const toggleLunch = document.getElementById('toggleLunch');
  const toggleTshirt = document.getElementById('toggleTshirt');
  const openAdminModalBtn = document.getElementById('openAdminModalBtn');
  const adminModal = document.getElementById('adminModal');
  const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
  const addAdminForm = document.getElementById('addAdminForm');

  const updateSettingToggle = async () => {
    settingsState.enable_raffle = toggleRaffle.checked;
    settingsState.enable_lunch = toggleLunch.checked;
    settingsState.enable_tshirt = toggleTshirt.checked;

    if (isLiveApi) {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsState)
        });
      } catch (e) {
        console.error('Failed to sync settings with live server', e);
      }
    } else {
      localStorage.setItem('eeefest_settings', JSON.stringify(settingsState));
    }

    updateUIForCurrentCategory();
  };

  toggleRaffle.addEventListener('change', updateSettingToggle);
  toggleLunch.addEventListener('change', updateSettingToggle);
  toggleTshirt.addEventListener('change', updateSettingToggle);

  if (openAdminModalBtn) {
    openAdminModalBtn.addEventListener('click', () => {
      loadAdminsTable();
      adminModal.style.display = 'flex';
    });
  }

  if (closeAdminModalBtn) {
    closeAdminModalBtn.addEventListener('click', () => {
      adminModal.style.display = 'none';
    });
  }

  if (addAdminForm) {
    addAdminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newAdminName').value.trim();
      const email = document.getElementById('newAdminEmail').value.trim().toLowerCase();
      const password = document.getElementById('newAdminPassword').value.trim();
      
      const allowed = [];
      if (document.getElementById('permRaffle').checked) allowed.push('raffle');
      if (document.getElementById('permLunch').checked) allowed.push('lunch');
      if (document.getElementById('permTshirt').checked) allowed.push('tshirt');

      const msgBox = document.getElementById('addAdminMsg');
      msgBox.style.display = 'none';

      if (allowed.length === 0) {
        msgBox.innerText = 'Please select at least one authorized scanning section.';
        msgBox.style.background = 'var(--warning-bg)';
        msgBox.style.color = 'var(--warning)';
        msgBox.style.display = 'block';
        return;
      }

      if (isLiveApi) {
        try {
          const res = await fetch('/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, allowed_sections: allowed })
          });
          const data = await res.json();
          if (data.success) {
            msgBox.innerText = data.message;
            msgBox.style.background = 'var(--success-bg)';
            msgBox.style.color = 'var(--success)';
            msgBox.style.display = 'block';
            addAdminForm.reset();
            document.getElementById('permRaffle').checked = true;
            document.getElementById('permLunch').checked = true;
            document.getElementById('permTshirt').checked = true;
            loadAdminsTable();
            sfx.playSuccess();
          } else {
            msgBox.innerText = data.message;
            msgBox.style.background = 'var(--danger-bg)';
            msgBox.style.color = '#ff80ab';
            msgBox.style.display = 'block';
            sfx.playError();
          }
        } catch (err) {
          msgBox.innerText = 'Network error saving admin.';
          msgBox.style.background = 'var(--danger-bg)';
          msgBox.style.color = '#ff80ab';
          msgBox.style.display = 'block';
        }
      } else {
        // Offline add admin
        if (localAdmins.some(a => a.email.toLowerCase() === email)) {
          msgBox.innerText = `Admin with email '${email}' already exists.`;
          msgBox.style.background = 'var(--danger-bg)';
          msgBox.style.color = '#ff80ab';
          msgBox.style.display = 'block';
          sfx.playError();
          return;
        }

        const newAdmin = {
          id: `admin_${Date.now()}`,
          name,
          email,
          password,
          role: 'admin',
          allowed_sections: allowed,
          created_at: new Date().toLocaleString()
        };

        localAdmins.push(newAdmin);
        localStorage.setItem('eeefest_admins', JSON.stringify(localAdmins));
        msgBox.innerText = `Admin '${name}' successfully added!`;
        msgBox.style.background = 'var(--success-bg)';
        msgBox.style.color = 'var(--success)';
        msgBox.style.display = 'block';
        addAdminForm.reset();
        document.getElementById('permRaffle').checked = true;
        document.getElementById('permLunch').checked = true;
        document.getElementById('permTshirt').checked = true;
        loadAdminsTable();
        sfx.playSuccess();
      }
    });
  }
}

async function loadAdminsTable() {
  const tbody = document.getElementById('adminListTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-2">Loading...</td></tr>';

  let list = [];
  if (isLiveApi) {
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      list = data.admins || [];
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-2 text-danger">Failed to load admins.</td></tr>';
      return;
    }
  } else {
    list = localAdmins;
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-2">No admins registered.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    const isSuper = a.role === 'superadmin';
    const tags = isSuper 
      ? '<span class="section-tag raffle">ALL</span>' 
      : (a.allowed_sections || []).map(s => `<span class="section-tag ${s}">${s.toUpperCase()}</span>`).join('');

    const deleteBtn = isSuper 
      ? '<span style="color: var(--text-dim); font-size: 0.75rem;">Protected</span>' 
      : `<button class="btn btn-sm btn-danger" onclick="deleteAdminAccount('${a.id}', '${a.name}')" style="padding: 0.15rem 0.5rem; font-size: 0.72rem;">Delete</button>`;

    return `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>${a.email}</td>
        <td><span class="role-tag ${isSuper ? 'superadmin' : ''}">${a.role.toUpperCase()}</span></td>
        <td>${tags}</td>
        <td>${deleteBtn}</td>
      </tr>
    `;
  }).join('');
}

window.deleteAdminAccount = async function(id, name) {
  if (!confirm(`Are you sure you want to remove admin "${name}"?`)) return;

  if (isLiveApi) {
    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadAdminsTable();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('Failed to delete admin');
    }
  } else {
    localAdmins = localAdmins.filter(a => a.id !== id);
    localStorage.setItem('eeefest_admins', JSON.stringify(localAdmins));
    loadAdminsTable();
  }
};

// ========================================================
// CATEGORY TABS & UI PERMISSION GATING
// ========================================================
function initCategoryTabs() {
  const tabs = document.querySelectorAll('.cat-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetCategory = tab.dataset.category;
      
      // Check if disabled by super admin
      const isEnabled = isCategoryGloballyEnabled(targetCategory);
      if (!isEnabled) {
        sfx.playWarning();
        showLockNotice(`⚠️ Scanning for ${getCategoryTitle(targetCategory)} is currently DISABLED by the Super Admin.`);
        return;
      }

      // Check if logged in admin has permission
      if (currentAdmin && currentAdmin.role !== 'superadmin') {
        if (!currentAdmin.allowed_sections.includes(targetCategory)) {
          sfx.playError();
          showLockNotice(`⛔ ACCESS DENIED: Your account is only authorized for: ${currentAdmin.allowed_sections.map(s => s.toUpperCase()).join(', ')}.`);
          return;
        }
      }

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = targetCategory;

      hideLockNotice();
      updateUIForCurrentCategory();
      resetResultBox();
      refreshStatsAndTable();
    });
  });
}

function isCategoryGloballyEnabled(cat) {
  if (cat === 'lunch') return !!settingsState.enable_lunch;
  if (cat === 'tshirt') return !!settingsState.enable_tshirt;
  return !!settingsState.enable_raffle;
}

function getCategoryTitle(cat) {
  if (cat === 'lunch') return 'Lunch & Drinks Booth';
  if (cat === 'tshirt') return 'T-Shirt Distribution';
  return 'Raffle Draw Entry';
}

function updateUIForCurrentCategory() {
  const pill = document.getElementById('activeCategoryPill');
  const tabRaffle = document.getElementById('tabRaffle');
  const tabLunch = document.getElementById('tabLunch');
  const tabTshirt = document.getElementById('tabTshirt');

  // Update tabs disabled badges
  const checkTab = (tab, cat) => {
    const badge = tab.querySelector('.tab-badge-off');
    const enabled = isCategoryGloballyEnabled(cat);
    let allowed = true;
    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      allowed = currentAdmin.allowed_sections.includes(cat);
    }

    if (!enabled) {
      tab.classList.add('tab-disabled');
      badge.innerText = 'OFF';
      badge.style.display = 'inline-block';
    } else if (!allowed) {
      tab.classList.add('tab-disabled');
      badge.innerText = 'NO ACCESS';
      badge.style.display = 'inline-block';
    } else {
      tab.classList.remove('tab-disabled');
      badge.style.display = 'none';
    }
  };

  checkTab(tabRaffle, 'raffle');
  checkTab(tabLunch, 'lunch');
  checkTab(tabTshirt, 'tshirt');

  // Pill Title
  if (currentCategory === 'lunch') {
    pill.innerText = '🍱 Lunch & Drinks Booth';
  } else if (currentCategory === 'tshirt') {
    pill.innerText = '👕 T-Shirt Booth';
  } else {
    pill.innerText = '🎟️ Raffle Draw';
  }

  // Active category permission check
  const isEnabled = isCategoryGloballyEnabled(currentCategory);
  if (!isEnabled) {
    showLockNotice(`⚠️ Scanning for ${getCategoryTitle(currentCategory)} is currently DISABLED by the Super Admin.`);
  } else if (currentAdmin && currentAdmin.role !== 'superadmin' && !currentAdmin.allowed_sections.includes(currentCategory)) {
    showLockNotice(`⛔ ACCESS DENIED: Your account is only authorized for: ${currentAdmin.allowed_sections.map(s => s.toUpperCase()).join(', ')}.`);
  } else {
    hideLockNotice();
  }
}

function showLockNotice(msg) {
  const notice = document.getElementById('sectionLockNotice');
  notice.innerText = msg;
  notice.style.display = 'block';
}

function hideLockNotice() {
  const notice = document.getElementById('sectionLockNotice');
  notice.style.display = 'none';
}

// ========================================================
// VERIFICATION ENGINE (SCANNER + MANUAL)
// ========================================================
function initManualForm() {
  const form = document.getElementById('manualEntryForm');
  const input = document.getElementById('manualCodeInput');

  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    verifyCode(code);
    input.value = '';
    input.focus();
  });
}

function initScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const flipBtn = document.getElementById('flipCameraBtn');
  const selectRow = document.getElementById('cameraSelectRow');
  const select = document.getElementById('cameraSelect');

  if (typeof Html5Qrcode === 'undefined') {
    console.warn('Html5Qrcode scanner library is unavailable.');
    return;
  }

  html5QrCode = new Html5Qrcode('qrReader');

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      availableCameras = devices;
      select.innerHTML = '';
      devices.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.id;
        opt.text = cam.label || `Camera ${idx + 1}`;
        select.appendChild(opt);
      });
      if (devices.length > 1) {
        selectRow.style.display = 'flex';
        flipBtn.style.display = 'inline-flex';
      }
    }
  }).catch(err => {
    console.log('Camera permission prompt or error:', err);
  });

  toggleBtn.addEventListener('click', () => {
    sfx.init();
    if (isScannerRunning) {
      stopScanner();
    } else {
      startScanner();
    }
  });

  flipBtn.addEventListener('click', () => {
    if (availableCameras.length > 1) {
      currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
      select.selectedIndex = currentCameraIndex;
      if (isScannerRunning) {
        stopScanner().then(() => startScanner());
      }
    }
  });

  select.addEventListener('change', () => {
    currentCameraIndex = select.selectedIndex;
    if (isScannerRunning) {
      stopScanner().then(() => startScanner());
    }
  });
}

function startScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const overlay = document.getElementById('scannerOverlay');

  const cameraId = availableCameras.length > 0 
    ? availableCameras[currentCameraIndex].id 
    : { facingMode: 'environment' };

  html5QrCode.start(
    cameraId,
    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
    onQrCodeSuccess,
    () => {}
  ).then(() => {
    isScannerRunning = true;
    toggleBtn.innerText = 'Stop Camera';
    toggleBtn.classList.replace('btn-primary', 'btn-danger');
    overlay.style.display = 'flex';
  }).catch(err => {
    console.error('Failed to start camera:', err);
    alert('Unable to access camera. Please allow camera permissions in your browser.');
  });
}

function stopScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const overlay = document.getElementById('scannerOverlay');

  if (!html5QrCode || !isScannerRunning) return Promise.resolve();

  return html5QrCode.stop().then(() => {
    isScannerRunning = false;
    toggleBtn.innerText = 'Start Camera';
    toggleBtn.classList.replace('btn-danger', 'btn-primary');
    overlay.style.display = 'none';
  }).catch(err => console.error('Error stopping camera:', err));
}

function onQrCodeSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedCode && (now - lastScanTime < 3000)) {
    return; // Debounce rapid repeated frames
  }
  lastScannedCode = decodedText;
  lastScanTime = now;
  verifyCode(decodedText);
}

// ========================================================
// CORE VERIFICATION ROUTINE
// ========================================================
async function verifyCode(rawCode) {
  let cleanCode = rawCode.trim().toUpperCase();
  if (cleanCode.includes('CODE=')) {
    cleanCode = cleanCode.split('CODE=')[1].split('&')[0].trim();
  } else if (cleanCode.includes('/')) {
    cleanCode = cleanCode.split('/').pop().trim();
  }

  // Pre-check 1: Is this section active?
  if (!isCategoryGloballyEnabled(currentCategory)) {
    sfx.playWarning();
    renderResultBox('DISABLED', `Scanning for ${getCategoryTitle(currentCategory)} is currently DISABLED by the Super Admin.`);
    addActivityLog({
      time: new Date().toLocaleTimeString(),
      code: cleanCode,
      status: 'DISABLED',
      category: getCategoryTitle(currentCategory),
      message: 'Scan rejected: Section disabled'
    });
    return;
  }

  // Pre-check 2: Is admin authorized?
  if (currentAdmin && currentAdmin.role !== 'superadmin') {
    if (!currentAdmin.allowed_sections.includes(currentCategory)) {
      sfx.playError();
      renderResultBox('DENIED', `ACCESS DENIED: Your admin account is not authorized to scan for ${getCategoryTitle(currentCategory)}.`);
      addActivityLog({
        time: new Date().toLocaleTimeString(),
        code: cleanCode,
        status: 'DENIED',
        category: getCategoryTitle(currentCategory),
        message: 'Permission denied for current admin'
      });
      return;
    }
  }

  const adminEmail = currentAdmin ? currentAdmin.email : '';
  const adminName = currentAdmin ? currentAdmin.name : 'Admin Desk';

  if (isLiveApi) {
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          category: currentCategory,
          admin_email: adminEmail
        })
      });
      const data = await res.json();
      handleVerifyResponse(data, cleanCode);
    } catch (err) {
      console.error('Verify error:', err);
      renderResultBox('ERROR', 'Network connection error during verification.');
    }
  } else {
    // Offline verification engine
    handleOfflineVerify(cleanCode, adminName);
  }
}

function handleVerifyResponse(data, code) {
  if (data.status === 'SUCCESS') {
    sfx.playSuccess();
    renderResultBox('SUCCESS', data.message, data.coupon);
  } else if (data.status === 'ALREADY_SUBMITTED') {
    sfx.playWarning();
    renderResultBox('ALREADY_SUBMITTED', data.message, data.coupon);
  } else if (data.status === 'COUNTERFEIT') {
    sfx.playError();
    renderResultBox('COUNTERFEIT', data.message);
  } else {
    sfx.playError();
    renderResultBox('DENIED', data.message);
  }
  refreshStatsAndTable();
}

function handleOfflineVerify(cleanCode, adminName) {
  const timestamp = new Date().toLocaleString();
  const coupon = localCoupons.find(c => c.code.toUpperCase() === cleanCode);

  let statusKey, timeKey, byKey, actionName, claimedVal;
  if (currentCategory === 'lunch') {
    statusKey = 'lunch_status';
    timeKey = 'lunch_redeemed_at';
    byKey = 'lunch_scanned_by';
    actionName = 'Lunch & Drinks';
    claimedVal = 'REDEEMED';
  } else if (currentCategory === 'tshirt') {
    statusKey = 'tshirt_status';
    timeKey = 'tshirt_redeemed_at';
    byKey = 'tshirt_scanned_by';
    actionName = 'T-Shirt';
    claimedVal = 'REDEEMED';
  } else {
    statusKey = 'raffle_status';
    timeKey = 'raffle_submitted_at';
    byKey = 'raffle_scanned_by';
    actionName = 'Raffle Draw';
    claimedVal = 'SUBMITTED';
  }

  // 1. Counterfeit Check
  if (!coupon) {
    sfx.playError();
    const msg = `COUNTERFEIT ALERT! Code '${cleanCode}' does NOT exist in the official EEE FEST 2026 database.`;
    renderResultBox('COUNTERFEIT', msg);
    addActivityLog({ time: timestamp, code: cleanCode, status: 'COUNTERFEIT', category: actionName, message: msg });
    return;
  }

  // 2. Duplicate Check
  if (coupon[statusKey] === claimedVal) {
    sfx.playWarning();
    const prevTime = coupon[timeKey] || 'Earlier';
    const prevBy = coupon[byKey] || 'Admin';
    const msg = `ALREADY SUBMITTED! Coupon #${String(coupon.serial).padStart(4, '0')} (${cleanCode}) was already registered for ${actionName} on ${prevTime} by ${prevBy}. Duplicate entry blocked!`;
    renderResultBox('ALREADY_SUBMITTED', msg, coupon);
    addActivityLog({ time: timestamp, code: cleanCode, serial: coupon.serial, status: 'ALREADY_SUBMITTED', category: actionName, message: msg });
    return;
  }

  // 3. Mark as redeemed
  coupon[statusKey] = claimedVal;
  coupon[timeKey] = timestamp;
  coupon[byKey] = adminName;
  localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));

  sfx.playSuccess();
  const msg = `VERIFIED! Coupon #${String(coupon.serial).padStart(4, '0')} (${cleanCode}) successfully registered for ${actionName} by ${adminName}.`;
  renderResultBox('SUCCESS', msg, coupon);
  addActivityLog({ time: timestamp, code: cleanCode, serial: coupon.serial, status: 'SUCCESS', category: actionName, message: `Verified & redeemed by ${adminName}` });
  refreshStatsAndTable();
}

function renderResultBox(status, message, coupon = null) {
  const box = document.getElementById('resultBox');
  box.className = 'result-box';

  let iconSvg = '';
  let title = '';

  if (status === 'SUCCESS') {
    box.classList.add('result-valid');
    title = 'VALID & REGISTERED';
    iconSvg = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else if (status === 'ALREADY_SUBMITTED') {
    box.classList.add('result-warning');
    title = 'DUPLICATE ENTRY DETECTED';
    iconSvg = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else if (status === 'COUNTERFEIT') {
    box.classList.add('result-invalid');
    title = 'COUNTERFEIT DETECTED';
    iconSvg = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></line><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else {
    box.classList.add('result-warning');
    title = 'ACTION BLOCKED';
    iconSvg = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
  }

  let extraDetails = '';
  if (coupon) {
    extraDetails = `
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.15); display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem;">
        <div>SL: <strong>#${String(coupon.serial).padStart(4, '0')}</strong></div>
        <div>Code: <strong>${coupon.code}</strong></div>
        <div>Raffle: <strong>${coupon.raffle_status}</strong></div>
        <div>Lunch: <strong>${coupon.lunch_status}</strong></div>
        <div>T-Shirt: <strong>${coupon.tshirt_status}</strong></div>
      </div>
    `;
  }

  box.innerHTML = `
    <div class="result-icon">${iconSvg}</div>
    <div class="result-body">
      <h3 class="result-title">${title}</h3>
      <p class="result-message">${message}</p>
      ${extraDetails}
    </div>
  `;
}

function resetResultBox() {
  const box = document.getElementById('resultBox');
  box.className = 'result-box result-standby';
  box.innerHTML = `
    <div class="result-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
    </div>
    <div class="result-body">
      <h3 class="result-title">Ready to Scan</h3>
      <p class="result-message">Point camera at coupon QR code or enter the 4-digit code manually.</p>
    </div>
  `;
}

// ========================================================
// ACTIVITY LOG & STATS
// ========================================================
function addActivityLog(entry) {
  localActivity.unshift(entry);
  if (localActivity.length > 20) localActivity.pop();
  renderActivityList(localActivity);
}

function renderActivityList(items) {
  const list = document.getElementById('activityList');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="activity-empty">No scans recorded yet in this session.</div>';
    return;
  }

  list.innerHTML = items.slice(0, 15).map(item => {
    let badgeClass = 'status-badge ';
    if (item.status === 'SUCCESS') badgeClass += 'badge-success';
    else if (item.status === 'ALREADY_SUBMITTED') badgeClass += 'badge-warning';
    else badgeClass += 'badge-danger';

    return `
      <div class="activity-item">
        <div class="activity-left">
          <span class="${badgeClass}">${item.status}</span>
          <span class="activity-code">${item.code}</span>
          <span style="font-size: 0.78rem; color: var(--text-dim);">${item.category || ''}</span>
        </div>
        <div class="activity-right">
          <span class="activity-time">${item.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================================
// STATS & MASTER TABLE CONTROLS
// ========================================================
async function refreshStatsAndTable() {
  await fetchStats();
  await fetchCoupons();
}

async function fetchStats() {
  const statTotal = document.getElementById('statTotal');
  const statSubmitted = document.getElementById('statSubmitted');
  const statRemaining = document.getElementById('statRemaining');
  const statPercent = document.getElementById('statPercent');
  const progressBar = document.getElementById('statProgressBar');

  if (isLiveApi) {
    try {
      const res = await fetch(`/api/stats?category=${currentCategory}`);
      const data = await res.json();
      statTotal.innerText = data.total.toLocaleString();
      statSubmitted.innerText = data.submitted.toLocaleString();
      statRemaining.innerText = data.remaining.toLocaleString();
      statPercent.innerText = `${data.percentage}% completion`;
      progressBar.style.width = `${data.percentage}%`;
      renderActivityList(data.recent_activity);
      return;
    } catch (e) {
      console.warn('Stats fetch error, falling back to local memory');
    }
  }

  // Offline stats
  const total = localCoupons.length;
  let submitted = 0;
  if (currentCategory === 'lunch') {
    submitted = localCoupons.filter(c => c.lunch_status === 'REDEEMED').length;
  } else if (currentCategory === 'tshirt') {
    submitted = localCoupons.filter(c => c.tshirt_status === 'REDEEMED').length;
  } else {
    submitted = localCoupons.filter(c => c.raffle_status === 'SUBMITTED').length;
  }

  const remaining = total - submitted;
  const pct = total > 0 ? (submitted / total * 100).toFixed(1) : 0;

  statTotal.innerText = total.toLocaleString();
  statSubmitted.innerText = submitted.toLocaleString();
  statRemaining.innerText = remaining.toLocaleString();
  statPercent.innerText = `${pct}% completion`;
  progressBar.style.width = `${pct}%`;
  renderActivityList(localActivity);
}

function initTableControls() {
  const searchInput = document.getElementById('tableSearchInput');
  const statusSelect = document.getElementById('tableStatusFilter');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toUpperCase();
    currentPage = 1;
    fetchCoupons();
  });

  statusSelect.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    currentPage = 1;
    fetchCoupons();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchCoupons();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    fetchCoupons();
  });
}

async function fetchCoupons() {
  const tbody = document.getElementById('couponsTableBody');
  const pageLabel = document.getElementById('currentPageLabel');
  const infoLabel = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  let items = [];
  let totalFiltered = 0;

  if (isLiveApi) {
    try {
      const url = `/api/coupons?q=${encodeURIComponent(searchQuery)}&status=${statusFilter}&category=${currentCategory}&page=${currentPage}&per_page=${itemsPerPage}`;
      const res = await fetch(url);
      const data = await res.json();
      items = data.items;
      totalFiltered = data.total;
    } catch (e) {
      console.warn('Coupons table fetch error, falling back to local');
    }
  }

  if (!isLiveApi || items.length === 0) {
    let filtered = localCoupons;
    const statusKey = currentCategory === 'lunch' ? 'lunch_status' : (currentCategory === 'tshirt' ? 'tshirt_status' : 'raffle_status');
    const claimedVal = currentCategory in {'lunch':1, 'tshirt':1} ? 'REDEEMED' : 'SUBMITTED';

    if (searchQuery) {
      filtered = filtered.filter(c => c.code.includes(searchQuery) || String(c.serial) === searchQuery || `#${String(c.serial).padStart(4, '0')}`.includes(searchQuery));
    }

    if (statusFilter === 'submitted') {
      filtered = filtered.filter(c => c[statusKey] === claimedVal);
    } else if (statusFilter === 'available') {
      filtered = filtered.filter(c => c[statusKey] === 'AVAILABLE');
    }

    totalFiltered = filtered.length;
    const start = (currentPage - 1) * itemsPerPage;
    items = filtered.slice(start, start + itemsPerPage);
  }

  // Update pagination indicators
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  pageLabel.innerText = `Page ${currentPage} of ${totalPages}`;
  const startNum = totalFiltered === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endNum = Math.min(currentPage * itemsPerPage, totalFiltered);
  infoLabel.innerText = `Showing ${startNum} to ${endNum} of ${totalFiltered.toLocaleString()} coupons`;

  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (currentPage >= totalPages);

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No matching coupons found.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(c => {
    const rBadge = c.raffle_status === 'SUBMITTED' 
      ? '<span class="status-badge badge-success">SUBMITTED</span>' 
      : '<span class="status-badge badge-neutral">AVAILABLE</span>';

    const lBadge = c.lunch_status === 'REDEEMED' 
      ? '<span class="status-badge badge-success">REDEEMED</span>' 
      : '<span class="status-badge badge-neutral">AVAILABLE</span>';

    const tBadge = c.tshirt_status === 'REDEEMED' 
      ? '<span class="status-badge badge-success">REDEEMED</span>' 
      : '<span class="status-badge badge-neutral">AVAILABLE</span>';

    const lastBy = c.raffle_scanned_by || c.lunch_scanned_by || c.tshirt_scanned_by || '—';

    return `
      <tr>
        <td>#${String(c.serial).padStart(4, '0')}</td>
        <td class="table-code">${c.code}</td>
        <td>${rBadge}</td>
        <td>${lBadge}</td>
        <td>${tBadge}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${lastBy}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="resetCouponCode('${c.code}')" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">Reset</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.resetCouponCode = async function(code) {
  if (!confirm(`Are you sure you want to reset Coupon ${code} to AVAILABLE for ${getCategoryTitle(currentCategory)}?`)) return;

  if (isLiveApi) {
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, category: currentCategory })
      });
      const data = await res.json();
      if (data.success) {
        refreshStatsAndTable();
      }
    } catch (e) {
      alert('Reset error');
    }
  } else {
    const coupon = localCoupons.find(c => c.code === code);
    if (coupon) {
      if (currentCategory === 'lunch') {
        coupon.lunch_status = 'AVAILABLE';
        coupon.lunch_redeemed_at = '';
        coupon.lunch_scanned_by = '';
      } else if (currentCategory === 'tshirt') {
        coupon.tshirt_status = 'AVAILABLE';
        coupon.tshirt_redeemed_at = '';
        coupon.tshirt_scanned_by = '';
      } else {
        coupon.raffle_status = 'AVAILABLE';
        coupon.raffle_submitted_at = '';
        coupon.raffle_scanned_by = '';
      }
      localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));
      refreshStatsAndTable();
    }
  }
};

// ========================================================
// EXPORT EXCEL & CSV UTILITY
// ========================================================
function initExportButton() {
  const exportBtn = document.getElementById('exportBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', (e) => {
    if (!isLiveApi) {
      e.preventDefault();
      exportOfflineCSV();
    }
  });
}

function exportOfflineCSV() {
  const headers = ['SL', 'Coupon Code', 'Raffle Status', 'Raffle Time', 'Raffle By', 'Lunch Status', 'Lunch Time', 'Lunch By', 'T-Shirt Status', 'T-Shirt Time', 'T-Shirt By'];
  const rows = localCoupons.map(c => [
    c.serial,
    c.code,
    c.raffle_status,
    c.raffle_submitted_at || '',
    c.raffle_scanned_by || '',
    c.lunch_status,
    c.lunch_redeemed_at || '',
    c.lunch_scanned_by || '',
    c.tshirt_status,
    c.tshirt_redeemed_at || '',
    c.tshirt_scanned_by || ''
  ]);

  let csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `EEE_FEST_2026_Coupons_Export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
