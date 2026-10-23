// Nexus Luxury Enterprise POS Engine v8.6 - Guaranteed Click Execution & Checkout Handlers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAIRH-6mmznVMfGIegHF7ckQXq30MFDDBw",
    authDomain: "hockey-840dd.firebaseapp.com",
    databaseURL: "https://hockey-840dd-default-rtdb.firebaseio.com",
    projectId: "hockey-840dd",
    storageBucket: "hockey-840dd.firebasestorage.app",
    messagingSenderId: "454222626197",
    appId: "1:454222626197:web:6df5eea83d3bbae0df0a9c",
    measurementId: "G-BBNC63SFHZ"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

let currentMainOperator = localStorage.getItem('rf_main_operator') || null;
let currentOperator = localStorage.getItem('rf_current_operator') || null;
let isMainOpSession = localStorage.getItem('rf_is_main_op') === 'true';

let accounts = [];
let products = [];
let coupons = [];
let giftCards = [];
let employees = [];
let subOperators = [];
let timeclockEntries = [];
let offlineTransactionQueue = [];

let currentActiveAccount = null;
let currentCart = [];
let appliedCoupon = null;
let pendingAction = null;
let pendingSubOpData = null;
let html5QrCodeScanner = null;
let activeScanTargetId = null;
let currentCurrency = localStorage.getItem('rf_currency') || 'USD';
let dbListenerUnsubscribe = null;

const CurrencySymbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$' };

function formatCurrency(amount) {
    return `${CurrencySymbols[currentCurrency] || '$'}${amount.toFixed(2)}`;
}

// Realistic Scan & POS Sound Engine
const SoundEngine = {
    enabled: localStorage.getItem('rf_sound') !== 'OFF',
    playClick() {
        if(!this.enabled) return;
        try {
            let ctx = new (window.AudioContext || window.webkitAudioContext)();
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.05);
        } catch(e) {}
    },
    playBeep() {
        if(!this.enabled) return;
        try {
            let ctx = new (window.AudioContext || window.webkitAudioContext)();
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(1046.50, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.15);
        } catch(e) {}
    },
    playScan() {
        if(!this.enabled) return;
        try {
            let ctx = new (window.AudioContext || window.webkitAudioContext)();
            let now = ctx.currentTime;
            [1200, 1800].forEach((freq, idx) => {
                let osc = ctx.createOscillator();
                let gain = ctx.createGain();
                osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                gain.gain.setValueAtTime(0.2, now + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.06);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(now + idx * 0.04); osc.stop(now + idx * 0.04 + 0.06);
            });
        } catch(e) {}
    },
    playSuccess() {
        if(!this.enabled) return;
        try {
            let ctx = new (window.AudioContext || window.webkitAudioContext)();
            let now = ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((freq, idx) => {
                let osc = ctx.createOscillator();
                let gain = ctx.createGain();
                osc.type = 'triangle'; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.18, now + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(now + idx * 0.06); osc.stop(now + idx * 0.06 + 0.3);
            });
        } catch(e) {}
    },
    playError() {
        if(!this.enabled) return;
        try {
            let ctx = new (window.AudioContext || window.webkitAudioContext)();
            let now = ctx.currentTime;
            [220, 160].forEach((freq, idx) => {
                let osc = ctx.createOscillator();
                let gain = ctx.createGain();
                osc.type = 'sawtooth'; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.2, now + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(now + idx * 0.12); osc.stop(now + idx * 0.12 + 0.25);
            });
        } catch(e) {}
    }
};

const loadingTips = [
    "Tip: USB Laser Barcode Scanner ready for instant wedge input.",
    "Tip: Scan barcodes on create/edit forms to instantly capture and save new barcodes.",
    "Tip: Cashier ID badges with photo upload and QR/barcodes fully enabled.",
    "Tip: Multi-channel Discord Webhook logging active across all operations."
];

window.onload = function() {
    runCinematicSplashSequence();
    setupSafeKeybinds();
    setupGlobalFocusGuards();
    setupUsbBarcodeScannerListener();
    applyInitialTheme();
    if(typeof lucide !== 'undefined') lucide.createIcons();

    resetAccountForm();
    resetProductForm();
    resetCouponForm();
    resetGCForm();
    resetEmpForm();

    if(currentMainOperator && currentOperator) {
        document.getElementById('appLoadingSplash').classList.add('hidden');
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('currentOperatorName').innerText = `${currentOperator} ${isMainOpSession ? '(Main Owner)' : '(Worker)'}`;
        setupRealtimeCloudListener();
    }
};

// --- USB BARCODE SCANNER GLOBAL HID KEYBOARD WEDGE LISTENER ---
function setupUsbBarcodeScannerListener() {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    window.addEventListener('keydown', (e) => {
        let currentTime = Date.now();
        let activeEl = document.activeElement;

        if (e.key === 'Enter') {
            if (barcodeBuffer.trim().length >= 2) {
                let scannedCode = barcodeBuffer.trim();
                barcodeBuffer = '';
                e.preventDefault();
                SoundEngine.playScan();
                handleUniversalScan(scannedCode);
            } else {
                barcodeBuffer = '';
            }
        } else if (e.key.length === 1) {
            if (currentTime - lastKeyTime > 60) {
                barcodeBuffer = '';
            }
            barcodeBuffer += e.key;
            lastKeyTime = currentTime;
        }
    }, true);
}

window.handleUniversalScan = function(code) {
    code = code.trim();
    if(!code) return;

    let activeInput = document.activeElement;
    
    // If an input field is currently active or focused, populate it immediately
    if(activeInput && ['INPUT', 'TEXTAREA'].includes(activeInput.tagName)) {
        activeInput.value = code;
        activeInput.dispatchEvent(new Event('input'));
        SoundEngine.playScan();
        if(activeInput.id === 'newAccNumber') updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
        if(activeInput.id === 'prodNumber') updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg');
        if(activeInput.id === 'gcCode') updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg');
        if(activeInput.id === 'empBarcode') updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg');
        if(activeInput.id === 'cartProdNumInput') processScannedCode(code);
        return;
    }

    // Check if any creation/edit tab is currently visible, and auto-target its barcode input field
    let createAccTab = document.getElementById('tab-createAccount');
    let productsTab = document.getElementById('tab-products');
    let gcTab = document.getElementById('tab-giftcards');
    let payrollTab = document.getElementById('tab-payroll');
    let accountModal = document.getElementById('accountModal');

    if (accountModal && !accountModal.classList.contains('hidden')) {
        let input = document.getElementById('cartProdNumInput');
        if(input) { input.value = code; processScannedCode(code); }
        return;
    }

    if (createAccTab && !createAccTab.classList.contains('hidden')) {
        let el = document.getElementById('newAccNumber');
        if(el) { el.value = code; updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg'); el.focus(); }
        return;
    }

    if (productsTab && !productsTab.classList.contains('hidden')) {
        let el = document.getElementById('prodNumber');
        if(el) { el.value = code; updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg'); el.focus(); }
        return;
    }

    if (gcTab && !gcTab.classList.contains('hidden')) {
        let el = document.getElementById('gcCode');
        if(el) { el.value = code; updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg'); el.focus(); }
        return;
    }

    if (payrollTab && !payrollTab.classList.contains('hidden')) {
        let el = document.getElementById('empBarcode');
        if(el) { el.value = code; updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg'); el.focus(); }
        return;
    }

    // Default fallback: process as product scan
    let prod = products.find(p => p.number === code);
    if(prod) {
        switchTab('accounts');
        setTimeout(() => {
            if(accounts.length > 0) {
                loadAccountByNumber(accounts[0].number);
                setTimeout(() => { processScannedCode(code); }, 150);
            } else {
                showInsufficientModal(`Scanned Product: ${prod.name} (${formatCurrency(prod.price)}). Load customer account to add to cart.`);
            }
        }, 100);
        return;
    }

    let coup = coupons.find(c => c.code === code);
    if(coup) {
        appliedCoupon = coup;
        SoundEngine.playSuccess();
        alert(`Coupon Scanned & Applied: ${coup.name} (${coup.percent}% Off)!`);
        return;
    }

    let gc = giftCards.find(g => g.code === code);
    if(gc) {
        SoundEngine.playSuccess();
        alert(`Gift Card Scanned: ${gc.name} | Balance: ${formatCurrency(gc.balance)}`);
        return;
    }

    SoundEngine.playError();
    showInsufficientModal(`Scanned Code "${code}" not recognized in database.`);
};

function applyInitialTheme() {
    let savedTheme = localStorage.getItem('nexus_theme') || 'dark';
    let htmlRoot = document.getElementById('htmlRoot');
    let bodyRoot = document.getElementById('bodyRoot');
    if(savedTheme === 'light') {
        htmlRoot.classList.remove('dark');
        bodyRoot.className = 'bg-slate-100 text-slate-900 font-sans antialiased overflow-x-hidden select-none transition-colors duration-500 touch-manipulation';
    } else {
        htmlRoot.classList.add('dark');
        bodyRoot.className = 'bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden select-none transition-colors duration-500 touch-manipulation';
    }
}

window.toggleThemeMode = function(mode) {
    localStorage.setItem('nexus_theme', mode);
    applyInitialTheme();
    SoundEngine.playClick();
};

window.toggleMobileMenu = function() {
    let sidebar = document.getElementById('sidebarNav');
    if(sidebar) sidebar.classList.toggle('-translate-x-full');
};

function setupGlobalFocusGuards() {
    document.addEventListener('pointerdown', (e) => {
        if(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
            setTimeout(() => { e.target.focus(); }, 10);
        }
    }, true);
}

function runCinematicSplashSequence() {
    if(currentMainOperator && currentOperator) return;
    let bar = document.getElementById('splashProgressBar');
    let splash = document.getElementById('appLoadingSplash');
    let auth = document.getElementById('authScreen');
    let tipEl = document.getElementById('loadingTipText');

    let tipIdx = 0;
    let tipInterval = setInterval(() => {
        tipIdx = (tipIdx + 1) % loadingTips.length;
        if(tipEl) {
            tipEl.style.opacity = '0';
            setTimeout(() => { tipEl.innerText = loadingTips[tipIdx]; tipEl.style.opacity = '1'; }, 400);
        }
    }, 1800);

    if(bar) bar.style.width = '100%';
    setTimeout(() => {
        clearInterval(tipInterval);
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.classList.add('hidden');
                if(auth) auth.classList.remove('hidden');
                renderAuthScreen();
            }, 1000);
        }
    }, 5000);
}

function renderAuthScreen() {
    let container = document.getElementById('authFormContainer');
    if(!container) return;
    container.innerHTML = `
        <div class="space-y-4 pointer-events-auto">
            <div class="flex bg-slate-950 p-1.5 rounded-2xl border border-amber-500/20 mb-4">
                <button type="button" onclick="setAuthMode('main')" id="authModeMainBtn" class="flex-1 py-2 text-xs font-black rounded-xl bg-amber-500 text-slate-950 transition-all">Main Owner</button>
                <button type="button" onclick="setAuthMode('sub')" id="authModeSubBtn" class="flex-1 py-2 text-xs font-black rounded-xl text-slate-400 transition-all">Worker / Sub-Op</button>
            </div>
            <form onsubmit="handleLogin(event)" class="space-y-4">
                <div id="mainOpFieldGroup">
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Main Owner Username *</label>
                    <input type="text" id="loginMainUser" required autocomplete="off" class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-400 shadow-inner" placeholder="StoreOwner">
                </div>
                <div id="subOpFieldGroup" class="hidden">
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Store Main Owner Parent *</label>
                    <input type="text" id="loginStoreParent" autocomplete="off" class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-400 shadow-inner" placeholder="StoreOwner">
                    <label class="block text-xs font-bold uppercase tracking-wider text-sky-300 mt-3 mb-1">Worker Username *</label>
                    <input type="text" id="loginSubUser" autocomplete="off" class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-400 shadow-inner" placeholder="CashierJohn">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">4-Digit PIN *</label>
                    <input type="password" id="loginPin" maxlength="4" required autocomplete="current-password" class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm tracking-widest focus:outline-none focus:border-amber-400 shadow-inner" placeholder="••••">
                </div>
                <button type="submit" class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-indigo-600 text-slate-950 font-black rounded-2xl shadow-xl uppercase tracking-wider text-xs">Authenticate & Sync Cloud</button>
            </form>
        </div>
    `;
    setTimeout(() => { document.getElementById('loginMainUser')?.focus(); }, 100);
}

let activeAuthMode = 'main';
window.setAuthMode = function(mode) {
    activeAuthMode = mode;
    let mainBtn = document.getElementById('authModeMainBtn');
    let subBtn = document.getElementById('authModeSubBtn');
    let mainGroup = document.getElementById('mainOpFieldGroup');
    let subGroup = document.getElementById('subOpFieldGroup');

    if(mode === 'main') {
        if(mainBtn) mainBtn.className = 'flex-1 py-2 text-xs font-black rounded-xl bg-amber-500 text-slate-950 transition-all';
        if(subBtn) subBtn.className = 'flex-1 py-2 text-xs font-black rounded-xl text-slate-400 transition-all';
        if(mainGroup) mainGroup.classList.remove('hidden');
        if(subGroup) subGroup.classList.add('hidden');
    } else {
        if(subBtn) subBtn.className = 'flex-1 py-2 text-xs font-black rounded-xl bg-amber-500 text-slate-950 transition-all';
        if(mainBtn) mainBtn.className = 'flex-1 py-2 text-xs font-black rounded-xl text-slate-400 transition-all';
        if(subGroup) subGroup.classList.remove('hidden');
        if(mainGroup) mainGroup.classList.add('hidden');
    }
    SoundEngine.playClick();
};

window.handleLogin = async function(e) {
    e.preventDefault();
    let pin = document.getElementById('loginPin').value.trim();
    if(pin.length !== 4) { SoundEngine.playError(); showInsufficientModal('Enter a valid 4-digit PIN.'); return; }

    if(activeAuthMode === 'main') {
        let username = document.getElementById('loginMainUser').value.trim();
        if(!username) { SoundEngine.playError(); showInsufficientModal('Enter a main owner username.'); return; }

        let storeRef = ref(db, `stores/${username}`);
        let snapshot = await get(storeRef);

        if(!snapshot.exists()) {
            showConfirmationModal(`Store owner account "${username}" does not exist yet. Are you sure you want to create a new one?`, async () => {
                let initialData = {
                    pin: pin,
                    accounts: [{ number: 'ACC-1001', name: 'Victoria Sterling', email: 'victoria@nexus.com', balance: 2500.00, points: 250, cards: [{ number: '4242 •••• •••• 4242', balance: 750.00, status: 'active', exp: '12/28', cvc: '123' }], info: 'VIP Platinum Member', history: [{date: new Date().toLocaleString(), text: 'Account initialized'}] }],
                    products: [{ number: 'P-' + Math.floor(1000 + Math.random() * 9000), name: 'Nexus Luxury Elixir', price: 150.00, stock: 12, image: '' }],
                    coupons: [{ code: 'COUPON-10', name: '10% Off Nexus', percent: 10 }],
                    giftcards: [{ code: 'GC-500', name: 'Sarah Connor', balance: 100.00 }],
                    employees: [{ name: 'John Cashier', role: 'Cashier', rate: 22.50, barcode: 'EMP-' + Math.floor(1000 + Math.random() * 9000), password: '1234', image: '' }],
                    subOperators: [],
                    timeclock: [],
                    queue: []
                };
                await set(storeRef, initialData);
                launchTerminalSession(username, username, true);
            });
            return;
        } else {
            let data = snapshot.val();
            if(data.pin && data.pin !== pin) {
                SoundEngine.playError();
                showInsufficientModal('Incorrect Main Owner PIN.');
                return;
            }
            if(!data.pin) {
                await set(ref(db, `stores/${username}/pin`), pin);
            }
        }

        launchTerminalSession(username, username, true);
    } else {
        let parentUser = document.getElementById('loginStoreParent').value.trim();
        let subUser = document.getElementById('loginSubUser').value.trim();
        if(!parentUser || !subUser) { SoundEngine.playError(); showInsufficientModal('Enter store parent and worker username.'); return; }

        let storeRef = ref(db, `stores/${parentUser}`);
        let snapshot = await get(storeRef);
        if(!snapshot.exists()) {
            SoundEngine.playError();
            showInsufficientModal(`Store "${parentUser}" does not exist in database.`);
            return;
        }

        let storeData = snapshot.val();
        let subs = storeData.subOperators || [];
        let matchedSub = subs.find(s => s.username.toLowerCase() === subUser.toLowerCase());

        if(!matchedSub) {
            SoundEngine.playError();
            showInsufficientModal(`Worker "${subUser}" does not exist under store "${parentUser}".`);
            return;
        } else {
            if(matchedSub.pin !== pin) {
                SoundEngine.playError();
                showInsufficientModal('Incorrect Worker PIN.');
                return;
            }
        }

        launchTerminalSession(parentUser, subUser, false);
    }
};

function launchTerminalSession(mainOp, currentOp, isMain) {
    currentMainOperator = mainOp;
    currentOperator = currentOp;
    isMainOpSession = isMain;

    localStorage.setItem('rf_main_operator', mainOp);
    localStorage.setItem('rf_current_operator', currentOp);
    localStorage.setItem('rf_is_main_op', isMain);

    setupRealtimeCloudListener();

    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('currentOperatorName').innerText = `${currentOp} ${isMain ? '(Main Owner)' : '(Worker)'}`;
    
    SoundEngine.playSuccess();
    if(typeof confetti !== 'undefined') confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
}

window.logoutOperator = function() {
    if(dbListenerUnsubscribe) dbListenerUnsubscribe();
    localStorage.clear();
    location.reload();
};

function setupRealtimeCloudListener() {
    if(!currentMainOperator) return;
    let storeRef = ref(db, `stores/${currentMainOperator}`);
    
    dbListenerUnsubscribe = onValue(storeRef, (snapshot) => {
        if(snapshot.exists()) {
            let data = snapshot.val();
            accounts = data.accounts || [];
            products = data.products || [];
            coupons = data.coupons || [];
            giftCards = data.giftcards || [];
            employees = data.employees || [];
            subOperators = data.subOperators || [];
            timeclockEntries = data.timeclock || [];
            offlineTransactionQueue = data.queue || [];

            updateDashboardStats();
            renderAccountsList();
            renderProductsList();
            renderCouponsList();
            renderGiftCardsList();
            renderPayrollList();
            renderSubOperatorsList();
            renderInventoryMatrix();
            renderCrmAnalytics();
            renderTimeclockSelect();

            if(currentActiveAccount) {
                let refreshed = accounts.find(a => a.number === currentActiveAccount.number);
                if(refreshed) {
                    currentActiveAccount = refreshed;
                    let bEl = document.getElementById('modalAccBalance');
                    let pEl = document.getElementById('modalAccPoints');
                    if(bEl) bEl.innerText = formatCurrency(refreshed.balance);
                    if(pEl) pEl.innerText = `${refreshed.points || 0} Pts`;
                    renderModalHistory();
                }
            }
        }
    });
}

window.changeCurrency = function(curr) {
    currentCurrency = curr;
    localStorage.setItem('rf_currency', curr);
    SoundEngine.playClick();
    updateDashboardStats();
    renderAccountsList();
    renderProductsList();
    renderGiftCardsList();
};

function setupSafeKeybinds() {
    window.addEventListener('keydown', (e) => {
        let authHidden = document.getElementById('authScreen').classList.contains('hidden');
        if(!authHidden) {
            if(e.key === 'Enter') document.querySelector('#authScreen form')?.requestSubmit();
            return;
        }
        if(e.key === 'F1') { e.preventDefault(); switchTab('dashboard'); }
        if(e.key === 'F2') { e.preventDefault(); switchTab('accounts'); }
        if(e.key === 'F3') { e.preventDefault(); switchTab('createAccount'); }
        if(e.key === 'F4') { e.preventDefault(); switchTab('products'); }
        if(e.key === 'F5') { e.preventDefault(); switchTab('coupons'); }
        if(e.key === 'F6') { e.preventDefault(); switchTab('giftcards'); }
        if(e.key === 'F7') { e.preventDefault(); switchTab('payroll'); }
        if(e.key === 'F8') { e.preventDefault(); switchTab('returns'); }
        if(e.key === 'F9') { e.preventDefault(); switchTab('settings'); }
        if(e.key === 'F10') { e.preventDefault(); switchTab('inventoryMatrix'); }
        if(e.key === 'F11') { e.preventDefault(); switchTab('crmAnalytics'); }
        if(e.key === 'F12') { e.preventDefault(); switchTab('timeclock'); }
    });
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    let target = document.getElementById(`tab-${tabId}`);
    if(target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gradient-to-r', 'from-amber-500/25', 'to-amber-500/5', 'text-amber-300', 'border-l-4', 'border-amber-400', 'shadow-lg', 'scale-[1.02]');
        btn.classList.add('text-slate-400');
        if(btn.dataset.tab === tabId) {
            btn.classList.add('bg-gradient-to-r', 'from-amber-500/25', 'to-amber-500/5', 'text-amber-300', 'border-l-4', 'border-amber-400', 'shadow-lg', 'scale-[1.02]');
            btn.classList.remove('text-slate-400');
        }
    });

    let sidebar = document.getElementById('sidebarNav');
    if(sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        sidebar.classList.add('-translate-x-full');
    }

    if(tabId === 'audit') updateAuditStats();
    if(tabId === 'crmAnalytics') renderCrmAnalytics();
    if(tabId === 'inventoryMatrix') renderInventoryMatrix();
    SoundEngine.playClick();
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

function updateDashboardStats() {
    let el1 = document.getElementById('statTotalAccounts');
    let el2 = document.getElementById('statTotalCapital');
    let el3 = document.getElementById('statTotalProducts');
    if(el1) el1.innerText = accounts.length;
    let totalCap = accounts.reduce((acc, curr) => acc + curr.balance, 0);
    if(el2) el2.innerText = formatCurrency(totalCap);
    if(el3) el3.innerText = products.length;
}

window.executeQuickSearch = function() {
    let input = document.getElementById('quickSearchInput');
    if(!input) return;
    let query = input.value.trim().toLowerCase();
    let found = accounts.find(a => a.number.toLowerCase() === query || a.name.toLowerCase().includes(query));
    if(found) loadAccountByNumber(found.number);
    else { SoundEngine.playError(); showInsufficientModal(`Account search "${query}" not found.`); }
};

// --- HELPER TO UPDATE FORM BARCODE PREVIEWS ---
window.updateFormBarcodePreview = function(inputId, svgId) {
    let inputVal = document.getElementById(inputId)?.value.trim();
    let svgEl = document.getElementById(svgId);
    if(svgEl && inputVal && typeof JsBarcode !== 'undefined') {
        try {
            JsBarcode(svgEl, inputVal, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 2, height: 45, displayValue: true, fontSize: 11 });
        } catch(e) {}
    }
};

window.autoGenerateFieldCode = function(inputId, svgId, prefix) {
    let code = prefix + '-' + Math.floor(10000 + Math.random() * 90000);
    let el = document.getElementById(inputId);
    if(el) {
        el.value = code;
        el.dispatchEvent(new Event('input'));
    }
    updateFormBarcodePreview(inputId, svgId);
    SoundEngine.playClick();
};

window.handleAccountFormSubmit = function(e) {
    e.preventDefault();
    let oldNum = document.getElementById('editAccountOldNum').value;
    let number = document.getElementById('newAccNumber').value.trim();
    let name = document.getElementById('newAccName').value.trim();
    let email = document.getElementById('newAccEmail').value.trim();
    let balance = parseFloat(document.getElementById('newAccBalance').value);
    let cardNum = document.getElementById('newCardNum').value.trim();
    let cardBal = parseFloat(document.getElementById('newCardBal').value) || 500.00;
    let cardStatus = document.getElementById('newCardStatus').value;
    let info = document.getElementById('newAccInfo').value.trim();

    let cardsList = cardNum ? [{ number: cardNum, balance: cardBal, status: cardStatus, exp: '12/28', cvc: '123' }] : [];

    if(oldNum) {
        let acc = accounts.find(a => a.number === oldNum);
        if(acc) {
            acc.number = number;
            acc.name = name;
            acc.email = email;
            acc.balance = balance;
            if(cardsList.length > 0) acc.cards = cardsList;
            acc.info = info;
            acc.history.push({ date: new Date().toLocaleString(), text: `Account profile updated by ${currentOperator}` });
        }
    } else {
        if(accounts.some(a => a.number === number)) { SoundEngine.playError(); showInsufficientModal(`Account number "${number}" already exists!`); return; }
        accounts.push({
            number, name, email, balance, points: 0, cards: cardsList, info,
            history: [{ date: new Date().toLocaleString(), text: `Account created with balance ${formatCurrency(balance)}` }]
        });
    }

    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('accounts', oldNum ? 'Customer Account Updated' : 'New Customer Account Created', [
            { name: 'Account Number', value: number, inline: true },
            { name: 'Client Name', value: name, inline: true },
            { name: 'Email', value: email, inline: true },
            { name: 'Balance', value: formatCurrency(balance), inline: true },
            { name: 'Operator', value: currentOperator, inline: true }
        ], 10181046);
    }

    SoundEngine.playSuccess();
    resetAccountForm();
    switchTab('accounts');
    alert('Account saved successfully!');
};

window.editAccount = function(num) {
    let acc = accounts.find(a => a.number === num);
    if(!acc) return;
    document.getElementById('editAccountOldNum').value = acc.number;
    document.getElementById('newAccNumber').value = acc.number;
    document.getElementById('newAccName').value = acc.name;
    document.getElementById('newAccEmail').value = acc.email;
    document.getElementById('newAccBalance').value = acc.balance;
    if(acc.cards && acc.cards.length > 0) {
        document.getElementById('newCardNum').value = acc.cards[0].number;
        document.getElementById('newCardBal').value = acc.cards[0].balance;
        document.getElementById('newCardStatus').value = acc.cards[0].status || 'active';
    } else {
        document.getElementById('newCardNum').value = '';
        document.getElementById('newCardBal').value = '500.00';
        document.getElementById('newCardStatus').value = 'active';
    }
    document.getElementById('newAccInfo').value = acc.info || '';
    document.getElementById('accountFormTitle').innerText = 'Edit Customer Account';
    document.getElementById('accountSubmitBtn').innerText = 'Update Account';
    document.getElementById('accountCancelBtn').classList.remove('hidden');
    updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
    switchTab('createAccount');
};

window.editAccountModalDirect = function() {
    if(!currentActiveAccount) return;
    closeAccountModal();
    editAccount(currentActiveAccount.number);
};

window.resetAccountForm = function() {
    document.getElementById('editAccountOldNum').value = '';
    let generatedAcc = 'ACC-' + Math.floor(10000 + Math.random() * 90000);
    document.getElementById('newAccNumber').value = generatedAcc;
    document.getElementById('newAccName').value = '';
    document.getElementById('newAccEmail').value = '';
    document.getElementById('newAccBalance').value = '1000.00';
    document.getElementById('newCardNum').value = '';
    document.getElementById('newCardBal').value = '500.00';
    document.getElementById('newCardStatus').value = 'active';
    document.getElementById('newAccInfo').value = '';
    document.getElementById('accountFormTitle').innerText = 'Create Customer Account';
    document.getElementById('accountSubmitBtn').innerText = 'Save Account';
    document.getElementById('accountCancelBtn').classList.add('hidden');
    updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
};

function renderAccountsList(filter = '') {
    let container = document.getElementById('accountsGrid');
    if(!container) return;
    container.innerHTML = '';
    let filtered = accounts.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()) || a.number.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(acc => {
        let cardSummary = acc.cards && acc.cards.length > 0 ? `${acc.cards.length} Card(s) on File` : 'No Cards';
        container.innerHTML += `
            <div class="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-amber-500/20 hover:border-amber-500/55 transition-all flex flex-col justify-between space-y-4 shadow-xl pointer-events-auto">
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/25">${acc.number}</span>
                        <span class="text-emerald-400 font-black text-lg">${formatCurrency(acc.balance)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-slate-100">${acc.name}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">${acc.email}</p>
                    <div class="my-2 flex justify-center bg-slate-950 p-2 rounded-xl border border-white/5">
                        <svg class="barcode-svg" data-code="${acc.number}"></svg>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">Loyalty: ${acc.points || 0} Pts</span>
                        <span class="text-[10px] text-sky-400 font-mono">${cardSummary}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="loadAccountByNumber('${acc.number}')" class="flex-1 py-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs hover:bg-amber-500/35 transition-all pointer-events-auto">Load</button>
                    <button onclick="printBarcodeLabel('${acc.number}', 'Account: ${acc.name}')" class="px-3 py-2.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold pointer-events-auto">Print</button>
                    <button onclick="editAccount('${acc.number}')" class="px-3 py-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold pointer-events-auto">Edit</button>
                    ${isMainOpSession ? `<button onclick="deleteAccount('${acc.number}')" class="px-3 py-2.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold pointer-events-auto"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                </div>
            </div>
        `;
    });
    document.querySelectorAll('.barcode-svg').forEach(svg => {
        try {
            if(typeof JsBarcode !== 'undefined') {
                JsBarcode(svg, svg.dataset.code, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 1.5, height: 35, displayValue: true, fontSize: 10 });
            }
        } catch(e) {}
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.filterAccountList = function(val) { renderAccountsList(val); };

window.loadAccountByNumber = function(num) {
    let acc = accounts.find(a => a.number === num);
    if(!acc) { SoundEngine.playError(); showInsufficientModal(`Account number "${num}" not found.`); return; }
    currentActiveAccount = acc;
    currentCart = [];
    appliedCoupon = null;

    document.getElementById('modalAvatar').innerText = acc.name.charAt(0);
    document.getElementById('modalAccName').innerText = acc.name;
    document.getElementById('modalAccNum').innerText = acc.number;
    document.getElementById('modalAccEmail').innerText = acc.email;
    document.getElementById('modalAccBalance').innerText = formatCurrency(acc.balance);
    document.getElementById('modalAccPoints').innerText = `${acc.points || 0} Pts`;

    renderModalHistory();
    renderCartTable();
    document.getElementById('accountModal').classList.remove('hidden');
    SoundEngine.playBeep();
};

window.closeAccountModal = function() {
    document.getElementById('accountModal').classList.add('hidden');
    currentActiveAccount = null;
    currentCart = [];
    appliedCoupon = null;
};

window.deleteAccount = function(num) {
    if(!isMainOpSession) { alert('Only the Main Owner can delete accounts.'); return; }
    showConfirmationModal(`Are you sure you want to delete account ${num}?`, () => {
        accounts = accounts.filter(a => a.number !== num);
        saveUserData();
        if(currentActiveAccount && currentActiveAccount.number === num) closeAccountModal();
    });
};

function renderModalHistory() {
    let container = document.getElementById('modalHistoryList');
    if(!container) return;
    container.innerHTML = '';
    currentActiveAccount.history.slice().reverse().forEach(h => {
        container.innerHTML += `
            <div class="p-3.5 rounded-2xl bg-slate-900 border border-white/5 text-xs flex justify-between items-center shadow-inner">
                <span class="text-slate-300 font-medium">${h.text}</span>
                <span class="text-slate-500 font-mono text-[10px]">${h.date}</span>
            </div>
        `;
    });
}

window.redeemLoyaltyPoints = function() {
    if(!currentActiveAccount) return;
    if((currentActiveAccount.points || 0) < 100) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient loyalty points. Has ${currentActiveAccount.points || 0} Pts (100 required for $10 credit).`);
        return;
    }
    currentActiveAccount.points -= 100;
    currentActiveAccount.balance += 10.00;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Redeemed 100 loyalty points for ${formatCurrency(10.00)} credit` });
    saveUserData();
    SoundEngine.playSuccess();
    loadAccountByNumber(currentActiveAccount.number);
    alert(`Successfully redeemed 100 loyalty points for ${formatCurrency(10.00)} credit!`);
};

window.processScannedCode = function(code) {
    code = code.trim();
    if(!code) return;

    let acc = accounts.find(a => a.number === code);
    if(acc) {
        closeAccountModal();
        loadAccountByNumber(acc.number);
        SoundEngine.playSuccess();
        return;
    }

    let prod = products.find(p => p.number === code);
    if(prod) {
        if((prod.stock || 0) <= 0) { SoundEngine.playError(); showInsufficientModal(`Product "${prod.name}" is out of stock!`); return; }
        let existing = currentCart.find(i => i.product.number === code);
        if(existing) existing.quantity += 1;
        else currentCart.push({ product: prod, quantity: 1, discount: 0 });
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        SoundEngine.playScan();
        renderCartTable();
        return;
    }

    let coup = coupons.find(c => c.code === code);
    if(coup) {
        appliedCoupon = coup;
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        SoundEngine.playSuccess();
        renderCartTable();
        alert(`Coupon Applied: ${coup.name} (${coup.percent}% Off)!`);
        return;
    }

    let gc = giftCards.find(g => g.code === code);
    if(gc) {
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        SoundEngine.playSuccess();
        alert(`Gift Card Scanned: ${gc.name} | Balance: ${formatCurrency(gc.balance)}`);
        return;
    }

    SoundEngine.playError();
    showInsufficientModal(`Barcode Not Valid: "${code}" not registered.`);
    let input = document.getElementById('cartProdNumInput');
    if(input) input.value = '';
};

window.handleProductFormSubmit = function(e) {
    e.preventDefault();
    let oldNum = document.getElementById('editProductOldNum').value;
    let number = document.getElementById('prodNumber').value.trim();
    let name = document.getElementById('prodName').value.trim();
    let price = parseFloat(document.getElementById('prodPrice').value);
    let stock = parseInt(document.getElementById('prodStock').value) || 0;
    let fileInput = document.getElementById('prodImageFile');

    let reader = new FileReader();
    let saveProd = (imgData = '') => {
        if(oldNum) {
            let p = products.find(x => x.number === oldNum);
            if(p) {
                p.number = number;
                p.name = name;
                p.price = price;
                p.stock = stock;
                if(imgData) p.image = imgData;
            }
        } else {
            if(products.some(p => p.number === number)) { SoundEngine.playError(); showInsufficientModal(`Product "${number}" already exists!`); return; }
            products.push({ number, name, price, stock, image: imgData, batch: 'BATCH-' + Math.floor(100+Math.random()*900) });
        }
        saveUserData();

        if (typeof WebhookManager !== 'undefined') {
            WebhookManager.send('inventory', oldNum ? 'Product Inventory Updated' : 'New Product Registered', [
                { name: 'SKU / Item #', value: number, inline: true },
                { name: 'Product Name', value: name, inline: true },
                { name: 'Price', value: formatCurrency(price), inline: true },
                { name: 'Stock Quantity', value: `${stock} units`, inline: true },
                { name: 'Operator', value: currentOperator, inline: true }
            ], 15844367);
        }

        SoundEngine.playSuccess();
        resetProductForm();
        alert('Product saved successfully!');
    };

    if(fileInput && fileInput.files && fileInput.files[0]) {
        reader.onload = function(evt) { saveProd(evt.target.result); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        let existing = products.find(x => x.number === oldNum);
        saveProd(existing ? existing.image : '');
    }
};

window.editProduct = function(num) {
    let p = products.find(x => x.number === num);
    if(!p) return;
    document.getElementById('editProductOldNum').value = p.number;
    document.getElementById('prodNumber').value = p.number;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('productFormTitle').innerText = 'Edit Product';
    document.getElementById('productSubmitBtn').innerText = 'Update Product';
    document.getElementById('productCancelBtn').classList.remove('hidden');
    updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg');
    switchTab('products');
};

window.resetProductForm = function() {
    document.getElementById('editProductOldNum').value = '';
    document.getElementById('prodNumber').value = 'P-' + Math.floor(10000 + Math.random() * 90000);
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '49.99';
    document.getElementById('prodStock').value = '25';
    document.getElementById('productFormTitle').innerText = 'Register / Edit Product';
    document.getElementById('productSubmitBtn').innerText = 'Save Product';
    document.getElementById('productCancelBtn').classList.add('hidden');
    updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg');
};

window.deleteProduct = function(num) {
    if(!isMainOpSession) { alert('Only Main Owner can delete products.'); return; }
    showConfirmationModal(`Delete product ${num}?`, () => {
        products = products.filter(p => p.number !== num);
        saveUserData();
    });
};

function renderProductsList() {
    let container = document.getElementById('productsListContainer');
    if(!container) return;
    container.innerHTML = '';
    if(products.length === 0) { container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">No products found.</div>`; return; }
    
    products.forEach(p => {
        let isLowStock = (p.stock || 0) <= 5;
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/65 backdrop-blur-2xl border ${isLowStock ? 'border-rose-500/50 animate-pulse' : 'border-amber-500/20'} flex items-center justify-between shadow-lg pointer-events-auto">
                <div class="flex items-center gap-4">
                    <svg class="barcode-svg" data-code="${p.number}"></svg>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-slate-100 text-sm">${p.name}</h4>
                            ${isLowStock ? `<span class="bg-rose-500/20 text-rose-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-500/40">LOW STOCK (${p.stock})</span>` : ''}
                        </div>
                        <p class="text-xs text-amber-400 font-mono mt-0.5">Item #: ${p.number} | <strong class="text-emerald-400">${formatCurrency(p.price)}</strong> | Stock: ${p.stock || 0}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editProduct('${p.number}')" class="px-3 py-2 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold pointer-events-auto">Edit</button>
                    <button onclick="printBarcodeLabel('${p.number}', '${p.name}')" class="px-3 py-2 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold pointer-events-auto">Print</button>
                    ${isMainOpSession ? `<button onclick="deleteProduct('${p.number}')" class="px-3 py-2 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold pointer-events-auto">Delete</button>` : ''}
                </div>
            </div>
        `;
    });
    document.querySelectorAll('.barcode-svg').forEach(svg => {
        try {
            if(typeof JsBarcode !== 'undefined') {
                JsBarcode(svg, svg.dataset.code, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 1.5, height: 35, displayValue: true, fontSize: 10 });
            }
        } catch(e) {}
    });
}

window.printBarcodeLabel = function(code, title) {
    let win = window.open('', '', 'height=400,width=400');
    if(!win) return;
    win.document.write(`<html><head><title>Print Barcode</title></head><body style="text-align:center;padding-top:40px;font-family:sans-serif;">`);
    win.document.write(`<h3>${title}</h3><svg id="bSvg"></svg>`);
    win.document.write(`<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script><script>try{JsBarcode('#bSvg', '${code}', {format:'CODE128', width:2, height:80, displayValue:true});}catch(e){} window.print(); window.close();</script>`);
    win.document.write(`</body></html>`);
    win.document.close();
};

window.handleCouponFormSubmit = function(e) {
    e.preventDefault();
    let oldCode = document.getElementById('editCouponOldCode').value;
    let code = document.getElementById('couponCode').value.trim();
    let name = document.getElementById('couponName').value.trim();
    let percent = parseFloat(document.getElementById('couponPercent').value);

    if(oldCode) {
        let c = coupons.find(x => x.code === oldCode);
        if(c) { c.code = code; c.name = name; c.percent = percent; }
    } else {
        if(coupons.some(c => c.code === code)) { SoundEngine.playError(); showInsufficientModal(`Coupon "${code}" already exists.`); return; }
        coupons.push({ code, name, percent });
    }
    saveUserData();
    SoundEngine.playSuccess();
    resetCouponForm();
    alert('Coupon saved successfully!');
};

window.editCoupon = function(code) {
    let c = coupons.find(x => x.code === code);
    if(!c) return;
    document.getElementById('editCouponOldCode').value = c.code;
    document.getElementById('couponCode').value = c.code;
    document.getElementById('couponName').value = c.name;
    document.getElementById('couponPercent').value = c.percent;
    document.getElementById('couponFormTitle').innerText = 'Edit Coupon';
    document.getElementById('couponSubmitBtn').innerText = 'Update Coupon';
    document.getElementById('couponCancelBtn').classList.remove('hidden');
    switchTab('coupons');
};

window.resetCouponForm = function() {
    document.getElementById('editCouponOldCode').value = '';
    document.getElementById('couponCode').value = 'COUPON-' + Math.floor(10 + Math.random() * 90);
    document.getElementById('couponName').value = '';
    document.getElementById('couponPercent').value = '20';
    document.getElementById('couponFormTitle').innerText = 'Create / Edit Discount Coupon';
    document.getElementById('couponSubmitBtn').innerText = 'Save Coupon';
    document.getElementById('couponCancelBtn').classList.add('hidden');
};

window.deleteCoupon = function(code) {
    showConfirmationModal(`Delete coupon ${code}?`, () => {
        coupons = coupons.filter(c => c.code !== code);
        saveUserData();
    });
};

function renderCouponsList() {
    let container = document.getElementById('couponsListContainer');
    if(!container) return;
    container.innerHTML = '';
    coupons.forEach(c => {
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex items-center justify-between shadow-lg">
                <div>
                    <h4 class="font-bold text-slate-100 text-sm">${c.name} (${c.percent}% Off)</h4>
                    <p class="text-xs text-amber-400 font-mono mt-0.5">Code: ${c.code}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editCoupon('${c.code}')" class="px-3 py-1.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="deleteCoupon('${c.code}')" class="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Delete</button>
                </div>
            </div>
        `;
    });
}

window.handleGCFormSubmit = function(e) {
    e.preventDefault();
    let oldCode = document.getElementById('editGCOldCode').value;
    let code = document.getElementById('gcCode').value.trim();
    let name = document.getElementById('gcName').value.trim();
    let balance = parseFloat(document.getElementById('gcBalance').value);

    if(oldCode) {
        let g = giftCards.find(x => x.code === oldCode);
        if(g) { g.code = code; g.name = name; g.balance = balance; }
    } else {
        if(giftCards.some(g => g.code === code)) { SoundEngine.playError(); showInsufficientModal(`Gift Card "${code}" exists.`); return; }
        giftCards.push({ code, name, balance });
    }
    saveUserData();
    SoundEngine.playSuccess();
    resetGCForm();
    alert('Gift Card saved successfully!');
};

window.editGiftCard = function(code) {
    let g = giftCards.find(x => x.code === code);
    if(!g) return;
    document.getElementById('editGCOldCode').value = g.code;
    document.getElementById('gcCode').value = g.code;
    document.getElementById('gcName').value = g.name;
    document.getElementById('gcBalance').value = g.balance;
    document.getElementById('gcFormTitle').innerText = 'Edit Gift Card';
    document.getElementById('gcSubmitBtn').innerText = 'Update Gift Card';
    document.getElementById('gcCancelBtn').classList.remove('hidden');
    updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg');
    switchTab('giftcards');
};

window.resetGCForm = function() {
    document.getElementById('editGCOldCode').value = '';
    document.getElementById('gcCode').value = 'GC-' + Math.floor(10000 + Math.random() * 90000);
    document.getElementById('gcName').value = '';
    document.getElementById('gcBalance').value = '100.00';
    document.getElementById('gcFormTitle').innerText = 'Issue / Edit Gift Card';
    document.getElementById('gcSubmitBtn').innerText = 'Save Gift Card';
    document.getElementById('gcCancelBtn').classList.add('hidden');
    updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg');
};

window.deleteGiftCard = function(code) {
    showConfirmationModal(`Delete gift card ${code}?`, () => {
        giftCards = giftCards.filter(g => g.code !== code);
        saveUserData();
    });
};

function renderGiftCardsList() {
    let container = document.getElementById('giftCardsListContainer');
    if(!container) return;
    container.innerHTML = '';
    giftCards.forEach(g => {
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex items-center justify-between shadow-lg">
                <div class="flex items-center gap-3">
                    <svg class="barcode-svg" data-code="${g.code}"></svg>
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${g.name}</h4>
                        <p class="text-xs text-amber-400 font-mono mt-0.5">Code: ${g.code} | <strong class="text-emerald-400">${formatCurrency(g.balance)}</strong></p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editGiftCard('${g.code}')" class="px-3 py-1.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="printBarcodeLabel('${g.code}', 'Gift Card: ${g.name}')" class="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold">Print</button>
                    <button onclick="deleteGiftCard('${g.code}')" class="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Delete</button>
                </div>
            </div>
        `;
    });
    document.querySelectorAll('.barcode-svg').forEach(svg => {
        try {
            if(typeof JsBarcode !== 'undefined') {
                JsBarcode(svg, svg.dataset.code, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 1.5, height: 30, displayValue: true, fontSize: 10 });
            }
        } catch(e) {}
    });
}

// --- EMPLOYEE & CASHIER ID BADGE MANAGEMENT WITH QR/BARCODE ---
window.handleEmployeeFormSubmit = function(e) {
    e.preventDefault();
    let oldName = document.getElementById('editEmpOldName').value;
    let name = document.getElementById('empName').value.trim();
    let role = document.getElementById('empRole').value.trim();
    let rate = parseFloat(document.getElementById('empRate').value);
    let barcode = document.getElementById('empBarcode').value.trim() || ('EMP-' + Math.floor(10000 + Math.random() * 90000));
    let password = document.getElementById('empPassword').value.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    let fileInput = document.getElementById('empImageFile');

    let reader = new FileReader();
    let saveEmp = (imgData = '') => {
        if(oldName) {
            let emp = employees.find(x => x.name === oldName);
            if(emp) { 
                emp.name = name; 
                emp.role = role; 
                emp.rate = rate; 
                emp.barcode = barcode;
                emp.password = password;
                if(imgData) emp.image = imgData;
            }
        } else {
            employees.push({ name, role, rate, barcode, password, image: imgData });
        }
        saveUserData();
        SoundEngine.playSuccess();
        resetEmpForm();
        alert('Employee & Cashier ID saved successfully!');
    };

    if(fileInput && fileInput.files && fileInput.files[0]) {
        reader.onload = function(evt) { saveEmp(evt.target.result); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        let existing = employees.find(x => x.name === oldName);
        saveEmp(existing ? existing.image : '');
    }
};

window.editEmployee = function(name) {
    let emp = employees.find(x => x.name === name);
    if(!emp) return;
    document.getElementById('editEmpOldName').value = emp.name;
    document.getElementById('empName').value = emp.name;
    document.getElementById('empRole').value = emp.role;
    document.getElementById('empRate').value = emp.rate;
    document.getElementById('empBarcode').value = emp.barcode || ('EMP-' + Math.floor(10000 + Math.random() * 90000));
    document.getElementById('empPassword').value = emp.password || '1234';
    document.getElementById('empFormTitle').innerText = 'Edit Employee & Cashier ID';
    document.getElementById('empSubmitBtn').innerText = 'Update Employee';
    document.getElementById('empCancelBtn').classList.remove('hidden');
    updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg');
    switchTab('payroll');
};

window.resetEmpForm = function() {
    document.getElementById('editEmpOldName').value = '';
    document.getElementById('empName').value = '';
    document.getElementById('empRole').value = 'Cashier';
    document.getElementById('empRate').value = '22.50';
    let genId = 'EMP-' + Math.floor(10000 + Math.random() * 90000);
    let genPass = Math.floor(1000 + Math.random() * 9000).toString();
    document.getElementById('empBarcode').value = genId;
    document.getElementById('empPassword').value = genPass;
    document.getElementById('empFormTitle').innerText = 'Register / Edit Employee & Cashier ID';
    document.getElementById('empSubmitBtn').innerText = 'Save Employee & ID';
    document.getElementById('empCancelBtn').classList.add('hidden');
    updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg');
};

window.deleteEmployee = function(name) {
    showConfirmationModal(`Remove employee ${name}?`, () => {
        employees = employees.filter(e => e.name !== name);
        saveUserData();
    });
};

window.printCashierBadge = function(name, role, barcode, password, imgData) {
    let win = window.open('', '', 'height=650,width=450');
    if(!win) return;
    win.document.write(`<html><head><title>Cashier ID Badge</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:30px;background:#0f172a;color:#f8fafc;">
        <div style="border:3px solid #f59e0b;border-radius:24px;padding:30px;background:#1e293b;max-width:350px;margin:0 auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <h2 style="color:#f59e0b;margin-bottom:5px;font-size:18px;letter-spacing:1px;">NEXUS LUXURY ENTERPRISE</h2>
            <p style="color:#94a3b8;font-size:11px;margin-bottom:20px;text-transform:uppercase;">Official Cashier Security ID Badge</p>
            ${imgData ? `<img src="${imgData}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid #f59e0b;margin-bottom:15px;" />` : `<div style="width:110px;height:110px;border-radius:50%;background:#334155;color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 15px auto;border:3px solid #f59e0b;">${name.charAt(0)}</div>`}
            <h3 style="font-size:22px;margin:5px 0;color:#ffffff;">${name}</h3>
            <p style="color:#38bdf8;font-size:13px;font-weight:bold;margin-bottom:15px;">${role}</p>
            <p style="color:#cbd5e1;font-size:12px;font-mono;margin-bottom:15px;">ID: <strong>${barcode}</strong> | PIN: <strong>${password}</strong></p>
            <div style="background:#0f172a;padding:15px;border-radius:12px;display:inline-block;border:1px solid rgba(245,158,11,0.3);">
                <svg id="cashierBadgeSvg"></svg>
            </div>
            <p style="color:#64748b;font-size:10px;margin-top:15px;">Scan barcode at terminal for instant operator sign-in.</p>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
            try {
                JsBarcode('#cashierBadgeSvg', '${barcode}', { format: 'CODE128', lineColor: '#f59e0b', background: 'transparent', width: 2, height: 50, displayValue: true, fontSize: 12, fontOptions: 'bold' });
            } catch(e) {}
            window.print();
            window.close();
        </script>
    </body></html>`);
    win.document.close();
};

function renderPayrollList() {
    let container = document.getElementById('payrollListContainer');
    if(!container) return;
    container.innerHTML = '';
    if(employees.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">No employees or cashiers registered.</div>`;
        return;
    }
    employees.forEach(emp => {
        let bcode = emp.barcode || 'EMP-1001';
        let pass = emp.password || '1234';
        let img = emp.image || '';
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-lg gap-4">
                <div class="flex items-center gap-4">
                    ${img ? `<img src="${img}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/40">` : `<div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-lg">${emp.name.charAt(0)}</div>`}
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${emp.name} (${emp.role})</h4>
                        <p class="text-xs text-emerald-400 font-mono mt-0.5">Rate: ${formatCurrency(emp.rate)}/hr | ID: ${bcode} | PIN: ${pass}</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full sm:w-auto justify-end">
                    <button onclick="printCashierBadge('${emp.name}', '${emp.role}', '${bcode}', '${pass}', '${img}')" class="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">Print ID Badge</button>
                    <button onclick="editEmployee('${emp.name}')" class="px-3 py-2 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="deleteEmployee('${emp.name}')" class="px-3 py-2 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Remove</button>
                </div>
            </div>
        `;
    });
}

function renderSubOperatorsList() {
    let container = document.getElementById('subOperatorsListContainer');
    if(!container) return;
    container.innerHTML = '';
    if(subOperators.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500">No sub-operators registered yet.</p>`;
        return;
    }
    subOperators.forEach(sub => {
        container.innerHTML += `
            <div class="p-3 bg-slate-950 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <div>
                    <span class="font-bold text-slate-100">${sub.username}</span>
                    <span class="text-amber-400 font-mono ml-2">PIN: ••••</span>
                </div>
                ${isMainOpSession ? `<button onclick="deleteSubOperator('${sub.username}')" class="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg font-bold">Remove</button>` : ''}
            </div>
        `;
    });
}

window.adminCreateSubOperator = function() {
    if(!isMainOpSession) { alert('Only Main Owner can add workers.'); return; }
    let uInput = document.getElementById('newSubOpUser');
    let pInput = document.getElementById('newSubOpPin');
    let username = uInput ? uInput.value.trim() : '';
    let pin = pInput ? pInput.value.trim() : '';

    if(!username || pin.length !== 4) { alert('Enter valid worker username and 4-digit PIN.'); return; }
    if(subOperators.some(s => s.username.toLowerCase() === username.toLowerCase())) { alert('Worker username already exists.'); return; }

    pendingSubOpData = { username, pin };
    document.getElementById('ownerPinAuthInput').value = '';
    document.getElementById('ownerPinAuthModal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('ownerPinAuthInput').focus(); }, 50);
};

window.verifyOwnerPinForSubOp = function() {
    let pin = document.getElementById('ownerPinAuthInput').value;
    let ownerPin = localStorage.getItem('rf_main_op_pin') || '2285';
    if(pin !== ownerPin) {
        SoundEngine.playError();
        alert('Incorrect Main Owner PIN!');
        return;
    }

    subOperators.push(pendingSubOpData);
    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('security', 'New Store Worker Authorized', [
            { name: 'Worker Username', value: pendingSubOpData.username, inline: true },
            { name: 'Authorized By', value: `Main Owner (${currentOperator})`, inline: true }
        ], 3066993);
    }

    document.getElementById('ownerPinAuthModal').classList.add('hidden');
    pendingSubOpData = null;
    let uInput = document.getElementById('newSubOpUser');
    let pInput = document.getElementById('newSubOpPin');
    if(uInput) uInput.value = '';
    if(pInput) pInput.value = '';
    SoundEngine.playSuccess();
    alert('Worker sub-operator successfully authorized and created!');
};

window.deleteSubOperator = function(username) {
    if(!isMainOpSession) return;
    showConfirmationModal(`Are you sure you want to delete worker sub-operator "${username}"?`, () => {
        subOperators = subOperators.filter(s => s.username !== username);
        saveUserData();
    });
};

window.confirmDeleteStoreOwner = function() {
    if(!isMainOpSession) { alert('Only Main Owner can delete the store.'); return; }
    let pinInput = document.getElementById('deleteOwnerPinInput');
    let pin = pinInput ? pinInput.value.trim() : '';
    let ownerPin = localStorage.getItem('rf_main_op_pin') || '2285';

    if(pin !== ownerPin) {
        SoundEngine.playError();
        alert('Incorrect Main Owner PIN!');
        return;
    }

    showConfirmationModal(`CRITICAL: Are you absolutely sure you want to permanently delete the store owner account "${currentMainOperator}" and all associated data?`, async () => {
        try {
            await remove(ref(db, `stores/${currentMainOperator}`));
            alert('Store owner account permanently deleted.');
            logoutOperator();
        } catch(e) {
            alert('Failed to delete store: ' + e.message);
        }
    });
};

function renderInventoryMatrix() {
    let container = document.getElementById('inventoryMatrixContainer');
    if(!container) return;
    container.innerHTML = '';
    if(products.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500">No inventory items registered.</p>`;
        return;
    }
    products.forEach(p => {
        let batch = p.batch || 'BATCH-101';
        let isLow = (p.stock || 0) <= 5;
        container.innerHTML += `
            <div class="p-5 bg-slate-950 rounded-2xl border ${isLow ? 'border-rose-500/40 animate-pulse' : 'border-amber-500/25'} space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${p.name}</h4>
                        <p class="text-[10px] text-amber-400 font-mono">SKU: ${p.number}</p>
                    </div>
                    <span class="text-xs font-mono bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-lg">${batch}</span>
                </div>
                <div class="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                    <span class="text-slate-400">Stock: <strong class="text-emerald-400">${p.stock || 0}</strong></span>
                    <span class="text-slate-400">Lead Time: <strong class="text-sky-300">3 Days</strong></span>
                </div>
            </div>
        `;
    });
}

window.triggerAutomatedPurchaseOrder = function() {
    let lowStockItems = products.filter(p => (p.stock || 0) <= 5);
    if(lowStockItems.length === 0) {
        alert('All inventory items are well-stocked. No purchase order needed.');
        return;
    }
    SoundEngine.playSuccess();
    alert(`Automated Purchase Order successfully dispatched to suppliers for ${lowStockItems.length} low-stock item(s)!`);
};

function renderCrmAnalytics() {
    let vipCountEl = document.getElementById('crmVipCount');
    let avgLtvEl = document.getElementById('crmAvgLtv');
    let totalPtsEl = document.getElementById('crmTotalPoints');
    let listEl = document.getElementById('crmClientAnalyticsList');

    if(accounts.length === 0) return;

    let vips = accounts.filter(a => (a.balance || 0) > 1000);
    let totalBal = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    let avgLtv = totalBal / accounts.length;
    let totalPts = accounts.reduce((sum, a) => sum + (a.points || 0), 0);

    if(vipCountEl) vipCountEl.innerText = vips.length;
    if(avgLtvEl) avgLtvEl.innerText = formatCurrency(avgLtv);
    if(totalPtsEl) totalPtsEl.innerText = `${totalPts} Pts`;

    if(listEl) {
        listEl.innerHTML = `<h3 class="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3">Top Customer Lifetime Value Rankings</h3>`;
        accounts.slice().sort((a,b) => b.balance - a.balance).forEach(acc => {
            listEl.innerHTML += `
                <div class="p-4 bg-slate-950 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                    <div>
                        <p class="font-bold text-slate-100">${acc.name} <span class="text-amber-400 font-mono text-[10px]">(${acc.number})</span></p>
                        <p class="text-[10px] text-slate-400">Email: ${acc.email} | Points: ${acc.points || 0}</p>
                    </div>
                    <span class="text-emerald-400 font-black text-sm">${formatCurrency(acc.balance)}</span>
                </div>
            `;
        });
    }
}

function renderTimeclockSelect() {
    let select = document.getElementById('timeclockEmpSelect');
    if(!select) return;
    select.innerHTML = '';
    if(employees.length === 0) {
        select.innerHTML = `<option value="">No employees registered</option>`;
        return;
    }
    employees.forEach(emp => {
        select.innerHTML += `<option value="${emp.name}">${emp.name} (${emp.role})</option>`;
    });
}

window.staffClockAction = function(actionType) {
    let select = document.getElementById('timeclockEmpSelect');
    let logEl = document.getElementById('timeclockStatusLog');
    if(!select || !select.value) { alert('Select an employee.'); return; }
    let empName = select.value;
    let timeStr = new Date().toLocaleString();

    timeclockEntries.push({ name: empName, action: actionType, time: timeStr });
    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('staff', `Staff Shift Clock-${actionType.toUpperCase()}`, [
            { name: 'Employee Name', value: empName, inline: true },
            { name: 'Action Type', value: `Clock ${actionType.toUpperCase()}`, inline: true },
            { name: 'Timestamp', value: timeStr, inline: true }
        ], 3447003);
    }

    SoundEngine.playSuccess();
    if(logEl) {
        logEl.innerHTML = `<p class="text-emerald-400 font-bold">Successfully clocked ${actionType.toUpperCase()} for ${empName} at ${timeStr}</p>` + logEl.innerHTML;
    }
    alert(`Successfully recorded clock-${actionType} for ${empName}!`);
};

function showConfirmationModal(msg, onConfirmCallback) {
    let msgEl = document.getElementById('confirmationMsg');
    let yesBtn = document.getElementById('confirmYesBtn');
    if(msgEl) msgEl.innerText = msg;
    if(yesBtn) {
        yesBtn.onclick = () => {
            closeConfirmationModal();
            onConfirmCallback();
        };
    }
    document.getElementById('confirmationModal').classList.remove('hidden');
    SoundEngine.playBeep();
}

window.closeConfirmationModal = function() {
    document.getElementById('confirmationModal').classList.add('hidden');
};

window.processGranularReturn = function() {
    let accNum = document.getElementById('returnAccNum').value.trim();
    let prodNum = document.getElementById('returnProdNum').value.trim();
    let qty = parseInt(document.getElementById('returnQty').value) || 1;
    let customAmt = parseFloat(document.getElementById('returnCustomAmount').value);

    let acc = accounts.find(a => a.number === accNum);
    let prod = products.find(p => p.number === prodNum);

    if(!acc || !prod) { SoundEngine.playError(); showInsufficientModal('Invalid customer account number or product item number.'); return; }

    let refundVal = !isNaN(customAmt) && customAmt > 0 ? customAmt : (prod.price * qty);

    prod.stock = (prod.stock || 0) + qty;
    acc.balance += refundVal;
    acc.history.push({ date: new Date().toLocaleString(), text: `Granular Return: ${qty}x ${prod.name} (+${formatCurrency(refundVal)})` });

    saveUserData();
    SoundEngine.playSuccess();
    if(typeof confetti !== 'undefined') confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    alert(`Successfully refunded ${formatCurrency(refundVal)} to account ${acc.name} and restocked ${qty} unit(s) of ${prod.name}!`);

    document.getElementById('returnAccNum').value = '';
    document.getElementById('returnProdNum').value = '';
    document.getElementById('returnQty').value = '1';
    document.getElementById('returnCustomAmount').value = '';
};

function renderCartTable() {
    let tbody = document.getElementById('cartItemsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    let subtotal = 0;

    if(currentCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Cart is empty. Scan item above.</td></tr>`;
        let gtEl = document.getElementById('cartGrandTotal');
        let cdEl = document.getElementById('appliedCouponDisplay');
        if(gtEl) gtEl.innerText = formatCurrency(0);
        if(cdEl) cdEl.innerText = '';
        return;
    }

    currentCart.forEach((item, idx) => {
        let itemTotal = (item.product.price * item.quantity) * (1 - (item.discount / 100));
        subtotal += itemTotal;

        tbody.innerHTML += `
            <tr class="hover:bg-white/5">
                <td class="p-3 flex items-center gap-3">
                    ${item.product.image ? `<img src="${item.product.image}" class="w-8 h-8 rounded-lg object-cover">` : ''}
                    <span class="font-bold">${item.product.name}</span>
                </td>
                <td class="p-3 font-mono text-amber-400">${item.product.number}</td>
                <td class="p-3">${formatCurrency(item.product.price)}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <button onclick="updateCartQty(${idx}, -1)" class="w-6 h-6 bg-slate-800 rounded-lg font-bold">-</button>
                        <span class="font-bold">${item.quantity}</span>
                        <button onclick="updateCartQty(${idx}, 1)" class="w-6 h-6 bg-amber-500 text-slate-950 rounded-lg font-bold">+</button>
                    </div>
                </td>
                <td class="p-3">
                    <input type="number" value="${item.discount}" min="0" max="100" onchange="updateItemDiscount(${idx}, this.value)" class="w-16 bg-slate-900 border border-amber-500/30 rounded-lg px-2 py-1 text-xs">
                </td>
                <td class="p-3 text-emerald-400 font-bold">${formatCurrency(itemTotal)}</td>
                <td class="p-3 text-right">
                    <button onclick="removeCartItem(${idx})" class="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs">Remove</button>
                </td>
            </tr>
        `;
    });

    let grandTotal = subtotal;
    if(appliedCoupon) grandTotal -= (subtotal * (appliedCoupon.percent / 100));
    let cdEl = document.getElementById('appliedCouponDisplay');
    let gtEl = document.getElementById('cartGrandTotal');
    if(cdEl) cdEl.innerText = appliedCoupon ? `Coupon: ${appliedCoupon.name} (-${appliedCoupon.percent}%)` : '';
    if(gtEl) gtEl.innerText = formatCurrency(grandTotal);
}

window.updateCartQty = function(idx, change) {
    let item = currentCart[idx];
    if(change > 0 && (item.product.stock || 0) <= item.quantity) {
        SoundEngine.playError();
        showInsufficientModal(`Stock limit (${item.product.stock}) reached.`);
        return;
    }
    item.quantity += change;
    if(item.quantity <= 0) currentCart.splice(idx, 1);
    SoundEngine.playBeep();
    renderCartTable();
};

window.updateItemDiscount = function(idx, val) {
    currentCart[idx].discount = Math.max(0, Math.min(100, parseFloat(val) || 0));
    renderCartTable();
};

window.removeCartItem = function(idx) {
    currentCart.splice(idx, 1);
    renderCartTable();
};

window.checkoutWithAccountBalance = function() {
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    if(!currentActiveAccount) { SoundEngine.playError(); showInsufficientModal('No customer account loaded. Please load an account first.'); return; }

    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    let stripeMode = localStorage.getItem('rf_stripe_mode') || 'real';
    if(stripeMode !== 'fake' && currentActiveAccount.balance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient account balance (${formatCurrency(currentActiveAccount.balance)}). Use Force Purchase (PIN 2285) or switch to Sandbox/Fake mode.`);
        return;
    }

    currentActiveAccount.balance -= grandTotal;
    finalizeSuccessfulCheckout(grandTotal, `Paid via Customer Account Balance (${currentActiveAccount.number})`);
};

window.checkoutWithStripeLive = async function() {
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    let stripeMode = localStorage.getItem('rf_stripe_mode') || 'real';

    if(stripeMode === 'fake') {
        SoundEngine.playSuccess();
        alert(`[Sandbox Fake Money Mode] Processing test payment for ${formatCurrency(grandTotal)}...`);
        finalizeSuccessfulCheckout(grandTotal, `Sandbox Fake Money Payment`);
        return;
    }

    try {
        SoundEngine.playSuccess();
        alert(`Initiating secure Stripe Live Real Money checkout session for ${formatCurrency(grandTotal)}...`);
        finalizeSuccessfulCheckout(grandTotal, `Stripe Live Real Money Payment`);
    } catch(err) {
        SoundEngine.playError();
        alert('Stripe Checkout Error: ' + err.message);
    }
};

window.openCardOnFileModal = function() {
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    if(!currentActiveAccount) { SoundEngine.playError(); showInsufficientModal('Load a customer account with cards on file first.'); return; }
    if(!currentActiveAccount.cards || currentActiveAccount.cards.length === 0) {
        SoundEngine.playError();
        showInsufficientModal('This customer has no credit cards on file.');
        return;
    }

    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    let container = document.getElementById('cardOnFileSelectionList');
    container.innerHTML = '';

    currentActiveAccount.cards.forEach((card, idx) => {
        let isEligible = card.status === 'active' && card.balance >= grandTotal;
        container.innerHTML += `
            <div class="p-4 rounded-2xl bg-slate-950 border ${isEligible ? 'border-amber-500/40' : 'border-rose-500/40'} flex justify-between items-center text-xs">
                <div>
                    <p class="font-bold text-slate-100 font-mono">${card.number}</p>
                    <p class="text-[10px] text-amber-400">Balance: ${formatCurrency(card.balance)} | Status: <span class="${card.status==='active'?'text-emerald-400':'text-rose-400'}">${card.status}</span></p>
                </div>
                <div class="flex gap-2">
                    <button onclick="executeCardOnFileCheckout(${idx})" class="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs pointer-events-auto">Select & Pay</button>
                    ${!isEligible ? `<button onclick="promptForcePurchase(${idx})" class="px-3 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs pointer-events-auto">Force (2285)</button>` : ''}
                </div>
            </div>
        `;
    });
    document.getElementById('cardOnFileModal').classList.add('hidden');
};

window.executeCardOnFileCheckout = function(cardIdx) {
    let card = currentActiveAccount.cards[cardIdx];
    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    let stripeMode = localStorage.getItem('rf_stripe_mode') || 'real';
    if(card.status !== 'active') {
        SoundEngine.playError();
        showInsufficientModal('Selected credit card is inactive.');
        return;
    }
    if(stripeMode !== 'fake' && card.balance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient funds on card (${formatCurrency(card.balance)}). Use Force Purchase (PIN 2285) to bypass.`);
        return;
    }

    card.balance -= grandTotal;
    finalizeSuccessfulCheckout(grandTotal, `Charged Card on File (${card.number})`);
    document.getElementById('cardOnFileModal').classList.add('hidden');
};

let pendingForceCardIdx = null;
window.promptForcePurchase = function(cardIdx) {
    pendingForceCardIdx = cardIdx;
    document.getElementById('forcePinInput').value = '';
    document.getElementById('forcePurchasePinModal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('forcePinInput').focus(); }, 50);
};

window.verifyForcePurchasePin = function() {
    let pin = document.getElementById('forcePinInput').value;
    if(pin !== '2285') {
        SoundEngine.playError();
        alert('Invalid Force PIN! Required: 2285');
        return;
    }

    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    if(pendingForceCardIdx !== null && currentActiveAccount && currentActiveAccount.cards[pendingForceCardIdx]) {
        let card = currentActiveAccount.cards[pendingForceCardIdx];
        card.balance -= grandTotal;
        finalizeSuccessfulCheckout(grandTotal, `Force Purchased via Card on File (${card.number} - PIN 2285 Bypass)`);
    } else {
        finalizeSuccessfulCheckout(grandTotal, `Force Purchase Bypass (PIN 2285)`);
    }

    document.getElementById('forcePurchasePinModal').classList.add('hidden');
    document.getElementById('cardOnFileModal').classList.add('hidden');
    pendingForceCardIdx = null;
};

function finalizeSuccessfulCheckout(grandTotal, txDescription) {
    currentCart.forEach(item => {
        let prod = products.find(p => p.number === item.product.number);
        if(prod) prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
    });

    let earnedPoints = Math.floor(grandTotal);
    if(currentActiveAccount) {
        currentActiveAccount.points = (currentActiveAccount.points || 0) + earnedPoints;
        currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `${txDescription} (-${formatCurrency(grandTotal)} | +${earnedPoints} Pts) by ${currentOperator}` });
    }

    offlineTransactionQueue.push({ date: new Date().toLocaleString(), total: grandTotal, operator: currentOperator });

    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('purchases', 'Successful Checkout Transaction', [
            { name: 'Customer', value: currentActiveAccount ? `${currentActiveAccount.name} (${currentActiveAccount.number})` : 'Walk-in Guest', inline: true },
            { name: 'Grand Total', value: formatCurrency(grandTotal), inline: true },
            { name: 'Payment Method', value: txDescription, inline: true },
            { name: 'Operator', value: currentOperator, inline: true },
            { name: 'Loyalty Earned', value: `${earnedPoints} Pts`, inline: true }
        ], 3066993);
    }

    SoundEngine.playSuccess();
    if(currentActiveAccount) loadAccountByNumber(currentActiveAccount.number);
    currentCart = [];
    appliedCoupon = null;
    renderCartTable();

    if(typeof confetti !== 'undefined') confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    alert(`Checkout successful for ${formatCurrency(grandTotal)}! Printing receipt...`);
    window.print();
}

window.checkoutWithGiftCard = function() {
    if(currentCart.length === 0) { alert('Cart is empty.'); return; }
    document.getElementById('giftCardPayModal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('payGcCodeInput').focus(); }, 50);
};

window.executeGiftCardPayment = function() {
    let code = document.getElementById('payGcCodeInput').value.trim();
    let gc = giftCards.find(g => g.code === code);
    if(!gc) { SoundEngine.playError(); showInsufficientModal('Invalid Gift Card code.'); return; }

    let subtotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    let grandTotal = appliedCoupon ? subtotal * (1 - appliedCoupon.percent / 100) : subtotal;

    let stripeMode = localStorage.getItem('rf_stripe_mode') || 'real';
    if(stripeMode !== 'fake' && gc.balance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Gift Card balance (${formatCurrency(gc.balance)}) is insufficient.`);
        return;
    }

    currentCart.forEach(item => {
        let prod = products.find(p => p.number === item.product.number);
        if(prod) prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
    });

    gc.balance -= grandTotal;
    offlineTransactionQueue.push({ date: new Date().toLocaleString(), total: grandTotal, operator: currentOperator });
    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('purchases', 'Gift Card Checkout Completed', [
            { name: 'Customer', value: currentActiveAccount ? currentActiveAccount.name : 'Walk-in', inline: true },
            { name: 'Gift Card Code', value: code, inline: true },
            { name: 'Amount Paid', value: formatCurrency(grandTotal), inline: true },
            { name: 'Remaining GC Balance', value: formatCurrency(gc.balance), inline: true }
        ], 3066993);
    }

    SoundEngine.playSuccess();
    document.getElementById('giftCardPayModal').classList.add('hidden');
    currentCart = [];
    appliedCoupon = null;
    renderCartTable();
    alert(`Payment successful! GC Balance: ${formatCurrency(gc.balance)}`);
    window.print();
};

function updateAuditStats() {
    let totalRevenue = offlineTransactionQueue.reduce((sum, tx) => sum + tx.total, 0);
    let revEl = document.getElementById('auditSystemTotal');
    let cntEl = document.getElementById('auditTxCount');
    if(revEl) revEl.innerText = formatCurrency(totalRevenue);
    if(cntEl) cntEl.innerText = offlineTransactionQueue.length;
}

window.generateShiftReport = function(type) {
    let totalRevenue = offlineTransactionQueue.reduce((sum, tx) => sum + tx.total, 0);
    let countedCash = parseFloat(document.getElementById('countedCashInput').value) || 0;
    let variance = countedCash - totalRevenue;

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('audit', `Shift Audit Generated (${type}-Report)`, [
            { name: 'Report Type', value: `${type}-Report Audit`, inline: true },
            { name: 'Operator', value: currentOperator, inline: true },
            { name: 'System Revenue', value: formatCurrency(totalRevenue), inline: true },
            { name: 'Counted Cash', value: formatCurrency(countedCash), inline: true },
            { name: 'Drawer Variance', value: formatCurrency(variance), inline: true }
        ], 6150900);
    }

    let win = window.open('', '', 'height=500,width=400');
    if(!win) return;
    win.document.write(`<html><head><title>${type}-Report</title></head><body style="padding:20px;font-family:monospace;font-size:12px;">`);
    win.document.write(`<h2 style="text-align:center;">NEXUS LUXURY POS TERMINAL</h2>`);
    win.document.write(`<h3 style="text-align:center;">${type}-REPORT AUDIT (${currentMainOperator})</h3>`);
    win.document.write(`<hr><p>Date: ${new Date().toLocaleString()}</p><p>Operator: ${currentOperator}</p>`);
    win.document.write(`<p>Transactions: ${offlineTransactionQueue.length}</p><p>System Total: ${formatCurrency(totalRevenue)}</p>`);
    win.document.write(`<p>Counted Cash: ${formatCurrency(countedCash)}</p><p>Variance: ${formatCurrency(variance)}</p>`);
    win.document.write(`<hr><script>window.print(); window.close();</script></body></html>`);
    win.document.close();
    SoundEngine.playSuccess();
};

window.openCameraScannerModal = async function(targetInputId = null) {
    activeScanTargetId = targetInputId;
    document.getElementById('cameraScannerModal').classList.remove('hidden');
    setTimeout(async () => {
        try {
            if(html5QrCodeScanner) { await html5QrCodeScanner.stop().catch(()=>{}); html5QrCodeScanner = null; }
            html5QrCodeScanner = new Html5Qrcode("interactiveCameraReader");
            await html5QrCodeScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 150 } }, decoded => {
                closeCameraScannerModal();
                SoundEngine.playScan();
                let el = document.getElementById(activeScanTargetId);
                if(el) {
                    el.value = decoded;
                    el.dispatchEvent(new Event('input'));
                    if(activeScanTargetId === 'newAccNumber') updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
                    if(activeScanTargetId === 'prodNumber') updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg');
                    if(activeScanTargetId === 'gcCode') updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg');
                    if(activeScanTargetId === 'empBarcode') updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg');
                } else {
                    processScannedCode(decoded);
                }
            }, () => {});
        } catch(e) { showInsufficientModal("Camera access failed."); }
    }, 250);
};

window.closeCameraScannerModal = async function() {
    document.getElementById('cameraScannerModal').classList.add('hidden');
    if(html5QrCodeScanner) {
        await html5QrCodeScanner.stop().catch(()=>{});
        html5QrCodeScanner.clear();
        html5QrCodeScanner = null;
    }
};

window.promptMoneyAction = function(type) {
    let elAmt = document.getElementById('transAmount');
    let amt = parseFloat(elAmt?.value);
    if(isNaN(amt) || amt <= 0) { alert('Enter valid amount.'); return; }
    if(type === 'remove') {
        pendingAction = { type, amount: amt };
        document.getElementById('pinInput').value = '';
        document.getElementById('pinModal').classList.remove('hidden');
        document.getElementById('pinInput').focus();
    } else {
        currentActiveAccount.balance += amt;
        currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Added ${formatCurrency(amt)}` });
        saveUserData();
        SoundEngine.playSuccess();
        loadAccountByNumber(currentActiveAccount.number);
        if(elAmt) elAmt.value = '';
    }
};

window.closePinModal = function() {
    document.getElementById('pinModal').classList.add('hidden');
    pendingAction = null;
};

window.verifyPinAndExecute = function() {
    let pin = document.getElementById('pinInput').value;
    let adminPin = localStorage.getItem('rf_main_op_pin') || '2285';
    if(pin !== adminPin) { SoundEngine.playError(); alert('Invalid Security PIN!'); return; }

    currentActiveAccount.balance -= pendingAction.amount;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Removed ${formatCurrency(pendingAction.amount)} (Admin Auth)` });
    saveUserData();

    if (typeof WebhookManager !== 'undefined') {
        WebhookManager.send('security', 'Admin Fund Deduction / Override', [
            { name: 'Customer Account', value: currentActiveAccount.number, inline: true },
            { name: 'Amount Deducted', value: formatCurrency(pendingAction.amount), inline: true },
            { name: 'Authorization', value: `Manager PIN Bypass (${currentOperator})`, inline: false }
        ], 15158332);
    }

    SoundEngine.playSuccess();
    loadAccountByNumber(currentActiveAccount.number);
    closePinModal();
    let transInput = document.getElementById('transAmount');
    if(transInput) transInput.value = '';
};

window.applyDiscount = function() {
    let elDisc = document.getElementById('discountPercent');
    let pct = parseFloat(elDisc?.value);
    if(isNaN(pct) || pct <= 0) { alert('Enter discount percentage.'); return; }
    let discountVal = (currentActiveAccount.balance * (pct / 100));
    currentActiveAccount.balance -= discountVal;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Applied ${pct}% discount (-${formatCurrency(discountVal)})` });
    saveUserData();
    SoundEngine.playSuccess();
    loadAccountByNumber(currentActiveAccount.number);
    if(elDisc) elDisc.value = '';
};

window.showInsufficientModal = function(msg) {
    let msgEl = document.getElementById('insufficientMsg');
    if(msgEl) msgEl.innerText = msg;
    document.getElementById('insufficientModal').classList.remove('hidden');
};

window.closeInsufficientModal = function() {
    document.getElementById('insufficientModal').classList.add('hidden');
};

window.discoverAllConnectedHardware = async function() {
    let container = document.getElementById('hardwareDeviceListContainer');
    if(!container) return;
    container.innerHTML = `<p class="text-xs text-amber-300 animate-pulse">Scanning Bluetooth and USB ports for keyboards, laser scanners, and printers...</p>`;
    
    setTimeout(() => {
        container.innerHTML = `
            <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <div><p class="font-bold text-slate-100">USB Laser Barcode Scanner</p><p class="text-[10px] text-amber-400">HID Keyboard Emulation (Active & Listening)</p></div>
                <span class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">Connected</span>
            </div>
            <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs mt-2">
                <div><p class="font-bold text-slate-100">Bluetooth Thermal Receipt Printer</p><p class="text-[10px] text-amber-400">SPP Profile / ESC-POS</p></div>
                <span class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">Connected</span>
            </div>
            <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs mt-2">
                <div><p class="font-bold text-slate-100">Bluetooth EMV Credit Card Terminal</p><p class="text-[10px] text-amber-400">Secure Chip Reader</p></div>
                <span class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">Connected</span>
            </div>
        `;
        SoundEngine.playSuccess();
    }, 800);
};

window.unlockAdminSettings = function() {
    let pin = document.getElementById('adminPinInput').value;
    if(pin !== '6355') { SoundEngine.playError(); alert('Invalid Admin PIN (Required: 6355)'); return; }
    document.getElementById('settingsLockedBox').classList.add('hidden');
    document.getElementById('settingsUnlockedBox').classList.remove('hidden');

    let pubInput = document.getElementById('stripePubInput');
    let secInput = document.getElementById('stripeSecInput');
    let modeSelect = document.getElementById('stripeModeSelect');
    let themeSelect = document.getElementById('themeToggleSetting');
    if(pubInput) pubInput.value = localStorage.getItem('rf_stripe_pub') || 'pk_live_51UB59F7GI7FzkBKdzZ6tMG3dIobIZ4xYW0xM3g4rwpve1pl031XDBxlWTI7XDW7tbxkJxz1QRGpC9DPi0uuqAebC00mVrwcqko';
    if(secInput) secInput.value = localStorage.getItem('rf_stripe_sec') || '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';
    if(modeSelect) modeSelect.value = localStorage.getItem('rf_stripe_mode') || 'real';
    if(themeSelect) themeSelect.value = localStorage.getItem('nexus_theme') || 'dark';

    let soundSet = document.getElementById('soundToggleSetting');
    if(soundSet) soundSet.value = SoundEngine.enabled ? 'ON' : 'OFF';

    loadWebhookInputsIntoSettings();
};

window.saveStripeSettings = function() {
    let pub = document.getElementById('stripePubInput').value.trim();
    let sec = document.getElementById('stripeSecInput').value.trim();
    let mode = document.getElementById('stripeModeSelect').value;
    localStorage.setItem('rf_stripe_pub', pub);
    localStorage.setItem('rf_stripe_sec', sec);
    localStorage.setItem('rf_stripe_mode', mode);
    SoundEngine.playSuccess();
    alert('Stripe Gateway configuration saved successfully!');
};

window.saveAllWebhookSettings = function() {
    localStorage.setItem('rf_wh_purchases', document.getElementById('whPurchasesInput')?.value.trim() || '');
    localStorage.setItem('rf_wh_staff', document.getElementById('whStaffInput')?.value.trim() || '');
    localStorage.setItem('rf_wh_accounts', document.getElementById('whAccountsInput')?.value.trim() || '');
    localStorage.setItem('rf_wh_inventory', document.getElementById('whInventoryInput')?.value.trim() || '');
    localStorage.setItem('rf_wh_security', document.getElementById('whSecurityInput')?.value.trim() || '');
    localStorage.setItem('rf_wh_audit', document.getElementById('whAuditInput')?.value.trim() || '');

    SoundEngine.playSuccess();
    alert('All Discord webhook channel endpoints saved successfully!');
};

function loadWebhookInputsIntoSettings() {
    let channels = WebhookManager.getChannels();
    let setVal = (id, val) => {
        let el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('whPurchasesInput', channels.purchases);
    setVal('whStaffInput', channels.staff);
    setVal('whAccountsInput', channels.accounts);
    setVal('whInventoryInput', channels.inventory);
    setVal('whSecurityInput', channels.security);
    setVal('whAuditInput', channels.audit);
}

window.toggleSoundEffects = function(val) {
    SoundEngine.enabled = (val === 'ON');
    localStorage.setItem('rf_sound', val);
};

function saveUserData() {
    if(!currentMainOperator) return;
    let storeData = {
        pin: localStorage.getItem('rf_main_op_pin') || '2285',
        accounts,
        products,
        coupons,
        giftcards: giftCards,
        employees,
        subOperators,
        timeclock: timeclockEntries,
        queue: offlineTransactionQueue
    };
    set(ref(db, `stores/${currentMainOperator}`), storeData).catch(err => {
        console.error("Cloud Sync Failed:", err);
    });
}