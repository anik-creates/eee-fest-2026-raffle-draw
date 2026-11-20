/**
 * EEE FEST 2026 - Master Verification & Management Portal
 * Firebase Firestore Cloud Sync + Offline Dual Runtime Engine
 * Zero Emojis Compliance
 */

// Firebase Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyBNHhjmEDuLoClqVekVmh6sFW8JaEQbsYM",
  authDomain: "fest2026-35ba3.firebaseapp.com",
  projectId: "fest2026-35ba3",
  storageBucket: "fest2026-35ba3.firebasestorage.app",
  messagingSenderId: "204942525316",
  appId: "1:204942525316:web:a3ef5c081b0843175513d1",
  measurementId: "G-42MPESR8ZK"
};

// Global App States
let firebaseApp = null;
let firestoreDb = null;
let isFirestoreConnected = false;
let isLiveApi = false;

let currentCategory = 'raffle';
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

// In-Memory Storage
let localCoupons = [];
let localAdmins = [];
let localActivity = [];

// ========================================================
// SOUND EFFECTS SYNTHESIZER (Web Audio API - No external mp3s needed)
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
  initFirebase();
  await initStorage();
  initAuthUI();
  initCategoryTabs();
  initSuperAdminControls();
  initScanner();
  initManualForm();
  initTableControls();
  initExportButton();
  initAddonCouponModal();
  updateUIForCurrentCategory();
  refreshStatsAndTable();
});

// Initialize Firebase SDK
function initFirebase() {
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      firestoreDb = firebase.firestore();
      isFirestoreConnected = true;
      console.log('Firebase initialized successfully.');
    } catch (e) {
      console.warn('Firebase initialization note:', e);
      isFirestoreConnected = false;
    }
  }
}

// Storage Seeding & Backend Detection
async function initStorage() {
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
      statusLabel.innerText = 'ONLINE - FLASK & FIREBASE';
      statusLabel.style.color = 'var(--success)';
      const data = await res.json();
      if (data.settings) settingsState = data.settings;
      return;
    }
  } catch (err) {
    isLiveApi = false;
  }

  // Client-Side / Cloud Runtime
  if (isFirestoreConnected) {
    statusLabel.innerText = 'ONLINE - FIREBASE CLOUD';
    statusLabel.style.color = 'var(--primary)';
  } else {
    statusLabel.innerText = 'ONLINE - LOCAL RUNTIME';
    statusLabel.style.color = 'var(--primary)';
  }

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

// Sync changes to Firestore & local storage
async function syncCouponToCloud(coupon) {
  localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));

  if (firestoreDb) {
    try {
      await firestoreDb.collection('coupons').doc(coupon.code).set(coupon, { merge: true });
    } catch (e) {
      console.warn('Firestore coupon sync note (check security rules):', e.message);
    }
  }
}

// ========================================================
// AUTH & ADMIN MANAGEMENT
// ========================================================
function initAuthUI() {
  const loginModal = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeLoginBtn = document.getElementById('closeLoginModalBtn');
  const loginForm = document.getElementById('adminLoginForm');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

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
          autoSelectAllowedTab();
          updateUIForCurrentCategory();
          sfx.playSuccess();
          return;
        } else {
          loginErrorMsg.innerText = data.message || 'Login failed';
          loginErrorMsg.style.display = 'block';
          sfx.playError();
          return;
        }
      }

      // Offline / Cloud Auth check
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
        autoSelectAllowedTab();
        updateUIForCurrentCategory();
        sfx.playSuccess();
      } else {
        loginErrorMsg.innerText = 'Invalid email or password.';
        loginErrorMsg.style.display = 'block';
        sfx.playError();
      }
    } catch (err) {
      loginErrorMsg.innerText = 'Connection error during login.';
      loginErrorMsg.style.display = 'block';
    }
  });
}

function autoSelectAllowedTab() {
  if (!currentAdmin) return;
  if (currentAdmin.role === 'superadmin') return;

  const allowed = currentAdmin.allowed_sections || [];
  if (allowed.length === 1) {
    currentCategory = allowed[0];
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.category === currentCategory);
    });
  } else if (!allowed.includes(currentCategory) && allowed.length > 0) {
    currentCategory = allowed[0];
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.category === currentCategory);
    });
  }
}

function renderAuthNavbar() {
  const authNav = document.getElementById('authNavContainer');
  const superDeck = document.getElementById('superAdminDeck');

  if (!currentAdmin) {
    authNav.innerHTML = `
      <button id="openLoginBtn" class="btn btn-sm btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
        Admin Sign In
      </button>
    `;
    document.getElementById('openLoginBtn').addEventListener('click', () => {
      document.getElementById('loginModal').style.display = 'flex';
    });
    if (superDeck) superDeck.style.display = 'none';
  } else {
    const isSuper = currentAdmin.role === 'superadmin';
    const sectionsText = isSuper ? 'ALL SECTIONS' : currentAdmin.allowed_sections.map(s => s.toUpperCase()).join(', ');

    authNav.innerHTML = `
      <div class="user-badge">
        <span><strong>${currentAdmin.name}</strong></span>
        <span class="role-tag ${isSuper ? 'superadmin' : ''}">${isSuper ? 'SUPER ADMIN' : sectionsText}</span>
        <button id="logoutBtn" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.72rem; margin-left: 0.25rem;">Sign Out</button>
      </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      currentAdmin = null;
      localStorage.removeItem('eeefest_logged_admin');
      renderAuthNavbar();
      updateUIForCurrentCategory();
      refreshStatsAndTable();
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

window.fillLoginForm = function(email, password) {
  document.getElementById('loginEmailInput').value = email;
  document.getElementById('loginPasswordInput').value = password;
};

// ========================================================
// SUPER ADMIN CONTROLS (SECTIONS & ADMIN ROSTER)
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
      } catch (e) {}
    }

    localStorage.setItem('eeefest_settings', JSON.stringify(settingsState));
    if (firestoreDb) {
      try {
        await firestoreDb.collection('settings').doc('global').set(settingsState, { merge: true });
      } catch (e) {}
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

      if (localAdmins.some(a => a.email.toLowerCase() === email)) {
        msgBox.innerText = `An admin account with email "${email}" already exists.`;
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

      if (firestoreDb) {
        try {
          await firestoreDb.collection('admins').doc(newAdmin.id).set(newAdmin);
        } catch (e) {}
      }

      if (isLiveApi) {
        try {
          await fetch('/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAdmin)
          });
        } catch (e) {}
      }

      msgBox.innerText = `Admin "${name}" (${email}) created successfully!`;
      msgBox.style.background = 'var(--success-bg)';
      msgBox.style.color = 'var(--success)';
      msgBox.style.display = 'block';
      addAdminForm.reset();
      document.getElementById('permRaffle').checked = true;
      document.getElementById('permLunch').checked = true;
      document.getElementById('permTshirt').checked = true;
      loadAdminsTable();
      sfx.playSuccess();
    });
  }
}

async function loadAdminsTable() {
  const tbody = document.getElementById('adminListTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-2">Loading admins...</td></tr>';

  let list = localAdmins;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-2">No admins registered.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    const isSuper = a.role === 'superadmin';
    const tags = isSuper 
      ? '<span class="section-tag raffle">ALL SECTIONS</span>' 
      : (a.allowed_sections || []).map(s => `<span class="section-tag ${s}">${s.toUpperCase()}</span>`).join('');

    const deleteBtn = isSuper 
      ? '<span style="color: var(--text-dim); font-size: 0.72rem;">Protected</span>' 
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
  if (!confirm(`Are you sure you want to remove admin account "${name}"?`)) return;

  localAdmins = localAdmins.filter(a => a.id !== id);
  localStorage.setItem('eeefest_admins', JSON.stringify(localAdmins));

  if (firestoreDb) {
    try { await firestoreDb.collection('admins').doc(id).delete(); } catch (e) {}
  }
  if (isLiveApi) {
    try { await fetch(`/api/admins/${id}`, { method: 'DELETE' }); } catch (e) {}
  }

  loadAdminsTable();
};

// ========================================================
// CATEGORY TABS & STRICT ADMIN RESTRICTIONS
// ========================================================
function initCategoryTabs() {
  const tabs = document.querySelectorAll('.cat-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetCategory = tab.dataset.category;

      // 1. Super Admin Global Section Switch Check
      if (!isCategoryGloballyEnabled(targetCategory)) {
        sfx.playWarning();
        showLockNotice(`Scanning for ${getCategoryTitle(targetCategory)} is currently DISABLED by the Super Admin.`);
        return;
      }

      // 2. Admin Permission Check: If Super Admin assigned only T-Shirt, admin can ONLY scan for T-Shirt
      if (currentAdmin && currentAdmin.role !== 'superadmin') {
        const allowed = currentAdmin.allowed_sections || [];
        if (!allowed.includes(targetCategory)) {
          sfx.playError();
          showLockNotice(`ACCESS DENIED: Your admin account is only authorized to scan for: ${allowed.map(s => s.toUpperCase()).join(', ')}.`);
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

  const checkTab = (tab, cat) => {
    const badge = tab.querySelector('.tab-badge-off');
    const enabled = isCategoryGloballyEnabled(cat);
    let allowed = true;
    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      allowed = (currentAdmin.allowed_sections || []).includes(cat);
    }

    if (!enabled) {
      tab.classList.add('tab-disabled');
      badge.innerText = 'DISABLED';
      badge.style.display = 'inline-block';
    } else if (!allowed) {
      tab.classList.add('tab-disabled');
      badge.innerText = 'UNAUTHORIZED';
      badge.style.display = 'inline-block';
    } else {
      tab.classList.remove('tab-disabled');
      badge.style.display = 'none';
    }
  };

  checkTab(tabRaffle, 'raffle');
  checkTab(tabLunch, 'lunch');
  checkTab(tabTshirt, 'tshirt');

  if (currentCategory === 'lunch') {
    pill.innerText = 'Lunch & Drinks Booth';
  } else if (currentCategory === 'tshirt') {
    pill.innerText = 'T-Shirt Distribution';
  } else {
    pill.innerText = 'Raffle Draw Entry';
  }

  const isEnabled = isCategoryGloballyEnabled(currentCategory);
  if (!isEnabled) {
    showLockNotice(`Scanning for ${getCategoryTitle(currentCategory)} is currently DISABLED by the Super Admin.`);
  } else if (currentAdmin && currentAdmin.role !== 'superadmin' && !(currentAdmin.allowed_sections || []).includes(currentCategory)) {
    showLockNotice(`ACCESS DENIED: Your admin account is only authorized to scan for: ${currentAdmin.allowed_sections.map(s => s.toUpperCase()).join(', ')}.`);
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
// QR SCANNER & MANUAL ENTRY
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

  if (typeof Html5Qrcode === 'undefined') return;

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
  }).catch(err => console.log('Camera init:', err));

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
}

function startScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const overlay = document.getElementById('scannerOverlay');

  const cameraId = availableCameras.length > 0 
    ? availableCameras[currentCameraIndex].id 
    : { facingMode: 'environment' };

  html5QrCode.start(
    cameraId,
    { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
    onQrCodeSuccess,
    () => {}
  ).then(() => {
    isScannerRunning = true;
    toggleBtn.innerText = 'Stop Camera';
    toggleBtn.classList.replace('btn-primary', 'btn-danger');
    overlay.style.display = 'flex';
  }).catch(err => {
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
  }).catch(err => console.error(err));
}

function onQrCodeSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedCode && (now - lastScanTime < 3000)) return;
  lastScannedCode = decodedText;
  lastScanTime = now;
  verifyCode(decodedText);
}

// ========================================================
// CORE VERIFICATION ENGINE & DUPLICATE BLOCKING
// ========================================================
async function verifyCode(rawCode) {
  let cleanCode = rawCode.trim().toUpperCase();
  if (cleanCode.includes('CODE=')) {
    cleanCode = cleanCode.split('CODE=')[1].split('&')[0].trim();
  } else if (cleanCode.includes('/')) {
    cleanCode = cleanCode.split('/').pop().trim();
  }

  const categoryName = getCategoryTitle(currentCategory);

  // Check 1: Super Admin global toggle
  if (!isCategoryGloballyEnabled(currentCategory)) {
    sfx.playWarning();
    const msg = `SECTION DISABLED: Scanning for ${categoryName} is currently DISABLED by the Super Admin.`;
    renderResultBox('DISABLED', msg);
    addActivityLog({ time: new Date().toLocaleTimeString(), code: cleanCode, status: 'DISABLED', category: categoryName, message: msg });
    return;
  }

  // Check 2: Admin authorized section
  if (currentAdmin && currentAdmin.role !== 'superadmin') {
    const allowed = currentAdmin.allowed_sections || [];
    if (!allowed.includes(currentCategory)) {
      sfx.playError();
      const msg = `ACCESS DENIED: Your admin account is only authorized to scan for: ${allowed.map(s => s.toUpperCase()).join(', ')}.`;
      renderResultBox('DENIED', msg);
      addActivityLog({ time: new Date().toLocaleTimeString(), code: cleanCode, status: 'DENIED', category: categoryName, message: msg });
      return;
    }
  }

  const adminName = currentAdmin ? currentAdmin.name : 'Admin Desk';
  const timestamp = new Date().toLocaleString();

  // Find Coupon in database
  const coupon = localCoupons.find(c => c.code.toUpperCase() === cleanCode);

  let statusKey, timeKey, byKey, claimedVal;
  if (currentCategory === 'lunch') {
    statusKey = 'lunch_status';
    timeKey = 'lunch_redeemed_at';
    byKey = 'lunch_scanned_by';
    claimedVal = 'REDEEMED';
  } else if (currentCategory === 'tshirt') {
    statusKey = 'tshirt_status';
    timeKey = 'tshirt_redeemed_at';
    byKey = 'tshirt_scanned_by';
    claimedVal = 'REDEEMED';
  } else {
    statusKey = 'raffle_status';
    timeKey = 'raffle_submitted_at';
    byKey = 'raffle_scanned_by';
    claimedVal = 'SUBMITTED';
  }

  // Check 3: Counterfeit Check
  if (!coupon) {
    sfx.playError();
    const msg = `COUNTERFEIT ALERT: Code "${cleanCode}" does NOT exist in the official EEE FEST 2026 database.`;
    renderResultBox('COUNTERFEIT', msg);
    addActivityLog({ time: timestamp, code: cleanCode, status: 'COUNTERFEIT', category: categoryName, message: msg });
    return;
  }

  // Check 4: Duplicate Entry Check
  if (coupon[statusKey] === claimedVal) {
    sfx.playWarning();
    const prevTime = coupon[timeKey] || 'Earlier';
    const prevBy = coupon[byKey] || 'Another Admin';
    const msg = `DUPLICATE ENTRY DETECTED: Coupon #${String(coupon.serial).padStart(4, '0')} (${cleanCode}) was already registered for ${categoryName} on ${prevTime} by ${prevBy}. Duplicate entry blocked!`;
    renderResultBox('ALREADY_SUBMITTED', msg, coupon);
    addActivityLog({ time: timestamp, code: cleanCode, serial: coupon.serial, status: 'ALREADY_SUBMITTED', category: categoryName, message: msg });
    return;
  }

  // Valid Scan: Mark as Submitted / Redeemed
  coupon[statusKey] = claimedVal;
  coupon[timeKey] = timestamp;
  coupon[byKey] = adminName;

  await syncCouponToCloud(coupon);

  if (isLiveApi) {
    try {
      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, category: currentCategory, admin_email: currentAdmin ? currentAdmin.email : '' })
      });
    } catch (e) {}
  }

  sfx.playSuccess();
  const msg = `SUCCESS: Coupon #${String(coupon.serial).padStart(4, '0')} (${cleanCode}) successfully verified and registered for ${categoryName} by ${adminName}.`;
  renderResultBox('SUCCESS', msg, coupon);
  addActivityLog({ time: timestamp, code: cleanCode, serial: coupon.serial, status: 'SUCCESS', category: categoryName, message: `Verified by ${adminName}` });
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
    iconSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else if (status === 'ALREADY_SUBMITTED') {
    box.classList.add('result-warning');
    title = 'DUPLICATE ENTRY DETECTED';
    iconSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else if (status === 'COUNTERFEIT') {
    box.classList.add('result-invalid');
    title = 'COUNTERFEIT ALERT';
    iconSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else {
    box.classList.add('result-warning');
    title = 'ACTION BLOCKED';
    iconSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
  }

  let extraDetails = '';
  let actionButtons = '';
  if (coupon) {
    extraDetails = `
      <div style="margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px dashed rgba(255,255,255,0.15); display: flex; gap: 0.85rem; flex-wrap: wrap; font-size: 0.82rem;">
        <div>SL: <strong>#${String(coupon.serial).padStart(4, '0')}</strong></div>
        <div>Code: <strong>${coupon.code}</strong></div>
        <div>Raffle: <strong>${coupon.raffle_status}</strong></div>
        <div>Lunch: <strong>${coupon.lunch_status}</strong></div>
        <div>T-Shirt: <strong>${coupon.tshirt_status}</strong></div>
      </div>
    `;

    actionButtons = `
      <div class="result-actions">
        <button class="btn btn-sm btn-secondary" onclick="resetCouponCode('${coupon.code}')">Reset Status</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCouponCode('${coupon.code}')">Delete Coupon</button>
      </div>
    `;
  }

  box.innerHTML = `
    <div class="result-icon">${iconSvg}</div>
    <div class="result-body" style="flex: 1;">
      <h3 class="result-title">${title}</h3>
      <p class="result-message">${message}</p>
      ${extraDetails}
      ${actionButtons}
    </div>
  `;
}

function resetResultBox() {
  const box = document.getElementById('resultBox');
  box.className = 'result-box result-standby';
  box.innerHTML = `
    <div class="result-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
    </div>
    <div class="result-body">
      <h3 class="result-title">Ready to Scan</h3>
      <p class="result-message">Point camera at coupon QR code or enter the 4-digit code manually.</p>
    </div>
  `;
}

// ========================================================
// RESET & DELETE ENTRY FUNCTIONS
// ========================================================
window.resetCouponCode = async function(code) {
  if (!confirm(`Reset verification status for Coupon ${code} back to AVAILABLE?`)) return;

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

    await syncCouponToCloud(coupon);

    if (isLiveApi) {
      try {
        await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, category: currentCategory })
        });
      } catch (e) {}
    }

    renderResultBox('SUCCESS', `Coupon ${code} status reset to AVAILABLE.`, coupon);
    refreshStatsAndTable();
  }
};

window.deleteCouponCode = async function(code) {
  if (!confirm(`Are you sure you want to permanently DELETE Coupon ${code} from the database?`)) return;

  localCoupons = localCoupons.filter(c => c.code !== code);
  localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));

  if (firestoreDb) {
    try { await firestoreDb.collection('coupons').doc(code).delete(); } catch (e) {}
  }

  if (isLiveApi) {
    try { await fetch(`/api/coupons/${code}`, { method: 'DELETE' }); } catch (e) {}
  }

  resetResultBox();
  refreshStatsAndTable();
};

// ========================================================
// DYNAMIC COUPON GENERATION (SUPER ADMIN FEATURE)
// ========================================================
function initAddonCouponModal() {
  const openBtn = document.getElementById('openAddonModalBtn');
  const modal = document.getElementById('addonModal');
  const closeBtn = document.getElementById('closeAddonModalBtn');
  const form = document.getElementById('addonCouponForm');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      document.getElementById('addonMsg').style.display = 'none';
      modal.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(document.getElementById('addonCountInput').value, 10) || 4;
      const msgBox = document.getElementById('addonMsg');
      const submitBtn = document.getElementById('addonSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.innerText = 'Generating Batch & PDF...';
      msgBox.style.display = 'none';

      try {
        if (isLiveApi) {
          const res = await fetch('/api/generate-addon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
          });
          const data = await res.json();
          if (data.success) {
            localCoupons.push(...data.new_coupons);
            localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));
            
            // Trigger PDF Download
            window.location.href = data.pdf_download_url;

            msgBox.innerText = `Success! ${count} new coupons generated and added to database. PDF download started.`;
            msgBox.style.background = 'var(--success-bg)';
            msgBox.style.color = 'var(--success)';
            msgBox.style.display = 'block';
            refreshStatsAndTable();
            sfx.playSuccess();
            return;
          }
        }

        // Client-side batch generator
        await generateAddonBatchClientSide(count);
        msgBox.innerText = `Success! ${count} new coupons generated and added to database.`;
        msgBox.style.background = 'var(--success-bg)';
        msgBox.style.color = 'var(--success)';
        msgBox.style.display = 'block';
        refreshStatsAndTable();
        sfx.playSuccess();
      } catch (err) {
        msgBox.innerText = 'Error generating coupons: ' + err.message;
        msgBox.style.background = 'var(--danger-bg)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Generate & Download PDF';
      }
    });
  }
}

async function generateAddonBatchClientSide(count) {
  const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const DIGITS = "23456789";

  const existingCodes = new Set(localCoupons.map(c => c.code.toUpperCase()));
  const newCodes = [];

  while (newCodes.length < count) {
    const l1 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const d1 = DIGITS[Math.floor(Math.random() * DIGITS.length)];
    const c1 = CHARS[Math.floor(Math.random() * CHARS.length)];
    const c2 = CHARS[Math.floor(Math.random() * CHARS.length)];
    const arr = [l1, d1, c1, c2].sort(() => Math.random() - 0.5);
    const code = arr.join('');
    if (!existingCodes.has(code) && !newCodes.includes(code)) {
      newCodes.push(code);
    }
  }

  const startSerial = localCoupons.length + 1;
  const newRecords = [];

  for (let i = 0; i < newCodes.length; i++) {
    const code = newCodes[i];
    const rec = {
      serial: startSerial + i,
      code: code,
      qr_data: code,
      raffle_status: 'AVAILABLE',
      raffle_submitted_at: '',
      raffle_scanned_by: '',
      lunch_status: 'AVAILABLE',
      lunch_redeemed_at: '',
      lunch_scanned_by: '',
      tshirt_status: 'AVAILABLE',
      tshirt_redeemed_at: '',
      tshirt_scanned_by: '',
      qr_file: `QR_${String(startSerial + i).padStart(4, '0')}_${code}_maroon.png`
    };
    localCoupons.push(rec);
    newRecords.push(rec);
    if (firestoreDb) {
      try { firestoreDb.collection('coupons').doc(code).set(rec); } catch (e) {}
    }
  }

  localStorage.setItem('eeefest_coupons', JSON.stringify(localCoupons));

  // Client-side PDF generation if jsPDF is available
  if (typeof window.jspdf !== 'undefined') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const cw = 565.0;
    const ch = cw * (975.0 / 2909.0);
    const x0 = (pw - cw) / 2.0;

    const pages = Math.ceil(newCodes.length / 4);
    for (let p = 0; p < pages; p++) {
      if (p > 0) doc.addPage();
      const pageCodes = newCodes.slice(p * 4, (p + 1) * 4);
      for (let i = 0; i < pageCodes.length; i++) {
        const cCode = pageCodes[i];
        const y0 = 18.0 + i * (ch + 16.0);
        doc.setDrawColor(200, 200, 200);
        doc.rect(x0, y0, cw, ch);
        doc.setFontSize(14);
        doc.setTextColor(73, 37, 45);
        doc.text(`EEE FEST 2026 - Coupon: ${cCode}`, x0 + 20, y0 + 30);
      }
    }
    doc.save(`EEE_FEST_2026_Coupons_Addon_${Date.now()}.pdf`);
  }
}

// ========================================================
// ACTIVITY LOG & STATS
// ========================================================
function addActivityLog(entry) {
  localActivity.unshift(entry);
  if (localActivity.length > 20) localActivity.pop();
  renderActivityList(localActivity);

  if (firestoreDb) {
    try { firestoreDb.collection('activity').add(entry); } catch (e) {}
  }
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
          <span style="font-size: 0.75rem; color: var(--text-dim);">${item.category || ''}</span>
        </div>
        <div class="activity-right">
          <span class="activity-time">${item.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

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

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  pageLabel.innerText = `Page ${currentPage} of ${totalPages}`;
  const startNum = totalFiltered === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endNum = Math.min(currentPage * itemsPerPage, totalFiltered);
  infoLabel.innerText = `Showing ${startNum} to ${endNum} of ${totalFiltered.toLocaleString()} coupons`;

  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (currentPage >= totalPages);

  const start = (currentPage - 1) * itemsPerPage;
  const items = filtered.slice(start, start + itemsPerPage);

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
        <td style="font-size: 0.78rem; color: var(--text-muted);">${lastBy}</td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" onclick="resetCouponCode('${c.code}')" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Reset</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCouponCode('${c.code}')" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// EXPORT EXCEL
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
  link.setAttribute('download', `EEE_FEST_2026_Coupons_Master_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
