/**
 * EEE FEST 2026 - Master Verification Portal Frontend Engine
 */

let currentCategory = 'raffle';
let html5QrCode = null;
let isScannerRunning = false;
let currentCameraIndex = 0;
let availableCameras = [];
let lastScannedCode = null;
let lastScanTime = 0;
let currentPage = 1;

// Web Audio API Sound Synthesizer
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Note 1: E5
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Note 2: A5
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  }

  playWarning() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.35);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
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
      osc.frequency.setValueAtTime(320, now + offset);
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }
}

const sfx = new SoundEffects();

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
  initCategoryTabs();
  initManualForm();
  initScanner();
  initTableControls();
  fetchStats();
  fetchCoupons();
});

// Category Tabs
function initCategoryTabs() {
  const tabs = document.querySelectorAll('.cat-tab');
  const pill = document.getElementById('activeCategoryPill');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;

      if (currentCategory === 'lunch') {
        pill.innerText = '🍱 Lunch & Drinks Booth';
      } else if (currentCategory === 'tshirt') {
        pill.innerText = '👕 T-Shirt Booth';
      } else {
        pill.innerText = '🎟️ Raffle Draw';
      }

      resetResultBox();
      fetchStats();
      fetchCoupons();
    });
  });
}

// Manual Form Handler
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

// QR Scanner Engine
function initScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const flipBtn = document.getElementById('flipCameraBtn');
  const selectRow = document.getElementById('cameraSelectRow');
  const select = document.getElementById('cameraSelect');
  const overlay = document.getElementById('scannerOverlay');

  if (typeof Html5Qrcode === 'undefined') {
    console.warn('Html5Qrcode library not loaded yet');
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
    console.log('Camera permission error or not available:', err);
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
  const cameraId = availableCameras.length > 0 ? availableCameras[currentCameraIndex].id : { facingMode: 'environment' };

  const config = {
    fps: 15,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1.333334
  };

  html5QrCode.start(
    cameraId,
    config,
    (decodedText) => {
      handleQrDecoded(decodedText);
    },
    (errorMessage) => {
      // Ignore scan loop debug noise
    }
  ).then(() => {
    isScannerRunning = true;
    toggleBtn.innerText = 'Stop Camera';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-secondary');
    overlay.style.display = 'flex';
  }).catch(err => {
    console.error('Failed to start scanner:', err);
    alert('Unable to access camera: ' + err);
  });
}

function stopScanner() {
  const toggleBtn = document.getElementById('toggleScannerBtn');
  const overlay = document.getElementById('scannerOverlay');

  if (!html5QrCode || !isScannerRunning) return Promise.resolve();

  return html5QrCode.stop().then(() => {
    isScannerRunning = false;
    toggleBtn.innerText = 'Start Camera';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-primary');
    overlay.style.display = 'none';
  }).catch(err => {
    console.error('Error stopping scanner:', err);
  });
}

function handleQrDecoded(text) {
  const now = Date.now();
  // Debounce duplicate scans within 2 seconds
  if (text === lastScannedCode && now - lastScanTime < 2500) {
    return;
  }
  lastScannedCode = text;
  lastScanTime = now;
  verifyCode(text);
}

// Verification Core
function verifyCode(rawCode) {
  sfx.init();

  fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: rawCode, category: currentCategory })
  })
  .then(res => res.json())
  .then(data => {
    displayResult(data);
    fetchStats();
    fetchCoupons();
  })
  .catch(err => {
    console.error('Verification error:', err);
    displayResult({
      success: false,
      status: 'ERROR',
      message: 'Network or server communication error.'
    });
  });
}

// Result Box Rendering
function displayResult(data) {
  const box = document.getElementById('resultBox');
  box.className = 'result-box';

  let iconSvg = '';
  let title = '';
  let statusClass = '';

  if (data.status === 'SUCCESS') {
    sfx.playSuccess();
    statusClass = 'result-success';
    title = 'VALID COUPON VERIFIED';
    iconSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (data.status === 'ALREADY_SUBMITTED') {
    sfx.playWarning();
    statusClass = 'result-warning';
    title = 'WARNING: ALREADY SUBMITTED';
    iconSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  } else {
    sfx.playError();
    statusClass = 'result-danger';
    title = 'COUNTERFEIT / INVALID CODE';
    iconSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  }

  box.classList.add(statusClass);

  let detailsHtml = '';
  if (data.coupon) {
    detailsHtml = `
      <div class="result-details-row">
        <span><strong>Serial:</strong> #${String(data.coupon.serial).padStart(4, '0')}</span>
        <span><strong>Code:</strong> <code class="table-code">${data.coupon.code}</code></span>
        <span><strong>Category:</strong> ${currentCategory.toUpperCase()}</span>
      </div>
    `;
  }

  box.innerHTML = `
    <div class="result-icon">${iconSvg}</div>
    <div class="result-body">
      <h3 class="result-title">${title}</h3>
      <p class="result-message">${data.message}</p>
      ${detailsHtml}
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

// Fetch Live Stats
function fetchStats() {
  fetch(`/api/stats?category=${currentCategory}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('statTotal').innerText = data.total.toLocaleString();
      document.getElementById('statSubmitted').innerText = data.submitted.toLocaleString();
      document.getElementById('statRemaining').innerText = data.remaining.toLocaleString();
      document.getElementById('statProgressBar').style.width = `${data.percentage}%`;
      document.getElementById('statPercent').innerText = `${data.percentage}% completion`;

      renderActivityList(data.recent_activity || []);
    })
    .catch(err => console.error('Failed to fetch stats:', err));
}

// Render Live Activity List
function renderActivityList(items) {
  const list = document.getElementById('activityList');
  if (!items || items.length === 0) {
    list.innerHTML = `<div class="activity-empty">No scans recorded yet in this session.</div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    let badgeClass = 'badge-success';
    if (item.status === 'ALREADY_SUBMITTED') badgeClass = 'badge-warning';
    else if (item.status === 'COUNTERFEIT' || item.status === 'ERROR') badgeClass = 'badge-danger';

    return `
      <div class="activity-item">
        <div>
          <span class="activity-code">${item.code}</span>
          <span style="color: var(--text-dim); margin-left: 0.5rem; font-size: 0.75rem;">${item.time}</span>
        </div>
        <div>
          <span class="activity-badge ${badgeClass}">${item.status.replace('_', ' ')}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Table Controls & Fetching
function initTableControls() {
  const search = document.getElementById('tableSearchInput');
  const filter = document.getElementById('tableStatusFilter');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  let debounceTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentPage = 1;
      fetchCoupons();
    }, 250);
  });

  filter.addEventListener('change', () => {
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

function fetchCoupons() {
  const query = document.getElementById('tableSearchInput').value.trim();
  const status = document.getElementById('tableStatusFilter').value;
  const tbody = document.getElementById('couponsTableBody');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const pageLabel = document.getElementById('currentPageLabel');
  const pageInfo = document.getElementById('paginationInfo');

  const url = `/api/coupons?q=${encodeURIComponent(query)}&status=${status}&category=${currentCategory}&page=${currentPage}&per_page=20`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      pageLabel.innerText = `Page ${data.page}`;
      prevBtn.disabled = data.page <= 1;
      nextBtn.disabled = (data.page * data.per_page) >= data.total;

      const start = data.total > 0 ? (data.page - 1) * data.per_page + 1 : 0;
      const end = Math.min(data.page * data.per_page, data.total);
      pageInfo.innerText = `Showing ${start} to ${end} of ${data.total.toLocaleString()}`;

      if (!data.items || data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No coupons matching criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.items.map(c => {
        const raffleBadge = c.raffle_status === 'SUBMITTED' 
          ? `<span class="activity-badge badge-success">SUBMITTED</span>`
          : `<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>`;

        const lunchBadge = c.lunch_status === 'REDEEMED'
          ? `<span class="activity-badge badge-success">REDEEMED</span>`
          : `<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>`;

        const tshirtBadge = c.tshirt_status === 'REDEEMED'
          ? `<span class="activity-badge badge-success">REDEEMED</span>`
          : `<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>`;

        return `
          <tr>
            <td>#${String(c.serial).padStart(4, '0')}</td>
            <td><code class="table-code">${c.code}</code></td>
            <td>${raffleBadge}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${c.raffle_submitted_at || '-'}</td>
            <td>${lunchBadge}</td>
            <td>${tshirtBadge}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="verifyCode('${c.code}')">Verify</button>
            </td>
          </tr>
        `;
      }).join('');
    })
    .catch(err => {
      console.error('Failed to fetch coupons:', err);
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color: var(--danger)">Error loading table data.</td></tr>`;
    });
}
