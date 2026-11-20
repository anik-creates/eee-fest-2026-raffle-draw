/**
 * EEE FEST 2026 - Standalone Client-Side Portal Engine (GitHub Pages)
 */

let couponsList = [];
let couponsByCode = {};
let currentCategory = 'raffle';
let html5QrCode = null;
let isScannerRunning = false;
let currentCameraIndex = 0;
let availableCameras = [];
let lastScannedCode = null;
let lastScanTime = 0;
let currentPage = 1;
let recentActivity = [];

// Sound Synthesizer
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

document.addEventListener('DOMContentLoaded', () => {
  loadDatabase().then(() => {
    initCategoryTabs();
    initManualForm();
    initScanner();
    initTableControls();
    initExportCsv();
    updateStats();
    renderTable();
  });
});

function loadDatabase() {
  return fetch('./coupons_db.json')
    .then(res => res.json())
    .then(data => {
      couponsList = data;
      // Merge with localStorage if previous scans exist
      const localOverrides = localStorage.getItem('eee_fest_coupons_state');
      if (localOverrides) {
        try {
          const overrides = JSON.parse(localOverrides);
          couponsList.forEach(c => {
            if (overrides[c.code]) {
              Object.assign(c, overrides[c.code]);
            }
          });
        } catch (e) {
          console.error('Error parsing localStorage:', e);
        }
      }
      couponsByCode = {};
      couponsList.forEach(c => {
        couponsByCode[c.code.toUpperCase()] = c;
      });
      document.getElementById('systemStatusLabel').innerText = `CLOUD VERIFICATION READY (${couponsList.length.toLocaleString()} COUPONS)`;
    })
    .catch(err => {
      console.error('Failed to load coupons_db.json:', err);
      document.getElementById('systemStatusLabel').innerText = 'ERROR LOADING DATABASE';
    });
}

function saveLocalState() {
  const overrides = {};
  couponsList.forEach(c => {
    if (c.raffle_status !== 'AVAILABLE' || c.lunch_status !== 'AVAILABLE' || c.tshirt_status !== 'AVAILABLE') {
      overrides[c.code] = {
        raffle_status: c.raffle_status,
        raffle_submitted_at: c.raffle_submitted_at,
        lunch_status: c.lunch_status,
        lunch_redeemed_at: c.lunch_redeemed_at,
        tshirt_status: c.tshirt_status,
        tshirt_redeemed_at: c.tshirt_redeemed_at
      };
    }
  });
  localStorage.setItem('eee_fest_coupons_state', JSON.stringify(overrides));
}

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
      updateStats();
      renderTable();
    });
  });
}

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
  const overlay = document.getElementById('scannerOverlay');

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
  }).catch(err => console.log('Camera init note:', err));

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

  html5QrCode.start(
    cameraId,
    { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.333334 },
    (decodedText) => handleQrDecoded(decodedText),
    () => {}
  ).then(() => {
    isScannerRunning = true;
    toggleBtn.innerText = 'Stop Camera';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-secondary');
    overlay.style.display = 'flex';
  }).catch(err => {
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
  });
}

function handleQrDecoded(text) {
  const now = Date.now();
  if (text === lastScannedCode && now - lastScanTime < 2500) return;
  lastScannedCode = text;
  lastScanTime = now;
  verifyCode(text);
}

function verifyCode(rawText) {
  sfx.init();
  let code = rawText.trim().toUpperCase();
  if (code.includes('CODE=')) {
    code = code.split('CODE=')[1].split('&')[0].trim();
  } else if (code.includes('/')) {
    code = code.split('/').pop().trim();
  }

  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // 1. Counterfeit Check
  const coupon = couponsByCode[code];
  if (!coupon) {
    sfx.playError();
    const result = {
      status: 'COUNTERFEIT',
      code: code,
      message: `COUNTERFEIT ALERT! Code '${code}' does NOT exist in the official 1,260 EEE FEST 2026 database.`
    };
    recentActivity.unshift({ time: timestamp, code: code, status: 'COUNTERFEIT' });
    displayResult(result);
    updateStats();
    return;
  }

  // 2. Determine Category Key
  let statusKey = 'raffle_status';
  let timeKey = 'raffle_submitted_at';
  let claimedVal = 'SUBMITTED';
  let actionName = 'Raffle Draw';

  if (currentCategory === 'lunch') {
    statusKey = 'lunch_status';
    timeKey = 'lunch_redeemed_at';
    claimedVal = 'REDEEMED';
    actionName = 'Lunch & Drinks';
  } else if (currentCategory === 'tshirt') {
    statusKey = 'tshirt_status';
    timeKey = 'tshirt_redeemed_at';
    claimedVal = 'REDEEMED';
    actionName = 'T-Shirt';
  }

  // 3. Already Submitted Check
  if (coupon[statusKey] === claimedVal) {
    sfx.playWarning();
    const prevTime = coupon[timeKey] || 'Earlier';
    const result = {
      status: 'ALREADY_SUBMITTED',
      coupon: coupon,
      message: `ALREADY SUBMITTED! Coupon #${String(coupon.serial).padStart(4, '0')} (${code}) was already registered for ${actionName} on ${prevTime}. Duplicate detected!`
    };
    recentActivity.unshift({ time: timestamp, code: code, status: 'ALREADY_SUBMITTED' });
    displayResult(result);
    updateStats();
    return;
  }

  // 4. Valid & Not Yet Submitted: Register it!
  sfx.playSuccess();
  coupon[statusKey] = claimedVal;
  coupon[timeKey] = timestamp;
  saveLocalState();

  recentActivity.unshift({ time: timestamp, code: code, status: 'SUCCESS' });
  const result = {
    status: 'SUCCESS',
    coupon: coupon,
    message: `SUCCESS! Coupon #${String(coupon.serial).padStart(4, '0')} (${code}) verified & successfully registered for ${actionName}.`
  };
  displayResult(result);
  updateStats();
  renderTable();
}

function displayResult(data) {
  const box = document.getElementById('resultBox');
  box.className = 'result-box';

  let iconSvg = '';
  let title = '';
  let statusClass = '';

  if (data.status === 'SUCCESS') {
    statusClass = 'result-success';
    title = 'VALID COUPON VERIFIED';
    iconSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (data.status === 'ALREADY_SUBMITTED') {
    statusClass = 'result-warning';
    title = 'WARNING: ALREADY SUBMITTED';
    iconSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  } else {
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

function updateStats() {
  const total = couponsList.length;
  let statusKey = 'raffle_status';
  let claimedVal = 'SUBMITTED';

  if (currentCategory === 'lunch') {
    statusKey = 'lunch_status';
    claimedVal = 'REDEEMED';
  } else if (currentCategory === 'tshirt') {
    statusKey = 'tshirt_status';
    claimedVal = 'REDEEMED';
  }

  const submitted = couponsList.filter(c => c[statusKey] === claimedVal).length;
  const remaining = total - submitted;
  const percentage = total > 0 ? (submitted / total * 100).toFixed(1) : '0.0';

  document.getElementById('statTotal').innerText = total.toLocaleString();
  document.getElementById('statSubmitted').innerText = submitted.toLocaleString();
  document.getElementById('statRemaining').innerText = remaining.toLocaleString();
  document.getElementById('statProgressBar').style.width = `${percentage}%`;
  document.getElementById('statPercent').innerText = `${percentage}% completion`;

  renderActivityList();
}

function renderActivityList() {
  const list = document.getElementById('activityList');
  if (!recentActivity || recentActivity.length === 0) {
    list.innerHTML = `<div class="activity-empty">No scans recorded yet in this session.</div>`;
    return;
  }

  list.innerHTML = recentActivity.slice(0, 15).map(item => {
    let badgeClass = 'badge-success';
    if (item.status === 'ALREADY_SUBMITTED') badgeClass = 'badge-warning';
    else if (item.status === 'COUNTERFEIT') badgeClass = 'badge-danger';

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

function initTableControls() {
  const search = document.getElementById('tableSearchInput');
  const filter = document.getElementById('tableStatusFilter');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  search.addEventListener('input', () => {
    currentPage = 1;
    renderTable();
  });

  filter.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    renderTable();
  });
}

function renderTable() {
  const query = document.getElementById('tableSearchInput').value.trim().toUpperCase();
  const filter = document.getElementById('tableStatusFilter').value;
  const tbody = document.getElementById('couponsTableBody');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const pageLabel = document.getElementById('currentPageLabel');
  const pageInfo = document.getElementById('paginationInfo');

  let statusKey = 'raffle_status';
  let claimedVal = 'SUBMITTED';
  if (currentCategory === 'lunch') {
    statusKey = 'lunch_status';
    claimedVal = 'REDEEMED';
  } else if (currentCategory === 'tshirt') {
    statusKey = 'tshirt_status';
    claimedVal = 'REDEEMED';
  }

  let filtered = couponsList;
  if (query) {
    filtered = filtered.filter(c => 
      c.code.includes(query) || 
      String(c.serial) === query || 
      `#${String(c.serial).padStart(4, '0')}`.includes(query)
    );
  }

  if (filter === 'submitted') {
    filtered = filtered.filter(c => c[statusKey] === claimedVal);
  } else if (filter === 'available') {
    filtered = filtered.filter(c => c[statusKey] === 'AVAILABLE');
  }

  const perPage = 20;
  const total = filtered.length;
  pageLabel.innerText = `Page ${currentPage}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = (currentPage * perPage) >= total;

  const start = total > 0 ? (currentPage - 1) * perPage : 0;
  const end = Math.min(currentPage * perPage, total);
  pageInfo.innerText = `Showing ${total > 0 ? start + 1 : 0} to ${end} of ${total.toLocaleString()}`;

  const pageItems = filtered.slice(start, end);
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No coupons found.</td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(c => `
    <tr>
      <td>#${String(c.serial).padStart(4, '0')}</td>
      <td><code class="table-code">${c.code}</code></td>
      <td>${c.raffle_status === 'SUBMITTED' ? '<span class="activity-badge badge-success">SUBMITTED</span>' : '<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>'}</td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">${c.raffle_submitted_at || '-'}</td>
      <td>${c.lunch_status === 'REDEEMED' ? '<span class="activity-badge badge-success">REDEEMED</span>' : '<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>'}</td>
      <td>${c.tshirt_status === 'REDEEMED' ? '<span class="activity-badge badge-success">REDEEMED</span>' : '<span class="activity-badge" style="background: rgba(255,255,255,0.08); color: var(--text-muted)">AVAILABLE</span>'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="verifyCode('${c.code}')">Verify</button>
      </td>
    </tr>
  `).join('');
}

function initExportCsv() {
  document.getElementById('exportCsvBtn').addEventListener('click', () => {
    let csv = 'SL No,Coupon Code,QR Data,Raffle Status,Raffle Submitted At,Lunch Status,Lunch Redeemed At,T-Shirt Status,T-Shirt Redeemed At\n';
    couponsList.forEach(c => {
      csv += `"${c.serial}","${c.code}","${c.qr_data}","${c.raffle_status}","${c.raffle_submitted_at}","${c.lunch_status}","${c.lunch_redeemed_at}","${c.tshirt_status}","${c.tshirt_redeemed_at}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EEE_FEST_2026_Coupons_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
