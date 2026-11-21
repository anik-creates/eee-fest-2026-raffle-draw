/**
 * EEE FEST 2026 - Master Verification & Management Portal
 * Firebase Realtime Database (asia-southeast1) + Dual Cloud & Offline Engine
 * Zero Emojis Compliance
 */

// Firebase Configuration connected to live Singapore Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyBNHhjmEDuLoClqVekVmh6sFW8JaEQbsYM",
  authDomain: "fest2026-35ba3.firebaseapp.com",
  databaseURL: "https://fest2026-35ba3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fest2026-35ba3",
  storageBucket: "fest2026-35ba3.firebasestorage.app",
  messagingSenderId: "204942525316",
  appId: "1:204942525316:web:a3ef5c081b0843175513d1",
  measurementId: "G-42MPESR8ZK"
};

// Global App States
let firebaseApp = null;
let rtdb = null;
let firestoreDb = null;
let isRtdbConnected = false;
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

// Table Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 25;
let searchQuery = '';
let statusFilter = 'all';
let createdBatchFilter = 'all';
let selectedCouponCodes = new Set();

// In-Memory Storage
let localCoupons = [];

// Authoritative local coupon list setter: enforces strict deduplication by coupon code
function setLocalCoupons(couponsList) {
  if (!Array.isArray(couponsList)) return;
  const map = new Map();
  for (const c of couponsList) {
    if (c && c.code) {
      const codeKey = String(c.code).trim().toUpperCase();
      map.set(codeKey, { ...c, code: codeKey });
    }
  }
  localCoupons = Array.from(map.values()).sort((a, b) => (Number(a.serial) || 0) - (Number(b.serial) || 0));
}

let localAdmins = [];
let localActivity = [];
let pendingOfflineScans = [];

// ========================================================
// FLOATING NOTIFICATION / TOAST ENGINE
// ========================================================
function showNotification(msg, type = 'info', duration = 3200) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerText = msg;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
window.showNotification = showNotification;

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
  initRealtimeSync();
  initAuthUI();
  initCategoryTabs();
  initSuperAdminControls();
  initScanner();
  initManualForm();
  initTableControls();
  initExportButton();
  initAddonCouponModal();
  initManualCouponModal();
  initDeleteAllModal();
  updateUIForCurrentCategory();
  refreshStatsAndTable();
});

// Initialize Firebase SDK with Realtime Database (asia-southeast1)
function initFirebase() {
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }

      // 1. Primary: Firebase Realtime Database
      if (typeof firebase.database === 'function') {
        rtdb = firebase.database();
        isRtdbConnected = true;
        console.log('Firebase Realtime Database connected (asia-southeast1).');
      }

      // 2. Secondary: Firestore
      if (typeof firebase.firestore === 'function') {
        firestoreDb = firebase.firestore();
        isFirestoreConnected = true;
      }
    } catch (e) {
      console.warn('Firebase initialization note:', e);
      isRtdbConnected = false;
      isFirestoreConnected = false;
    }
  }
}

// Real-Time Multi-Admin Synchronization Engine & Network Monitor
function initRealtimeSync() {
  const offlineBanner = document.getElementById('networkOfflineBanner');
  const statusLabel = document.getElementById('connectionStatusLabel');
  const statusIndicator = document.querySelector('.status-indicator');

  function updateNetworkStatus() {
    const online = navigator.onLine;

    if (!online) {
      if (offlineBanner) offlineBanner.style.display = 'block';
      if (statusLabel) {
        statusLabel.innerText = 'OFFLINE (LOCAL CACHE ONLY)';
        statusLabel.style.color = '#ef4444';
      }
      if (statusIndicator) {
        statusIndicator.className = 'status-indicator offline';
      }
    } else {
      if (offlineBanner) offlineBanner.style.display = 'none';
      if (statusLabel) {
        if (isRtdbConnected) {
          statusLabel.innerText = 'REALTIME CLOUD SYNC ACTIVE';
          statusLabel.style.color = '#10b981';
        } else if (isLiveApi) {
          statusLabel.innerText = 'ONLINE - FLASK API';
          statusLabel.style.color = '#10b981';
        } else {
          statusLabel.innerText = 'SYSTEM ONLINE';
          statusLabel.style.color = '#2563eb';
        }
      }
      if (statusIndicator) {
        statusIndicator.className = 'status-indicator live';
      }
    }
  }

  // Network event listeners
  window.addEventListener('online', () => {
    updateNetworkStatus();
    showNotification('Internet connection restored. Live database synchronization resumed.');
    syncPendingOfflineScans();
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    showNotification('Warning: No active internet connection. Offline scanning mode active.');
  });

  updateNetworkStatus();

  // Firebase Realtime Database Live Listeners
  if (rtdb) {
    // Connection state observer
    rtdb.ref('.info/connected').on('value', snap => {
      const isConnected = snap.val() === true;
      if (isConnected && navigator.onLine) {
        if (statusLabel) {
          statusLabel.innerText = 'REALTIME CLOUD SYNC ACTIVE';
          statusLabel.style.color = '#10b981';
        }
      } else if (!navigator.onLine) {
        updateNetworkStatus();
      }
    });

    // 1. Authoritative Full Coupons Realtime Synchronization
    // Every scan, reset, addition, or wipe on ANY device updates all devices instantly
    rtdb.ref('coupons').on('value', snap => {
      const remoteData = snap.val();
      if (remoteData) {
        const remoteList = Array.isArray(remoteData) ? remoteData.filter(Boolean) : Object.values(remoteData);
        setLocalCoupons(remoteList);
        localStorage.removeItem('eeefest_database_wiped');
      } else {
        // Authoritative cloud state is empty (database wiped by Super Admin)
        setLocalCoupons([]);
      }
      refreshStatsAndTable();
    });

    // 2. Live Global Scanning Settings Listener
    rtdb.ref('settings').on('value', snap => {
      const s = snap.val();
      if (s) {
        settingsState = Object.assign(settingsState, s);
        localStorage.setItem('eeefest_settings', JSON.stringify(settingsState));
        applySettingsToUI();
      }
    });

    // 5. Live Admin Accounts Listener
    rtdb.ref('admins').on('value', snap => {
      const admData = snap.val();
      if (admData) {
        const adminArray = Array.isArray(admData) ? admData : Object.values(admData);
        if (adminArray.length > 0) {
          localAdmins = adminArray;
          localStorage.setItem('eeefest_admins', JSON.stringify(localAdmins));
          renderAdminsTable();
        }
      }
    });
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
      const data = await res.json();
      if (data.settings) settingsState = data.settings;
    }
  } catch (err) {
    isLiveApi = false;
  }

  // Explicitly purge stale coupons from localStorage so test data never lingers
  try { localStorage.removeItem('eeefest_coupons'); } catch (e) {}

  // Seed initial in-memory dataset unless database was explicitly wiped
  if (localStorage.getItem('eeefest_database_wiped') === 'true') {
    setLocalCoupons([]);
  } else if (window.INITIAL_COUPONS_DATA) {
    setLocalCoupons(window.INITIAL_COUPONS_DATA);
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

  // Load any pending offline scans
  const storedPending = localStorage.getItem('eeefest_pending_scans');
  if (storedPending) {
    try {
      pendingOfflineScans = JSON.parse(storedPending);
    } catch (e) {
      pendingOfflineScans = [];
    }
  }
}

// Sync coupon updates to Firebase Realtime Database & local storage
async function syncCouponToCloud(coupon) {
  // 1. Immediately update in-memory and local cache
  const cleanCode = String(coupon.code).trim().toUpperCase();
  const idx = localCoupons.findIndex(c => c.code.toUpperCase() === cleanCode);
  if (idx !== -1) {
    localCoupons[idx] = Object.assign(localCoupons[idx], coupon);
  } else {
    setLocalCoupons([...localCoupons, coupon]);
  }

  // 2. Realtime Database (Sub-second broadcast to all active admins)
  if (rtdb && navigator.onLine) {
    try {
      await rtdb.ref('coupons/' + coupon.code).set(coupon);
      console.log('Realtime DB coupon synced:', coupon.code);
    } catch (err) {
      console.warn('RTDB sync note:', err);
      queuePendingOfflineScan(coupon);
    }
  } else if (!navigator.onLine) {
    queuePendingOfflineScan(coupon);
  }

  // 3. Cloud Firestore (fallback)
  if (firestoreDb && navigator.onLine) {
    try {
      await firestoreDb.collection('coupons').doc(coupon.code).set(coupon, { merge: true });
    } catch (e) {}
  }
}

// Queue scans for offline resiliency
function queuePendingOfflineScan(coupon) {
  pendingOfflineScans.push(coupon);
  localStorage.setItem('eeefest_pending_scans', JSON.stringify(pendingOfflineScans));
}

// Auto-push cached offline scans when internet reconnects
async function syncPendingOfflineScans() {
  if (!navigator.onLine || pendingOfflineScans.length === 0) return;

  const toSync = [...pendingOfflineScans];
  pendingOfflineScans = [];
  localStorage.setItem('eeefest_pending_scans', JSON.stringify([]));

  for (const c of toSync) {
    if (rtdb) {
      try {
        await rtdb.ref('coupons/' + c.code).set(c);
      } catch (e) {
        pendingOfflineScans.push(c);
      }
    }
  }
  localStorage.setItem('eeefest_pending_scans', JSON.stringify(pendingOfflineScans));
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
  const authNotice = document.getElementById('authRequiredNotice');
  const authGate = document.getElementById('scannerAuthGate');
  const tableSection = document.getElementById('masterTableSection');
  const manualInput = document.getElementById('manualCouponInput');
  const manualBtn = document.getElementById('submitManualBtn');

  if (!currentAdmin) {
    if (authNotice) authNotice.style.display = 'block';
    if (authGate) authGate.style.display = 'flex';
    if (tableSection) tableSection.style.display = 'none';
    if (superDeck) superDeck.style.display = 'none';
    if (manualInput) manualInput.disabled = true;
    if (manualBtn) manualBtn.disabled = true;

    if (isScannerRunning) {
      stopScanner();
    }

    authNav.innerHTML = `
      <button id="openLoginBtn" class="btn btn-sm btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
        Admin Sign In
      </button>
    `;
    const openLogin = document.getElementById('openLoginBtn');
    if (openLogin) {
      openLogin.addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'flex';
      });
    }

    const authGateBtn = document.getElementById('authGateLoginBtn');
    if (authGateBtn) {
      authGateBtn.onclick = () => {
        document.getElementById('loginModal').style.display = 'flex';
      };
    }
  } else {
    if (authNotice) authNotice.style.display = 'none';
    if (authGate) authGate.style.display = 'none';
    if (manualInput) manualInput.disabled = false;
    if (manualBtn) manualBtn.disabled = false;

    const isSuper = currentAdmin.role === 'superadmin';

    // Regular Booth Admins get an ultra-clean, simple interface without the overwhelmed 1260-row table
    if (tableSection) tableSection.style.display = isSuper ? 'block' : 'none';
    if (superDeck) superDeck.style.display = isSuper ? 'block' : 'none';

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
      if (isScannerRunning) {
        stopScanner();
      }
      renderAuthNavbar();
      updateUIForCurrentCategory();
      refreshStatsAndTable();
      showNotification('Signed out successfully.');
    });

    if (superDeck && isSuper) {
      document.getElementById('toggleRaffle').checked = !!settingsState.enable_raffle;
      document.getElementById('toggleLunch').checked = !!settingsState.enable_lunch;
      document.getElementById('toggleTshirt').checked = !!settingsState.enable_tshirt;
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
    if (rtdb) {
      try { await rtdb.ref('settings').set(settingsState); } catch (e) {}
    }
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

      if (rtdb) {
        try { await rtdb.ref('admins/' + newAdmin.id).set(newAdmin); } catch (e) {}
      }
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

  // Super Admin: Reset All Coupons button
  const resetAllBtn = document.getElementById('resetAllCouponsBtn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', async () => {
      const confirmed = confirm("Are you sure you want to RESET ALL coupons back to AVAILABLE?\n\nThis will clear all scan records (Raffle, Lunch, T-Shirt) across the entire event so you can re-test or restart without duplicate errors.");
      if (!confirmed) return;

      resetAllBtn.disabled = true;
      resetAllBtn.innerText = "Resetting All Coupons...";

      try {
        localCoupons.forEach(c => {
          c.raffle_status = 'AVAILABLE';
          c.raffle_submitted_at = '';
          c.raffle_scanned_by = '';
          c.lunch_status = 'AVAILABLE';
          c.lunch_redeemed_at = '';
          c.lunch_scanned_by = '';
          c.tshirt_status = 'AVAILABLE';
          c.tshirt_redeemed_at = '';
          c.tshirt_scanned_by = '';
        });

        // Ensure localStorage never keeps stale coupon data
        try { localStorage.removeItem('eeefest_coupons'); } catch (e) {}

        // Realtime database bulk update
        if (rtdb) {
          const updates = {};
          localCoupons.forEach(c => {
            updates[`coupons/${c.code}/raffle_status`] = 'AVAILABLE';
            updates[`coupons/${c.code}/raffle_submitted_at`] = '';
            updates[`coupons/${c.code}/raffle_scanned_by`] = '';
            updates[`coupons/${c.code}/lunch_status`] = 'AVAILABLE';
            updates[`coupons/${c.code}/lunch_redeemed_at`] = '';
            updates[`coupons/${c.code}/lunch_scanned_by`] = '';
            updates[`coupons/${c.code}/tshirt_status`] = 'AVAILABLE';
            updates[`coupons/${c.code}/tshirt_redeemed_at`] = '';
            updates[`coupons/${c.code}/tshirt_scanned_by`] = '';
          });
          await rtdb.ref().update(updates);
        }

        // Secondary Firestore update if connected
        if (firestoreDb) {
          try {
            const batch = firestoreDb.batch();
            localCoupons.slice(0, 450).forEach(c => {
              const ref = firestoreDb.collection('coupons').doc(c.code);
              batch.set(ref, {
                raffle_status: 'AVAILABLE',
                raffle_submitted_at: '',
                raffle_scanned_by: '',
                lunch_status: 'AVAILABLE',
                lunch_redeemed_at: '',
                lunch_scanned_by: '',
                tshirt_status: 'AVAILABLE',
                tshirt_redeemed_at: '',
                tshirt_scanned_by: ''
              }, { merge: true });
            });
            await batch.commit();
          } catch (e) {}
        }

        // Flask API if running
        if (isLiveApi) {
          try {
            await fetch('/api/reset-all', { method: 'POST' });
          } catch (e) {}
        }

        resetResultBox();
        refreshStatsAndTable();
        sfx.playSuccess();
        alert("Success: All coupons have been reset to AVAILABLE. All booth statuses are cleared.");
      } catch (err) {
        console.error("Reset all error:", err);
        alert("Error resetting coupons: " + err.message);
      } finally {
        resetAllBtn.disabled = false;
        resetAllBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
          Reset All Coupons
        `;
      }
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

  if (rtdb) {
    try { await rtdb.ref('admins/' + id).remove(); } catch (e) {}
  }
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
  if (!currentAdmin) {
    alert('Authentication Required: Please sign in as an Admin or Super Admin to use the camera scanner.');
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'flex';
    return;
  }

  const toggleBtn = document.getElementById('toggleScannerBtn');
  const overlay = document.getElementById('scannerOverlay');

  const cameraId = availableCameras.length > 0 
    ? availableCameras[currentCameraIndex].id 
    : { facingMode: 'environment' };

  html5QrCode.start(
    cameraId,
    { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
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
  // Check 0: Strict Authentication Guard - Only Admin or Super Admin can scan or submit to the database
  if (!currentAdmin) {
    sfx.playError();
    const msg = 'AUTHENTICATION REQUIRED: Please sign in as an Admin or Super Admin to scan or submit coupons.';
    renderResultBox('DENIED', msg);
    updateInstantHud('DENIED', msg);
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'flex';
    return;
  }

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

  // Live Cloud Realtime Verification Check: fetch latest state directly from RTDB before claiming
  if (rtdb) {
    try {
      const snap = await rtdb.ref('coupons/' + cleanCode).once('value');
      const cloudVal = snap.val();
      if (cloudVal) {
        const idx = localCoupons.findIndex(c => c.code.toUpperCase() === cleanCode);
        if (idx !== -1) {
          localCoupons[idx] = Object.assign(localCoupons[idx], cloudVal);
        } else {
          setLocalCoupons([...localCoupons, cloudVal]);
        }
      }
    } catch (e) {}
  }

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

  // Synchronize the instant compact HUD on the scanner card
  updateInstantHud(status, message, coupon);
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

  // Reset instant compact HUD
  updateInstantHud('IDLE', 'Point camera at coupon QR code or enter code below');
}

// ========================================================
// INSTANT COMPACT VALIDITY HUD (ZERO-SCROLL BOOTH STATUS)
// ========================================================
function updateInstantHud(status, message, coupon = null) {
  const hud = document.getElementById('instantValidityHud');
  const icon = document.getElementById('hudIcon');
  const title = document.getElementById('hudTitle');
  const subtext = document.getElementById('hudMessage');
  const badge = document.getElementById('hudBadge');
  if (!hud) return;

  hud.className = 'instant-validity-hud';

  if (status === 'SUCCESS') {
    hud.classList.add('hud-valid');
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    title.innerText = coupon ? `VALID & CLAIMED: ${coupon.code} (#${String(coupon.serial).padStart(4, '0')})` : 'VALID & CLAIMED';
    subtext.innerText = message;
    badge.innerText = 'VALID';
  } else if (status === 'ALREADY_SUBMITTED') {
    hud.classList.add('hud-duplicate');
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    title.innerText = coupon ? `DUPLICATE ENTRY: ${coupon.code}` : 'DUPLICATE ENTRY';
    subtext.innerText = message;
    badge.innerText = 'DUPLICATE';
  } else if (status === 'COUNTERFEIT') {
    hud.classList.add('hud-counterfeit');
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    title.innerText = 'COUNTERFEIT CODE';
    subtext.innerText = message;
    badge.innerText = 'INVALID';
  } else if (status === 'DISABLED' || status === 'DENIED') {
    hud.classList.add('hud-locked');
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
    title.innerText = status === 'DISABLED' ? 'SECTION DISABLED' : 'ACCESS DENIED';
    subtext.innerText = message;
    badge.innerText = 'LOCKED';
  } else {
    hud.classList.add('hud-idle');
    icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>';
    title.innerText = 'READY TO SCAN';
    subtext.innerText = 'Point camera at coupon QR code or enter code below';
    badge.innerText = 'STANDBY';
  }
}

// ========================================================
// RESET & DELETE ENTRY FUNCTIONS
// ========================================================
window.resetCouponCode = async function(code) {
  const cleanCode = String(code).trim().toUpperCase();
  if (!confirm(`Reset verification status for Coupon ${cleanCode} back to AVAILABLE?`)) return;

  const coupon = localCoupons.find(c => c.code.toUpperCase() === cleanCode);
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
          body: JSON.stringify({ code: cleanCode, category: currentCategory })
        });
      } catch (e) {}
    }

    renderResultBox('SUCCESS', `Coupon ${cleanCode} status reset to AVAILABLE.`, coupon);
    refreshStatsAndTable();
    showNotification(`Coupon ${cleanCode} status reset to AVAILABLE.`, 'success');
  }
};

window.deleteCouponCode = async function(code) {
  const targetCode = String(code).trim().toUpperCase();
  if (!confirm(`Are you sure you want to permanently DELETE Coupon ${targetCode} from the database?`)) return;

  // 1. Immediately deduplicate and remove from local state and selection
  setLocalCoupons(localCoupons.filter(c => c.code.toUpperCase() !== targetCode));
  selectedCouponCodes.delete(targetCode);

  // 2. Remove from Firebase Realtime Database
  if (rtdb) {
    try { await rtdb.ref('coupons/' + targetCode).remove(); } catch (e) {
      console.warn('RTDB remove coupon note:', e);
    }
  }
  if (firestoreDb) {
    try { await firestoreDb.collection('coupons').doc(targetCode).delete(); } catch (e) {}
  }

  if (isLiveApi) {
    try { await fetch(`/api/coupons/${targetCode}`, { method: 'DELETE' }); } catch (e) {}
  }

  resetResultBox();
  refreshStatsAndTable();
  showNotification(`Coupon ${targetCode} permanently deleted from database.`, 'info');
};

// ========================================================
// CLIENT-SIDE HIGH-RESOLUTION PDF COMPILER & CANVAS ENGINE
// ========================================================
let cachedTemplateImg = null;

function loadTemplateImage() {
  if (cachedTemplateImg && cachedTemplateImg.complete && cachedTemplateImg.naturalWidth > 0) {
    return Promise.resolve(cachedTemplateImg);
  }
  const candidateUrls = [
    './EEE%20FEST%20Cupon%20-%202026.png',
    'EEE%20FEST%20Cupon%20-%202026.png',
    './EEE FEST Cupon - 2026.png',
    './static/img/EEE%20FEST%20Cupon%20-%202026.png',
    '/EEE%20FEST%20Cupon%20-%202026.png'
  ];

  return new Promise((resolve, reject) => {
    let index = 0;
    function tryNext() {
      if (index >= candidateUrls.length) {
        return reject(new Error('Failed to load coupon template image (EEE FEST Cupon - 2026.png).'));
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cachedTemplateImg = img;
        resolve(img);
      };
      img.onerror = () => {
        index++;
        tryNext();
      };
      img.src = candidateUrls[index];
    }
    tryNext();
  });
}

async function ensureQrCodeLib() {
  if (typeof QRCode !== 'undefined') return true;
  return new Promise((resolve) => {
    const s1 = document.createElement('script');
    s1.src = './qrcode.min.js';
    s1.onload = () => resolve(typeof QRCode !== 'undefined');
    s1.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js';
      s2.onload = () => resolve(typeof QRCode !== 'undefined');
      s2.onerror = () => resolve(false);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
}

function drawQrToCanvasContext(ctx, code, cx, cy, size, color) {
  if (typeof QRCode !== 'undefined' && QRCode.create) {
    try {
      const qr = QRCode.create(code, { errorCorrectionLevel: 'M' });
      const modSize = qr.modules.size;
      const margin = 1;
      const totalModules = modSize + margin * 2;
      const cellSize = size / totalModules;
      const startX = cx - size / 2;
      const startY = cy - size / 2;

      // Solid white background padding for optical clarity
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(startX, startY, size, size);

      // Render dark modules with 0.1px bleed to eliminate anti-aliasing gaps
      ctx.fillStyle = color;
      for (let r = 0; r < modSize; r++) {
        for (let c = 0; c < modSize; c++) {
          if (qr.modules.get(r, c)) {
            ctx.fillRect(
              startX + (c + margin) * cellSize,
              startY + (r + margin) * cellSize,
              cellSize + 0.1,
              cellSize + 0.1
            );
          }
        }
      }
      return true;
    } catch (e) {
      console.warn('QRCode.create direct matrix render note:', e);
    }
  }
  return false;
}

async function renderCouponToCanvas(code, templateImg) {
  await ensureQrCodeLib();

  const canvas = document.createElement('canvas');
  canvas.width = 4251;
  canvas.height = 1425;
  const ctx = canvas.getContext('2d');

  // 1. Draw base coupon template
  ctx.drawImage(templateImg, 0, 0, 4251, 1425);

  // Stubs configuration for the new design:
  // Stub 1: Raffle Draw (Maroon #49252D)
  // Stub 2: Raffle Draw (Maroon #49252D)
  // Stub 3: Lunch & Drinks (Black #000000)
  // Stub 4: T-Shirt (Blue #2C5481)
  const stubs = [
    { name: 'Raffle 1', cx: 1891.5, cy: 265.0, color: '#49252D', bx: 2054.0, colon_y: 668.0 },
    { name: 'Raffle 2', cx: 2554.5, cy: 265.0, color: '#49252D', bx: 2704.0, colon_y: 673.0 },
    { name: 'Lunch',    cx: 3217.5, cy: 265.0, color: '#000000', bx: 3339.0, colon_y: 668.0 },
    { name: 'T-Shirt',  cx: 3880.5, cy: 265.0, color: '#2C5481', bx: 4019.0, colon_y: 673.0 }
  ];

  for (const s of stubs) {
    // 1. Primary QR Renderer: Vector-sharp direct mathematical matrix rendering (synchronous & native)
    let drawn = drawQrToCanvasContext(ctx, code, s.cx, s.cy, 260, s.color);

    // 2. Secondary QR Fallback: QRCode.toCanvas offscreen rendering
    if (!drawn && typeof QRCode !== 'undefined' && QRCode.toCanvas) {
      try {
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, code, {
          width: 520,
          margin: 1,
          color: { dark: s.color, light: '#ffffff' }
        });
        ctx.drawImage(qrCanvas, s.cx - 130, s.cy - 130, 260, 260);
        drawn = true;
      } catch (e) {
        console.warn('QRCode.toCanvas fallback note:', e);
      }
    }

    // 3. Tertiary QR Fallback: QRCode.toDataURL image decoding
    if (!drawn && typeof QRCode !== 'undefined' && QRCode.toDataURL) {
      try {
        const qrDataUrl = await QRCode.toDataURL(code, {
          width: 520,
          margin: 1,
          color: { dark: s.color, light: '#ffffff' }
        });
        if (qrDataUrl) {
          const qImg = await new Promise((res, rej) => {
            const q = new Image();
            q.onload = () => res(q);
            q.onerror = rej;
            q.src = qrDataUrl;
          });
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(qImg, s.cx - 130, s.cy - 130, 260, 260);
          drawn = true;
        }
      } catch (e) {
        console.warn('QRCode.toDataURL fallback note:', e);
      }
    }

    // Draw inline Coupon Code right next to 'Cupon No:'
    ctx.save();
    ctx.font = "bold 49px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    ctx.fillStyle = s.color;
    ctx.textBaseline = 'alphabetic';
    ctx.translate(s.bx, s.colon_y - 18.0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(code, 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.94);
}

async function generateCouponsPdfClientSide(records, onProgress, filename = '') {
  const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFClass) {
    throw new Error('PDF Generation SDK (jsPDF) is not loaded.');
  }

  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const templateImg = await loadTemplateImage();

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const cw = 565.0;
  const ch = cw * (1425.0 / 4251.0); // ~189.4 pt
  const margin_top = 18.0;
  const gap = (ph - 2 * margin_top - 4 * ch) / 3.0; // ~16.1 pt
  const x0 = (pw - cw) / 2.0;

  const total = records.length;
  const totalPages = Math.ceil(total / 4);

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage();
    const pageRecords = records.slice(p * 4, (p + 1) * 4);

    for (let i = 0; i < pageRecords.length; i++) {
      const rec = pageRecords[i];
      const y0 = margin_top + i * (ch + gap);

      const couponJpeg = await renderCouponToCanvas(rec.code, templateImg);
      doc.addImage(couponJpeg, 'JPEG', x0, y0, cw, ch);

      if (i < 3) {
        const cutY = y0 + ch + (gap / 2.0);
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([4, 4], 0);
        doc.setLineWidth(0.6);
        doc.line(x0 - 8, cutY, x0 + cw + 8, cutY);
      }
    }

    if (onProgress) {
      const pct = Math.round(((p + 1) / totalPages) * 100);
      onProgress(pct, `Compiling sheet ${p + 1} of ${totalPages}...`);
    }

    // Yield control to let UI and progress bar update smoothly
    await new Promise(r => setTimeout(r, 15));
  }

  // Trigger download of generated PDF
  const outName = filename || `EEE_FEST_2026_Coupons_Addon_${Date.now()}.pdf`;
  doc.save(outName);
  return true;
}

// ========================================================
// DYNAMIC COUPON GENERATION (SUPER ADMIN FEATURE)
// ========================================================
function initAddonCouponModal() {
  const openBtn = document.getElementById('openAddonModalBtn');
  const modal = document.getElementById('addonModal');
  const closeBtn = document.getElementById('closeAddonModalBtn');
  const form = document.getElementById('addonCouponForm');

  const progressWrap = document.getElementById('addonProgressWrap');
  const progressBar = document.getElementById('addonProgressBar');
  const progressText = document.getElementById('addonProgressText');
  const progressPct = document.getElementById('addonProgressPct');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const msgBox = document.getElementById('addonMsg');
      if (msgBox) msgBox.style.display = 'none';
      if (progressWrap) progressWrap.style.display = 'none';
      modal.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (form) {
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(document.getElementById('addonCountInput').value, 10) || 1300;
      const startFrom1 = document.getElementById('addonStartNewBatch')?.checked || (localCoupons.length === 0);
      const msgBox = document.getElementById('addonMsg');
      const submitBtn = document.getElementById('addonSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.innerText = `Generating ${count} Coupons & PDF...`;
      msgBox.style.display = 'none';

      if (progressWrap) {
        progressWrap.style.display = 'block';
        if (progressBar) progressBar.style.width = '5%';
        if (progressText) progressText.innerText = 'Preparing unique coupon batch...';
        if (progressPct) progressPct.innerText = '5%';
      }

      try {
        // Special Master Batch (1,300 coupons reset)
        if (count === 1300 && startFrom1) {
          if (progressText) progressText.innerText = 'Downloading 1,300 master printable PDF...';
          if (progressBar) progressBar.style.width = '60%';
          if (progressPct) progressPct.innerText = '60%';

          // Download the pre-compiled high-res 325-page master PDF
          const a = document.createElement('a');
          a.href = './EEE_FEST_2026_Coupons_Printable.pdf';
          a.download = 'EEE_FEST_2026_Coupons_Printable.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          if (progressText) progressText.innerText = 'Syncing 1,300 coupons to database...';
          if (progressBar) progressBar.style.width = '90%';
          if (progressPct) progressPct.innerText = '90%';

          // Reset database with pristine 1,300 coupons
          if (window.INITIAL_COUPONS_DATA) {
            setLocalCoupons(window.INITIAL_COUPONS_DATA);
            localStorage.removeItem('eeefest_database_wiped');
            if (rtdb) {
              const updates = {};
              for (const c of localCoupons) {
                updates['coupons/' + c.code] = c;
              }
              const entries = Object.entries(updates);
              for (let i = 0; i < entries.length; i += 250) {
                const chunk = Object.fromEntries(entries.slice(i, i + 250));
                await rtdb.ref().update(chunk);
              }
            }
          }

          if (progressBar) progressBar.style.width = '100%';
          if (progressPct) progressPct.innerText = '100%';
          if (progressText) progressText.innerText = 'Master batch completed successfully!';

          msgBox.innerText = `Success: 1,300 coupons generated, synced to database, and 325-page PDF downloaded.`;
          msgBox.style.background = 'var(--success-bg)';
          msgBox.style.color = 'var(--success)';
          msgBox.style.display = 'block';
          refreshStatsAndTable();
          sfx.playSuccess();
          return;
        }

        // Custom batch generation: Generate codes first
        const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const DIGITS = "23456789";

        const existingCodes = startFrom1 ? new Set() : new Set(localCoupons.map(c => c.code.toUpperCase()));
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

        const maxSerial = localCoupons.reduce((max, c) => Math.max(max, Number(c.serial) || 0), 0);
        const startSerial = startFrom1 ? 1 : (maxSerial + 1);
        const newRecords = [];
        const batchTimestamp = new Date().toLocaleString();

        for (let i = 0; i < newCodes.length; i++) {
          const code = newCodes[i];
          const rec = {
            serial: startSerial + i,
            code: code,
            qr_data: code,
            created_at: batchTimestamp,
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
          newRecords.push(rec);
        }

        // 1. GENERATE PDF FIRST. If this fails, code stops here and coupons DO NOT go to database!
        await generateCouponsPdfClientSide(newRecords, (pct, statusTxt) => {
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressPct) progressPct.innerText = pct + '%';
          if (progressText) progressText.innerText = statusTxt;
        });

        // 2. ONLY AFTER PDF is generated and downloaded: Commit to Firebase Realtime Database
        if (progressText) progressText.innerText = 'Syncing new coupons to database...';

        if (rtdb) {
          const updates = {};
          for (const rec of newRecords) {
            updates['coupons/' + rec.code] = rec;
          }
          const entries = Object.entries(updates);
          for (let c = 0; c < entries.length; c += 250) {
            const chunk = Object.fromEntries(entries.slice(c, c + 250));
            await rtdb.ref().update(chunk);
          }
        }

        if (startFrom1) {
          setLocalCoupons(newRecords);
          localStorage.removeItem('eeefest_database_wiped');
        } else {
          setLocalCoupons([...localCoupons, ...newRecords]);
        }

        // Auto-download updated Master Excel sheet
        downloadLiveExcel();

        if (progressBar) progressBar.style.width = '100%';
        if (progressPct) progressPct.innerText = '100%';
        if (progressText) progressText.innerText = 'Batch completed and verified!';

        msgBox.innerText = `Success: ${count} new coupons generated, printable PDF downloaded, and synced to live database.`;
        msgBox.style.background = 'var(--success-bg)';
        msgBox.style.color = 'var(--success)';
        msgBox.style.display = 'block';
        refreshStatsAndTable();
        sfx.playSuccess();
      } catch (err) {
        // Strict safety rule: If PDF is not generated, coupons do NOT go to the database!
        sfx.playError();
        if (progressBar) progressBar.style.background = '#ef4444';
        if (progressText) progressText.innerText = 'Generation stopped due to error.';
        msgBox.innerText = 'PDF generation failed: ' + err.message + '. No coupons were added to the database.';
        msgBox.style.background = 'var(--danger-bg)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Generate Batch & Add to Database';
      }
    });
  }
}

// ========================================================
// SUPER ADMIN: MANUAL SINGLE COUPON ADDITION
// ========================================================
function initManualCouponModal() {
  const openBtn = document.getElementById('openManualCouponModalBtn');
  const modal = document.getElementById('manualCouponModal');
  const closeBtn = document.getElementById('closeManualCouponModalBtn');
  const form = document.getElementById('manualCouponAddForm');
  const codeInput = document.getElementById('newManualCode');
  const serialInput = document.getElementById('newManualSerial');
  const btnGen = document.getElementById('btnGenRandomCode');
  const msgBox = document.getElementById('manualCouponMsg');
  const submitBtn = document.getElementById('submitManualCouponBtn');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (msgBox) msgBox.style.display = 'none';
      if (codeInput) codeInput.value = '';
      if (serialInput) serialInput.value = '';
      if (modal) modal.style.display = 'flex';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }

  if (btnGen && codeInput) {
    btnGen.addEventListener('click', () => {
      const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const DIGITS = "23456789";
      const existing = new Set(localCoupons.map(c => c.code.toUpperCase()));
      let newCode = '';
      for (let attempt = 0; attempt < 100; attempt++) {
        const l = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        const d = DIGITS[Math.floor(Math.random() * DIGITS.length)];
        const c1 = CHARS[Math.floor(Math.random() * CHARS.length)];
        const c2 = CHARS[Math.floor(Math.random() * CHARS.length)];
        const code = [l, d, c1, c2].sort(() => Math.random() - 0.5).join('');
        if (!existing.has(code)) {
          newCode = code;
          break;
        }
      }
      codeInput.value = newCode || ('C' + Math.floor(100 + Math.random() * 899));
    });
  }

  if (form) {
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = codeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 3) {
        msgBox.innerText = 'Coupon code must be at least 3 characters.';
        msgBox.style.background = 'var(--danger-bg)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
        return;
      }

      if (localCoupons.some(c => c.code.toUpperCase() === code)) {
        sfx.playWarning();
        msgBox.innerText = `Coupon code ${code} already exists in database.`;
        msgBox.style.background = 'var(--danger-bg)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Generating Pass & Adding...';
      msgBox.style.display = 'none';

      let serial = parseInt(serialInput.value, 10);
      if (isNaN(serial) || serial < 1) {
        const maxSerial = localCoupons.reduce((max, c) => Math.max(max, Number(c.serial) || 0), 0);
        serial = maxSerial + 1;
      }

      const manualTimestamp = new Date().toLocaleString();
      const rec = {
        serial: serial,
        code: code,
        qr_data: code,
        created_at: manualTimestamp,
        raffle_status: 'AVAILABLE',
        raffle_submitted_at: '',
        raffle_scanned_by: '',
        lunch_status: 'AVAILABLE',
        lunch_redeemed_at: '',
        lunch_scanned_by: '',
        tshirt_status: 'AVAILABLE',
        tshirt_redeemed_at: '',
        tshirt_scanned_by: '',
        qr_file: `QR_${String(serial).padStart(4, '0')}_${code}_maroon.png`
      };

      try {
        // 1. Generate Printable PDF Pass for this coupon first
        await generateCouponsPdfClientSide([rec]);

        // 2. Commit to database ONLY IF PDF succeeded
        if (isLiveApi) {
          try {
            await fetch('/api/manual-coupon', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: code, serial: serial })
            });
          } catch (e) {}
        }

        if (rtdb) {
          await rtdb.ref('coupons/' + code).set(rec);
        }
        if (firestoreDb) {
          try { await firestoreDb.collection('coupons').doc(code).set(rec); } catch (e) {}
        }

        setLocalCoupons([...localCoupons, rec]);
        localStorage.removeItem('eeefest_database_wiped');
        refreshStatsAndTable();
        sfx.playSuccess();

        msgBox.innerText = `Coupon ${code} (Serial #${serial}) added successfully and printable pass downloaded.`;
        msgBox.style.background = 'var(--success-bg)';
        msgBox.style.color = 'var(--success)';
        msgBox.style.display = 'block';

        codeInput.value = '';
        serialInput.value = '';
        showNotification(`Coupon ${code} added to master database.`, 'success');
      } catch (err) {
        sfx.playError();
        msgBox.innerText = 'PDF generation failed: ' + err.message + '. Coupon was NOT added to the database.';
        msgBox.style.background = 'var(--danger-bg)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Add Coupon to Database';
      }
    });
  }
}

// ========================================================
// SUPER ADMIN: PERMANENT DATABASE WIPE (PASSWORD PROTECTED)
// ========================================================
function initDeleteAllModal() {
  const openBtn = document.getElementById('openDeleteAllModalBtn');
  const modal = document.getElementById('deleteAllModal');
  const closeBtn = document.getElementById('closeDeleteAllModalBtn');
  const cancelBtn = document.getElementById('cancelDeleteAllBtn');
  const form = document.getElementById('deleteAllConfirmForm');
  const pwdInput = document.getElementById('deleteAdminPasswordInput');
  const msgBox = document.getElementById('deleteAllMsg');
  const confirmBtn = document.getElementById('confirmDeleteAllBtn');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (msgBox) msgBox.style.display = 'none';
      if (pwdInput) pwdInput.value = '';
      if (modal) modal.style.display = 'flex';
    });
  }

  function hideModal() {
    if (modal) modal.style.display = 'none';
    if (pwdInput) pwdInput.value = '';
    if (msgBox) msgBox.style.display = 'none';
  }

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

  if (form) {
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredPwd = pwdInput.value.trim();

      // Verify Super Admin Password (accepts eeefestadmin or current logged-in super admin password)
      const passwordMatch = (enteredPwd === 'eeefestadmin') || (currentAdmin && enteredPwd === currentAdmin.password);
      if (!passwordMatch) {
        sfx.playError();
        msgBox.innerText = 'Incorrect Super Admin password. Deletion unauthorized.';
        msgBox.style.background = 'rgba(239, 68, 68, 0.2)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Wiping Database...';
      msgBox.style.display = 'none';

      try {
        if (isLiveApi) {
          try {
            await fetch('/api/delete-all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: enteredPwd })
            });
          } catch (e) {}
        }

        // Wipe all coupons from Firebase Realtime Database (JS SDK + REST endpoint)
        if (rtdb) {
          try { await rtdb.ref('coupons').remove(); } catch (e) {}
        }
        try {
          await fetch('https://fest2026-35ba3-default-rtdb.asia-southeast1.firebasedatabase.app/coupons.json', { method: 'DELETE' });
        } catch (e) {}

        localStorage.setItem('eeefest_database_wiped', 'true');
        setLocalCoupons([]);
        selectedCouponCodes.clear();
        resetResultBox();
        refreshStatsAndTable();
        sfx.playWarning();

        msgBox.innerText = 'All coupons permanently deleted from database.';
        msgBox.style.background = 'rgba(239, 68, 68, 0.2)';
        msgBox.style.color = '#ef4444';
        msgBox.style.display = 'block';

        showNotification('Database cleared: All coupons have been wiped.');
        setTimeout(() => {
          hideModal();
          confirmBtn.disabled = false;
          confirmBtn.innerText = 'Permanently Delete All';
        }, 1500);
      } catch (err) {
        sfx.playError();
        msgBox.innerText = 'Error deleting coupons: ' + err.message;
        msgBox.style.background = 'rgba(239, 68, 68, 0.2)';
        msgBox.style.color = '#ff80ab';
        msgBox.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Permanently Delete All';
      }
    });
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

function updateSelectedActionBar() {
  const bar = document.getElementById('selectedActionBar');
  const countLabel = document.getElementById('selectedCountLabel');
  const count = selectedCouponCodes.size;
  if (countLabel) countLabel.innerText = count.toLocaleString();
  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
}

function updateBatchFilterOptions() {
  const select = document.getElementById('tableBatchFilter');
  if (!select) return;

  const currentVal = select.value;
  const batches = Array.from(new Set(localCoupons.map(c => c.created_at || '2026-11-20 08:00:00 AM'))).filter(Boolean);

  let html = '<option value="all">All Batches / Timestamps</option>';
  for (const b of batches) {
    const count = localCoupons.filter(c => (c.created_at || '2026-11-20 08:00:00 AM') === b).length;
    html += `<option value="${b}">${b} (${count})</option>`;
  }
  select.innerHTML = html;
  if (batches.includes(currentVal)) {
    select.value = currentVal;
  }
}

function initTableControls() {
  const searchInput = document.getElementById('tableSearchInput');
  const statusSelect = document.getElementById('tableStatusFilter');
  const batchSelect = document.getElementById('tableBatchFilter');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const selectAllCheckbox = document.getElementById('selectAllCouponsCheckbox');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const downloadSelectedBtn = document.getElementById('downloadSelectedPdfBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toUpperCase();
      currentPage = 1;
      fetchCoupons();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      currentPage = 1;
      fetchCoupons();
    });
  }

  if (batchSelect) {
    batchSelect.addEventListener('change', (e) => {
      createdBatchFilter = e.target.value;
      currentPage = 1;
      fetchCoupons();
    });
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
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
      if (createdBatchFilter && createdBatchFilter !== 'all') {
        filtered = filtered.filter(c => (c.created_at || '2026-11-20 08:00:00 AM') === createdBatchFilter);
      }

      const start = (currentPage - 1) * itemsPerPage;
      const pageItems = filtered.slice(start, start + itemsPerPage);

      if (e.target.checked) {
        pageItems.forEach(c => selectedCouponCodes.add(c.code));
      } else {
        pageItems.forEach(c => selectedCouponCodes.delete(c.code));
      }
      fetchCoupons();
    });
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      selectedCouponCodes.clear();
      fetchCoupons();
    });
  }

  if (downloadSelectedBtn) {
    downloadSelectedBtn.addEventListener('click', async () => {
      if (selectedCouponCodes.size === 0) {
        showNotification('No coupons selected for download.', 'warning');
        return;
      }
      const selectedList = localCoupons.filter(c => selectedCouponCodes.has(c.code));
      downloadSelectedBtn.disabled = true;
      downloadSelectedBtn.innerText = `Compiling PDF (${selectedList.length})...`;

      const progressWrap = document.getElementById('addonProgressWrap');
      const progressBar = document.getElementById('addonProgressBar');
      const progressText = document.getElementById('addonProgressText');
      const progressPct = document.getElementById('addonProgressPct');
      const addonModal = document.getElementById('addonModal');

      if (addonModal) addonModal.style.display = 'flex';
      if (progressWrap) {
        progressWrap.style.display = 'block';
        if (progressBar) progressBar.style.width = '5%';
        if (progressText) progressText.innerText = `Preparing printable sheets for ${selectedList.length} passes...`;
      }

      try {
        await generateCouponsPdfClientSide(selectedList, (pct, msg) => {
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressPct) progressPct.innerText = pct + '%';
          if (progressText) progressText.innerText = msg;
        }, `EEE_FEST_2026_Selected_${selectedList.length}_Coupons.pdf`);

        showNotification(`Downloaded printable PDF for ${selectedList.length} selected coupons.`, 'success');
        setTimeout(() => {
          if (addonModal) addonModal.style.display = 'none';
        }, 1200);
      } catch (err) {
        showNotification(`PDF generation failed: ${err.message}`, 'danger');
      } finally {
        downloadSelectedBtn.disabled = false;
        downloadSelectedBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download Selected Printable PDF
        `;
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchCoupons();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage++;
      fetchCoupons();
    });
  }
}

async function fetchCoupons() {
  const tbody = document.getElementById('couponsTableBody');
  const pageLabel = document.getElementById('currentPageLabel');
  const infoLabel = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  updateBatchFilterOptions();

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

  if (createdBatchFilter && createdBatchFilter !== 'all') {
    filtered = filtered.filter(c => (c.created_at || '2026-11-20 08:00:00 AM') === createdBatchFilter);
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  if (pageLabel) pageLabel.innerText = `Page ${currentPage} of ${totalPages}`;
  const startNum = totalFiltered === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endNum = Math.min(currentPage * itemsPerPage, totalFiltered);
  if (infoLabel) infoLabel.innerText = `Showing ${startNum} to ${endNum} of ${totalFiltered.toLocaleString()} coupons`;

  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  const start = (currentPage - 1) * itemsPerPage;
  const items = filtered.slice(start, start + itemsPerPage);

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No matching coupons found.</td></tr>';
    updateSelectedActionBar();
    return;
  }

  tbody.innerHTML = items.map(c => {
    const isChecked = selectedCouponCodes.has(c.code) ? 'checked' : '';
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
    const createdAt = c.created_at || '2026-11-20 08:00:00 AM';

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="coupon-select-checkbox" data-code="${c.code}" ${isChecked}>
        </td>
        <td>#${String(c.serial).padStart(4, '0')}</td>
        <td class="table-code">${c.code}</td>
        <td style="font-size: 0.76rem; color: var(--text-muted);">${createdAt}</td>
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

  // Row checkbox change listeners
  tbody.querySelectorAll('.coupon-select-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const code = e.target.dataset.code;
      if (e.target.checked) {
        selectedCouponCodes.add(code);
      } else {
        selectedCouponCodes.delete(code);
      }
      updateSelectedActionBar();
    });
  });

  const selectAll = document.getElementById('selectAllCouponsCheckbox');
  if (selectAll) {
    selectAll.checked = items.length > 0 && items.every(c => selectedCouponCodes.has(c.code));
  }

  updateSelectedActionBar();
}

// ========================================================
// EXPORT EXCEL
// ========================================================
function initExportButton() {
  const exportBtn = document.getElementById('exportBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    downloadLiveExcel();
  });
}

function downloadLiveExcel() {
  if (typeof XLSX === 'undefined') {
    // fallback: download generated Excel file
    window.location.href = './EEE_FEST_2026_Coupons.xlsx';
    return;
  }

  // 1. Coupons Master Data Sheet
  const headers = [
    "SL No",
    "Coupon Code",
    "Created At",
    "Raffle Draw Status",
    "Raffle Scanned At",
    "Raffle Scanned By",
    "Lunch Status",
    "Lunch Scanned At",
    "Lunch Scanned By",
    "T-Shirt Status",
    "T-Shirt Scanned At",
    "T-Shirt Scanned By",
    "QR Reference"
  ];

  const rows = [headers];
  localCoupons.forEach((c, idx) => {
    rows.push([
      c.serial || (idx + 1),
      c.code,
      c.created_at || "2026-11-20 08:00:00 AM",
      c.raffle_status || "AVAILABLE",
      c.raffle_submitted_at || "",
      c.raffle_scanned_by || "",
      c.lunch_status || "AVAILABLE",
      c.lunch_redeemed_at || "",
      c.lunch_scanned_by || "",
      c.tshirt_status || "AVAILABLE",
      c.tshirt_redeemed_at || "",
      c.tshirt_scanned_by || "",
      c.qr_file || `QR_${String(c.serial || idx + 1).padStart(4, '0')}_${c.code}_maroon.png`
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 8 },  // SL No
    { wch: 15 }, // Coupon Code
    { wch: 24 }, // Created At
    { wch: 18 }, // Raffle Draw Status
    { wch: 22 }, // Raffle Scanned At
    { wch: 22 }, // Raffle Scanned By
    { wch: 15 }, // Lunch Status
    { wch: 22 }, // Lunch Scanned At
    { wch: 22 }, // Lunch Scanned By
    { wch: 15 }, // T-Shirt Status
    { wch: 22 }, // T-Shirt Scanned At
    { wch: 22 }, // T-Shirt Scanned By
    { wch: 26 }  // QR Reference
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Coupons Master");

  // 2. Summary Dashboard Sheet
  const total = localCoupons.length;
  const raffleDone = localCoupons.filter(c => c.raffle_status === 'REDEEMED' || c.raffle_status === 'SUBMITTED').length;
  const lunchDone = localCoupons.filter(c => c.lunch_status === 'REDEEMED').length;
  const tshirtDone = localCoupons.filter(c => c.tshirt_status === 'REDEEMED').length;

  const summaryRows = [
    ["EEE FEST 2026 - Master Live Database Summary", ""],
    ["Total Issued Coupons (Initial + Addons)", total],
    ["Raffle Draw Entries Submitted", raffleDone],
    ["Lunch & Drinks Meals Redeemed", lunchDone],
    ["T-Shirts Distributed", tshirtDone],
    ["Real-Time Sync Engine", "Firebase Realtime Database (asia-southeast1)"],
    ["Export Timestamp", new Date().toLocaleString()]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Live Summary");

  XLSX.writeFile(wb, `EEE_FEST_2026_Coupons_Live_${Date.now()}.xlsx`);
  showNotification("Master Excel exported successfully with all original & addon coupons.");
}
