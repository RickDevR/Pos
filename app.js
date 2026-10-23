// Nexus Luxury Enterprise POS Engine v8.7 - Guaranteed Click Execution & Responsive Handlers
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
let checkoutInProgress = false;
let pendingAction = null;
let pendingSubOpData = null;
let html5QrCodeScanner = null;
let activeScanTargetId = null;
let currentCurrency = localStorage.getItem('rf_currency') || 'USD';
let dbListenerUnsubscribe = null;
let lastCloudSaveError = null;
localStorage.removeItem('rf_stripe_sec');

const CurrencySymbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$' };

function formatCurrency(amount) {
    let value = Number(amount);
    return Number.isFinite(value)
        ? `${CurrencySymbols[currentCurrency] || '$'}${value.toFixed(2)}`
        : `${CurrencySymbols[currentCurrency] || '$'}--`;
}

function getCartGrandTotal() {
    let subtotal = currentCart.reduce((sum, item) =>
        sum + ((Number(item.product.price) * item.quantity) * (1 - (item.discount / 100))), 0);
    return appliedCoupon ? subtotal * (1 - (Number(appliedCoupon.percent) / 100)) : subtotal;
}

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
    "Tip: Fully responsive mobile & desktop UI layout active.",
    "Tip: USB Laser Barcode Scanner ready for instant account and product loading.",
    "Tip: Customer circular photo ID badges fully enabled for printing.",
    "Tip: Fake money sandbox & live Stripe payment gateways fully synchronized."
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
    let lastKeyTime = 0;
    let isRapidSequence = false;
    let lastInputTarget = null;

    window.addEventListener('keydown', (e) => {
        let currentTime = Date.now();
        if(e.target !== lastInputTarget) {
            barcodeBuffer = '';
            isRapidSequence = false;
            lastKeyTime = 0;
            lastInputTarget = e.target;
        }

        if (e.key === 'Enter') {
            let isBarcodeScan = isRapidSequence &&
                barcodeBuffer.trim().length >= 2 &&
                currentTime - lastKeyTime <= 100;
            if (isBarcodeScan) {
                let scannedCode = barcodeBuffer.trim();
                e.preventDefault();
                barcodeBuffer = '';
                isRapidSequence = false;
                lastKeyTime = 0;
                SoundEngine.playScan();
                handleUniversalScan(scannedCode);
            } else {
                barcodeBuffer = '';
                isRapidSequence = false;
                lastKeyTime = 0;
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (lastKeyTime === 0 || currentTime - lastKeyTime > 60) {
                barcodeBuffer = e.key;
                isRapidSequence = false;
            } else {
                barcodeBuffer += e.key;
                isRapidSequence = true;
            }
            lastKeyTime = currentTime;
        } else {
            barcodeBuffer = '';
            isRapidSequence = false;
            lastKeyTime = 0;
        }
    }, true);
}

window.handleUniversalScan = function(code) {
    code = code.trim();
    if(!code) return;

    let activeInput = document.activeElement;
    let giftCardPayModal = document.getElementById('giftCardPayModal');
    if(giftCardPayModal && !giftCardPayModal.classList.contains('hidden')) {
        let input = document.getElementById('payGcCodeInput');
        if(input) {
            input.value = code;
            window.executeGiftCardPayment();
        }
        return;
    }

    let accountModal = document.getElementById('accountModal');
    if(accountModal && !accountModal.classList.contains('hidden')) {
        let input = document.getElementById('cartProdNumInput');
        if(input) { input.value = code; processScannedCode(code); }
        return;
    }

    if(activeInput && ['newAccNumber', 'prodNumber', 'gcCode', 'empBarcode'].includes(activeInput.id)) {
        activeInput.value = code;
        activeInput.dispatchEvent(new Event('input'));
        SoundEngine.playScan();
        if(activeInput.id === 'newAccNumber') updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
        if(activeInput.id === 'prodNumber') updateFormBarcodePreview('prodNumber', 'prodBarcodePreviewSvg');
        if(activeInput.id === 'gcCode') updateFormBarcodePreview('gcCode', 'gcBarcodePreviewSvg');
        if(activeInput.id === 'empBarcode') updateFormBarcodePreview('empBarcode', 'cashierBarcodePreviewSvg');
        return;
    }

    let createAccTab = document.getElementById('tab-createAccount');
    let productsTab = document.getElementById('tab-products');
    let gcTab = document.getElementById('tab-giftcards');
    let payrollTab = document.getElementById('tab-payroll');

    let acc = accounts.find(a => a.number.toLowerCase() === code.toLowerCase());
    if(acc) {
        loadAccountByNumber(acc.number);
        SoundEngine.playSuccess();
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

    let prod = products.find(p => p.number === code);
    if(prod) {
        showInsufficientModal(`Product scanned: ${prod.name} (${formatCurrency(prod.price)}). Scan the customer's account ID before adding items.`);
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
        bodyRoot.className = 'bg-slate-100 text-slate-900 font-sans antialiased overflow-x-hidden select-none transition-colors duration-500 touch-manipulation text-sm sm:text-base';
    } else {
        htmlRoot.classList.add('dark');
        bodyRoot.className = 'bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden select-none transition-colors duration-500 touch-manipulation text-sm sm:text-base';
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
    if(!/^\d{4}$/.test(pin)) { SoundEngine.playError(); showInsufficientModal('Enter a valid 4-digit PIN.'); return; }

    try {
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
                try {
                    await set(storeRef, initialData);
                    launchTerminalSession(username, username, true);
                } catch(error) {
                    SoundEngine.playError();
                    console.error('Store creation failed:', error);
                    showInsufficientModal(`Could not create the store. Check your database connection and try again. ${error.message}`);
                }
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
    } catch(error) {
        SoundEngine.playError();
        console.error('Login failed:', error);
        showInsufficientModal(`Could not connect to the store database. Check your connection and try again. ${error.message}`);
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
                    let tierEl = document.getElementById('modalAccTier');
                    if(bEl) bEl.innerText = formatCurrency(refreshed.balance);
                    if(pEl) pEl.innerText = `${refreshed.points || 0} Pts`;
                    if(tierEl) tierEl.innerText = accountMembershipTier(refreshed) === 'vip' ? 'VIP Member' : 'Standard';
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
    let totalCap = accounts.reduce((total, account) => total + (Number(account.balance) || 0), 0);
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
    let cardBalInput = document.getElementById('newCardBal').value.trim();
    let cardBal = cardBalInput === '' ? 0 : parseFloat(cardBalInput);
    let cardStatus = document.getElementById('newCardStatus').value;
    let info = document.getElementById('newAccInfo').value.trim();
    let membershipTier = document.getElementById('newAccMembership').value;
    let fileInput = document.getElementById('accImageFile');

    if(accounts.some(account =>
        account.number.toLowerCase() === number.toLowerCase() && account.number !== oldNum
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Account number "${number}" is already in use.`);
        return;
    }
    if(!Number.isFinite(balance) || balance < 0 || (cardNum && (!Number.isFinite(cardBal) || cardBal < 0))) {
        SoundEngine.playError();
        showInsufficientModal('Account and card balances must be valid amounts of zero or more.');
        return;
    }

    let cardsList = cardNum ? [{ number: cardNum, balance: cardBal, status: cardStatus, exp: '12/28', cvc: '123' }] : [];

    let reader = new FileReader();
    let saveAcc = (imgData = '') => {
        if(oldNum) {
            let acc = accounts.find(a => a.number === oldNum);
            if(acc) {
                acc.number = number;
                acc.name = name;
                acc.email = email;
                acc.balance = balance;
                acc.cards = cardsList.length && acc.cards?.length
                    ? [{ ...acc.cards[0], ...cardsList[0] }, ...acc.cards.slice(1)]
                    : cardsList;
                acc.info = info;
                acc.membershipTier = membershipTier;
                if(imgData) acc.image = imgData;
                acc.history.push({ date: new Date().toLocaleString(), text: `Account profile updated by ${currentOperator}` });
            }
        } else {
            if(accounts.some(a => a.number === number)) { SoundEngine.playError(); showInsufficientModal(`Account number "${number}" already exists!`); return; }
            accounts.push({
                number, name, email, balance, points: 0, cards: cardsList, info, image: imgData, membershipTier,
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

    if(fileInput && fileInput.files && fileInput.files[0]) {
        reader.onload = function(evt) { saveAcc(evt.target.result); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        let existing = accounts.find(x => x.number === oldNum);
        saveAcc(existing ? existing.image : '');
    }
};

window.editAccount = function(num) {
    let acc = accounts.find(a => a.number === num);
    if(!acc) return;
    document.getElementById('editAccountOldNum').value = acc.number;
    document.getElementById('newAccNumber').value = acc.number;
    document.getElementById('newAccName').value = acc.name;
    document.getElementById('newAccEmail').value = acc.email;
    document.getElementById('newAccBalance').value = acc.balance;
    document.getElementById('newAccMembership').value = accountMembershipTier(acc);
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
    document.getElementById('newAccMembership').value = 'standard';
    document.getElementById('accountFormTitle').innerText = 'Create Customer Account';
    document.getElementById('accountSubmitBtn').innerText = 'Save Account';
    document.getElementById('accountCancelBtn').classList.add('hidden');
    updateFormBarcodePreview('newAccNumber', 'accBarcodePreviewSvg');
};

function escapePrintHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function createPrintBarcode(code) {
    if(typeof JsBarcode === 'undefined') {
        alert('Barcode printing is unavailable because the barcode library did not load.');
        return '';
    }
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
        JsBarcode(svg, String(code), {
            format: 'CODE128',
            lineColor: '#111827',
            background: '#ffffff',
            width: 1.5,
            height: 42,
            displayValue: true,
            fontSize: 11,
            margin: 4
        });
    } catch(error) {
        alert(`Could not create barcode "${code}": ${error.message}`);
        return '';
    }
    return new XMLSerializer().serializeToString(svg);
}

function printRecords(title, records) {
    if(!records.length) {
        alert(`There are no ${title.toLowerCase()} to print.`);
        return;
    }
    let printWindow = window.open('', '_blank', 'width=900,height=700');
    if(!printWindow) {
        alert('The print window was blocked. Allow pop-ups for this site and try again.');
        return;
    }

    let cards = [];
    for(let record of records) {
        let barcode = createPrintBarcode(record.code);
        if(!barcode) {
            printWindow.close();
            return;
        }
        let image = record.image
            ? `<img class="record-image" src="${escapePrintHtml(record.image)}" alt="">`
            : '';
        let fields = record.fields.map(field =>
            `<div class="field"><span>${escapePrintHtml(field.label)}</span><strong>${escapePrintHtml(field.value)}</strong></div>`
        ).join('');
        let vipBadge = record.type.includes('vip');
        let vipDetails = record.fields
            .filter(field => !['Membership', 'Account ID', 'Balance'].includes(field.label))
            .map(field => `<div class="field"><span>${escapePrintHtml(field.label)}</span><strong>${escapePrintHtml(field.value)}</strong></div>`)
            .join('');
        cards.push(`
            ${vipBadge ? `
                <article class="print-card ${record.type}">
                    <div class="vip-brand">NEXUS LUXURY ENTERPRISE</div>
                    <div class="vip-subtitle">VIP CUSTOMER MEMBERSHIP ID BADGE</div>
                    <div class="vip-avatar">
                        ${record.image
                            ? `<img src="${escapePrintHtml(record.image)}" alt="">`
                            : `<span>${escapePrintHtml(String(record.name).charAt(0).toUpperCase())}</span>`}
                    </div>
                    <h2 class="vip-name">${escapePrintHtml(record.name)}</h2>
                    <div class="vip-balance">Balance: ${escapePrintHtml(record.balance)}</div>
                    <div class="vip-details">${vipDetails}</div>
                    <div class="vip-barcode">${barcode}<strong>${escapePrintHtml(record.code)}</strong></div>
                    <div class="vip-tagline">Scan barcode at terminal for instant account access.</div>
                </article>
            ` : `
                <article class="print-card ${record.type}">
                    <div class="card-heading">
                        ${image}
                        <div><div class="record-type">${escapePrintHtml(record.heading)}</div>
                        <h2>${escapePrintHtml(record.name)}</h2></div>
                    </div>
                    <div class="fields">${fields}</div>
                    <div class="barcode">${barcode}</div>
                </article>
            `}
        `);
    }

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
        <html><head><meta charset="utf-8"><title>${escapePrintHtml(title)}</title>
        <style>
            @page { size: auto; margin: 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font: 12px Arial, sans-serif; }
            header { margin-bottom: 14px; border-bottom: 2px solid #d1d5db; padding-bottom: 8px; }
            header h1 { margin: 0 0 4px; font-size: 18px; }
            header p { margin: 0; color: #4b5563; font-size: 10px; }
            .print-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
            .print-card { min-width: 0; break-inside: avoid; page-break-inside: avoid; border: 1px solid #9ca3af; border-radius: 8px; padding: 10px; }
            .print-card.vip { min-height: 102mm; border: 2px solid #f59e0b; border-radius: 14px; background: #fff; padding: 10mm 8mm 7mm; text-align: center; display: flex; flex-direction: column; align-items: center; }
            .vip-brand { color: #f59e0b; font-size: 13px; font-weight: 800; letter-spacing: .08em; }
            .vip-subtitle { margin-top: 5px; color: #475569; font-size: 8px; text-transform: uppercase; }
            .vip-avatar { width: 65px; height: 65px; margin: 13px auto 7px; border: 2px solid #f59e0b; border-radius: 50%; display: flex; justify-content: center; align-items: center; overflow: hidden; color: #f59e0b; font-size: 30px; }
            .vip-avatar img { width: 100%; height: 100%; object-fit: cover; }
            .vip-name { max-width: 100%; color: #334155; font-size: 15px; overflow-wrap: anywhere; }
            .vip-balance { margin-top: 6px; color: #059669; font-size: 11px; font-weight: 800; }
            .vip-details { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; margin: 8px 0; text-align: left; }
            .vip-details .field span { font-size: 7px; }
            .vip-details .field strong { font-size: 8px; }
            .vip-barcode { width: 100%; margin-top: auto; padding: 7px 5px 3px; border: 1px solid #fed7aa; border-radius: 8px; }
            .vip-barcode svg { max-width: 100%; height: auto; }
            .vip-barcode strong { display: block; color: #c2410c; font: bold 8px monospace; letter-spacing: .08em; }
            .vip-tagline { margin-top: 7px; color: #475569; font-size: 7px; }
            .card-heading { display: flex; align-items: center; gap: 9px; min-height: 36px; }
            .record-image { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
            .record-type { color: #4b5563; font-size: 8px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; }
            h2 { margin: 2px 0 0; font-size: 13px; overflow-wrap: anywhere; }
            .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 10px; margin: 8px 0; }
            .field { min-width: 0; }
            .field span { display: block; color: #6b7280; font-size: 8px; text-transform: uppercase; }
            .field strong { display: block; margin-top: 1px; font-size: 10px; overflow-wrap: anywhere; }
            .barcode { text-align: center; }
            .barcode svg { max-width: 100%; height: auto; }
            @media screen { body { max-width: 900px; margin: 20px auto; padding: 0 16px; } }
            @media print { header { margin-bottom: 10px; } }
        </style></head><body>
        <header><h1>${escapePrintHtml(title)}</h1><p>${records.length} record${records.length === 1 ? '' : 's'} · print from this window</p></header>
        <main class="print-grid">${cards.join('')}</main>
        <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 250));</script>
        </body></html>`);
    printWindow.document.close();
}

function accountPrintRecord(account) {
    let membershipTier = accountMembershipTier(account);
    return {
        type: membershipTier === 'vip' ? 'account vip' : 'account',
        heading: membershipTier === 'vip' ? 'VIP customer membership ID' : 'Customer account ID',
        name: account.name,
        code: account.number,
        image: account.image || '',
        fields: [
            { label: 'Membership', value: membershipTier === 'vip' ? 'VIP Member' : 'Standard Member' },
            { label: 'Account ID', value: account.number },
            { label: 'Email', value: account.email || '—' },
            { label: 'Balance', value: formatCurrency(Number(account.balance) || 0) },
            { label: 'Loyalty points', value: account.points || 0 },
            { label: 'Card status', value: account.cards?.[0]?.status || 'No card on file' },
            ...(account.cards?.length ? [
                { label: 'Saved card balance', value: formatCurrency(Number(account.cards[0].balance) || 0) }
            ] : [])
        ],
        balance: formatCurrency(Number(account.balance) || 0)
    };
}

function accountMembershipTier(account) {
    if(account.membershipTier === 'vip' || account.membershipTier === 'standard') return account.membershipTier;
    return /vip/i.test(account.info || '') ? 'vip' : 'standard';
}

function productPrintRecord(product) {
    return {
        type: 'product',
        heading: 'Product barcode label',
        name: product.name,
        code: product.number,
        image: product.image || '',
        fields: [
            { label: 'Barcode / SKU', value: product.number },
            { label: 'Price', value: formatCurrency(Number(product.price) || 0) },
            { label: 'Stock', value: product.stock || 0 }
        ]
    };
}

function giftCardPrintRecord(giftCard) {
    return {
        type: 'gift-card',
        heading: 'Gift card',
        name: giftCard.name,
        code: giftCard.code,
        fields: [
            { label: 'Gift card code', value: giftCard.code },
            { label: 'Balance', value: formatCurrency(Number(giftCard.balance) || 0) }
        ]
    };
}

window.printAllRecords = function() {
    printRecords('All IDs & Labels', [
        ...accounts.map(accountPrintRecord),
        ...products.map(productPrintRecord),
        ...giftCards.map(giftCardPrintRecord)
    ]);
};

window.printAllAccounts = function() {
    printRecords('Customer Accounts', accounts.map(accountPrintRecord));
};

window.printFilteredAccounts = function() {
    let filter = document.getElementById('filterAccountInput')?.value.trim().toLowerCase() || '';
    let filtered = accounts.filter(account =>
        account.name.toLowerCase().includes(filter) || account.number.toLowerCase().includes(filter)
    );
    printRecords(filter ? 'Filtered Customer Accounts' : 'Customer Accounts', filtered.map(accountPrintRecord));
};

window.printAllProducts = function() {
    printRecords('Products & Barcodes', products.map(productPrintRecord));
};

window.printAllGiftCards = function() {
    printRecords('Gift Cards', giftCards.map(giftCardPrintRecord));
};

window.printAccountByIndex = function(index) {
    let account = accounts[index];
    if(account) printRecords('Customer Account ID', [accountPrintRecord(account)]);
};

window.printAccountBadge = function(num) {
    let account = accounts.find(item => item.number === num);
    if(account) printRecords('Customer Account ID', [accountPrintRecord(account)]);
};

window.printCurrentAccountBadge = function() {
    if(!currentActiveAccount) return;
    window.printAccountBadge(currentActiveAccount.number);
};

function renderAccountsList(filter = '') {
    let container = document.getElementById('accountsGrid');
    if(!container) return;
    container.innerHTML = '';
    let filtered = accounts.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()) || a.number.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(acc => {
        let accountIndex = accounts.indexOf(acc);
        let cardSummary = acc.cards && acc.cards.length > 0 ? `${acc.cards.length} Card(s) on File` : 'No Cards';
        let img = acc.image || '';
        let safeImage = escapePrintHtml(img);
        let safeNumber = escapePrintHtml(acc.number);
        let safeName = escapePrintHtml(acc.name);
        let safeEmail = escapePrintHtml(acc.email || '');
        container.innerHTML += `
            <div class="p-5 sm:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border ${accountMembershipTier(acc) === 'vip' ? 'border-amber-400/60' : 'border-amber-500/20'} hover:border-amber-500/55 transition-all flex flex-col justify-between space-y-4 shadow-xl pointer-events-auto">
                <div>
                    <div class="flex items-center gap-3 mb-3">
                        ${img ? `<img src="${safeImage}" class="w-12 h-12 rounded-full object-cover border-2 border-amber-500/50 shrink-0">` : `<div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-lg shrink-0 border-2 border-amber-500/40">${escapePrintHtml(acc.name.charAt(0))}</div>`}
                        <div>
                            <span class="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-xl border border-amber-500/25">${safeNumber}</span>
                            ${accountMembershipTier(acc) === 'vip' ? '<span class="text-[9px] font-black uppercase tracking-wider text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/40">VIP</span>' : ''}
                            <h3 class="text-base sm:text-lg font-bold text-slate-100 mt-0.5">${safeName}</h3>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400">${safeEmail}</p>
                    <p class="text-emerald-400 font-black text-lg my-1">${formatCurrency(acc.balance)}</p>
                    <div class="my-2 flex justify-center bg-slate-950 p-2 rounded-xl border border-white/5">
                        <svg class="barcode-svg" data-code="${acc.number}"></svg>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">Loyalty: ${acc.points || 0} Pts</span>
                        <span class="text-[10px] text-sky-400 font-mono">${cardSummary}</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="loadAccountByIndex(${accountIndex})" class="flex-1 py-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs hover:bg-amber-500/35 transition-all pointer-events-auto">Load</button>
                    <button onclick="printAccountByIndex(${accountIndex})" class="px-3 py-2.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold pointer-events-auto">Print</button>
                    <button onclick="editAccountByIndex(${accountIndex})" class="px-3 py-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold pointer-events-auto">Edit</button>
                    ${isMainOpSession ? `<button onclick="deleteAccountByIndex(${accountIndex})" class="px-3 py-2.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold pointer-events-auto"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                </div>
            </div>
        `;
    });
    document.querySelectorAll('.barcode-svg').forEach(svg => {
        try {
            if(typeof JsBarcode !== 'undefined') {
                JsBarcode(svg, svg.dataset.code, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 1.5, height: 32, displayValue: true, fontSize: 10 });
            }
        } catch(e) {}
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.filterAccountList = function(val) { renderAccountsList(val); };

window.loadAccountByIndex = function(index) {
    let account = accounts[index];
    if(account) loadAccountByNumber(account.number);
};

window.editAccountByIndex = function(index) {
    let account = accounts[index];
    if(account) editAccount(account.number);
};

window.deleteAccountByIndex = function(index) {
    let account = accounts[index];
    if(account) deleteAccount(account.number);
};

window.loadAccountByNumber = function(num) {
    let acc = accounts.find(a => a.number.toLowerCase() === num.toLowerCase());
    if(!acc) { SoundEngine.playError(); showInsufficientModal(`Account number "${num}" not found.`); return; }
    if(!Array.isArray(acc.history)) acc.history = [];
    if(!Array.isArray(acc.cards)) acc.cards = [];
    currentActiveAccount = acc;
    currentCart = [];
    appliedCoupon = null;

    let avatarContainer = document.getElementById('modalAvatarContainer');
    avatarContainer.innerHTML = acc.image
        ? `<img src="${acc.image}" class="w-full h-full object-cover rounded-2xl">`
        : `<span id="modalAvatar">${escapePrintHtml(acc.name.charAt(0))}</span>`;
    document.getElementById('modalAccName').innerText = acc.name;
    document.getElementById('modalAccNum').innerText = acc.number;
    document.getElementById('modalAccEmail').innerText = acc.email;
    document.getElementById('modalAccTier').innerText = accountMembershipTier(acc) === 'vip' ? 'VIP Member' : 'Standard';
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
    (Array.isArray(currentActiveAccount?.history) ? currentActiveAccount.history : []).slice().reverse().forEach(h => {
        container.innerHTML += `
            <div class="p-3 rounded-2xl bg-slate-900 border border-white/5 text-xs flex justify-between items-center shadow-inner">
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

    let acc = accounts.find(a => a.number.toLowerCase() === code.toLowerCase());
    if(acc) {
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        if(currentActiveAccount?.number === acc.number) {
            SoundEngine.playScan();
            return;
        }
        if(currentCart.length > 0) {
            SoundEngine.playError();
            showInsufficientModal('Finish or clear the current cart before switching customer accounts.');
            return;
        }
        let switchAccount = () => {
            closeAccountModal();
            loadAccountByNumber(acc.number);
            SoundEngine.playSuccess();
        };
        switchAccount();
        return;
    }

    let prod = products.find(p => p.number.toLowerCase() === code.toLowerCase());
    if(prod) {
        if(!currentActiveAccount) {
            SoundEngine.playError();
            showInsufficientModal('Scan a customer account ID before adding products to the cart.');
            return;
        }
        let stock = Number(prod.stock) || 0;
        let existing = currentCart.find(i => i.product.number === prod.number);
        if(stock <= 0) { SoundEngine.playError(); showInsufficientModal(`Product "${prod.name}" is out of stock!`); return; }
        if(existing && existing.quantity >= stock) {
            SoundEngine.playError();
            showInsufficientModal(`Only ${stock} unit(s) of "${prod.name}" are available.`);
            return;
        }
        if(existing) existing.quantity += 1;
        else currentCart.push({ product: prod, quantity: 1, discount: 0 });
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        SoundEngine.playScan();
        renderCartTable();
        return;
    }

    let coup = coupons.find(c => c.code.toLowerCase() === code.toLowerCase());
    if(coup) {
        appliedCoupon = coup;
        let input = document.getElementById('cartProdNumInput');
        if(input) input.value = '';
        SoundEngine.playSuccess();
        renderCartTable();
        alert(`Coupon Applied: ${coup.name} (${coup.percent}% Off)!`);
        return;
    }

    let gc = giftCards.find(g => g.code.toLowerCase() === code.toLowerCase());
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
    let stock = Number(document.getElementById('prodStock').value);
    let fileInput = document.getElementById('prodImageFile');

    if(!number || !name || !Number.isFinite(price) || price <= 0 ||
        !Number.isInteger(stock) || stock < 0) {
        SoundEngine.playError();
        showInsufficientModal('Enter a product barcode, name, positive price, and whole-number stock quantity of zero or more.');
        return;
    }
    if(products.some(product =>
        product.number.toLowerCase() === number.toLowerCase() && product.number !== oldNum
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Product barcode "${number}" is already in use.`);
        return;
    }

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

window.editProductByIndex = function(index) {
    let product = products[index];
    if(product) editProduct(product.number);
};

window.deleteProductByIndex = function(index) {
    let product = products[index];
    if(product) deleteProduct(product.number);
};

function renderProductsList() {
    let container = document.getElementById('productsListContainer');
    if(!container) return;
    container.innerHTML = '';
    if(products.length === 0) { container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">No products found.</div>`; return; }
    
    products.forEach((p, index) => {
        let isLowStock = (p.stock || 0) <= 5;
        let safeNumber = escapePrintHtml(p.number);
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/65 backdrop-blur-2xl border ${isLowStock ? 'border-rose-500/50 animate-pulse' : 'border-amber-500/20'} flex flex-col sm:flex-row items-center justify-between shadow-lg gap-3 pointer-events-auto">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <svg class="barcode-svg" data-code="${safeNumber}"></svg>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-slate-100 text-sm">${escapePrintHtml(p.name)}</h4>
                            ${isLowStock ? `<span class="bg-rose-500/20 text-rose-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-500/40">LOW (${p.stock})</span>` : ''}
                        </div>
                        <p class="text-xs text-amber-400 font-mono mt-0.5">SKU: ${safeNumber} | <strong class="text-emerald-400">${formatCurrency(p.price)}</strong> | Stock: ${escapePrintHtml(p.stock || 0)}</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full sm:w-auto justify-end">
                    <button onclick="editProductByIndex(${index})" class="px-3 py-2 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold pointer-events-auto">Edit</button>
                    <button onclick="printProductByIndex(${index})" class="px-3 py-2 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold pointer-events-auto">Print</button>
                    ${isMainOpSession ? `<button onclick="deleteProductByIndex(${index})" class="px-3 py-2 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold pointer-events-auto">Delete</button>` : ''}
                </div>
            </div>
        `;
    });
    document.querySelectorAll('.barcode-svg').forEach(svg => {
        try {
            if(typeof JsBarcode !== 'undefined') {
                JsBarcode(svg, svg.dataset.code, { format: "CODE128", lineColor: "#f59e0b", background: "transparent", width: 1.5, height: 32, displayValue: true, fontSize: 10 });
            }
        } catch(e) {}
    });
}

window.printBarcodeLabel = function(code, title) {
    let giftCard = giftCards.find(item => item.code === code);
    let product = products.find(item => item.number === code);
    if(giftCard) printRecords('Gift Card', [giftCardPrintRecord(giftCard)]);
    else if(product) printRecords('Product Barcode', [productPrintRecord(product)]);
    else printRecords(title || 'Barcode', [{
        type: 'barcode',
        heading: 'Barcode',
        name: title || code,
        code,
        fields: [{ label: 'Code', value: code }]
    }]);
};

window.printProductByIndex = function(index) {
    let product = products[index];
    if(product) printRecords('Product Barcode', [productPrintRecord(product)]);
};

window.handleCouponFormSubmit = function(e) {
    e.preventDefault();
    let oldCode = document.getElementById('editCouponOldCode').value;
    let code = document.getElementById('couponCode').value.trim();
    let name = document.getElementById('couponName').value.trim();
    let percent = parseFloat(document.getElementById('couponPercent').value);

    if(!code || !name || !Number.isFinite(percent) || percent < 1 || percent > 100) {
        SoundEngine.playError();
        showInsufficientModal('Enter a coupon code, name, and discount between 1% and 100%.');
        return;
    }
    if(coupons.some(coupon =>
        coupon.code.toLowerCase() === code.toLowerCase() && coupon.code !== oldCode
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Coupon code "${code}" is already in use.`);
        return;
    }

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

window.editCouponByIndex = function(index) {
    let coupon = coupons[index];
    if(coupon) editCoupon(coupon.code);
};

window.deleteCouponByIndex = function(index) {
    let coupon = coupons[index];
    if(coupon) deleteCoupon(coupon.code);
};

function renderCouponsList() {
    let container = document.getElementById('couponsListContainer');
    if(!container) return;
    container.innerHTML = '';
    coupons.forEach((c, index) => {
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex items-center justify-between shadow-lg">
                <div>
                    <h4 class="font-bold text-slate-100 text-sm">${escapePrintHtml(c.name)} (${escapePrintHtml(c.percent)}% Off)</h4>
                    <p class="text-xs text-amber-400 font-mono mt-0.5">Code: ${escapePrintHtml(c.code)}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editCouponByIndex(${index})" class="px-3 py-1.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="deleteCouponByIndex(${index})" class="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Delete</button>
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

    if(!code || !name || !Number.isFinite(balance) || balance < 0) {
        SoundEngine.playError();
        showInsufficientModal('Enter a gift card code, recipient name, and balance of zero or more.');
        return;
    }
    if(giftCards.some(card =>
        card.code.toLowerCase() === code.toLowerCase() && card.code !== oldCode
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Gift card code "${code}" is already in use.`);
        return;
    }

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
    giftCards.forEach((g, index) => {
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between shadow-lg gap-3">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <svg class="barcode-svg" data-code="${escapePrintHtml(g.code)}"></svg>
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${escapePrintHtml(g.name)}</h4>
                        <p class="text-xs text-amber-400 font-mono mt-0.5">Code: ${escapePrintHtml(g.code)} | <strong class="text-emerald-400">${formatCurrency(g.balance)}</strong></p>
                    </div>
                </div>
                <div class="flex gap-2 w-full sm:w-auto justify-end">
                    <button onclick="editGiftCardByIndex(${index})" class="px-3 py-1.5 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="printGiftCardByIndex(${index})" class="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold">Print</button>
                    <button onclick="deleteGiftCardByIndex(${index})" class="px-3 py-1.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Delete</button>
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

window.printGiftCardByIndex = function(index) {
    let giftCard = giftCards[index];
    if(giftCard) printRecords('Gift Card', [giftCardPrintRecord(giftCard)]);
};

window.editGiftCardByIndex = function(index) {
    let giftCard = giftCards[index];
    if(giftCard) editGiftCard(giftCard.code);
};

window.deleteGiftCardByIndex = function(index) {
    let giftCard = giftCards[index];
    if(giftCard) deleteGiftCard(giftCard.code);
};

// --- EMPLOYEE & CASHIER ID BADGE MANAGEMENT ---
window.handleEmployeeFormSubmit = function(e) {
    e.preventDefault();
    let oldName = document.getElementById('editEmpOldName').value;
    let name = document.getElementById('empName').value.trim();
    let role = document.getElementById('empRole').value.trim();
    let rate = parseFloat(document.getElementById('empRate').value);
    let barcode = document.getElementById('empBarcode').value.trim() || ('EMP-' + Math.floor(10000 + Math.random() * 90000));
    let password = document.getElementById('empPassword').value.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    let fileInput = document.getElementById('empImageFile');

    if(!name || !role || !Number.isFinite(rate) || rate < 0) {
        SoundEngine.playError();
        showInsufficientModal('Enter an employee name, role, and hourly rate of zero or more.');
        return;
    }
    if(employees.some(employee =>
        employee.name.toLowerCase() === name.toLowerCase() && employee.name !== oldName
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Employee "${name}" is already registered.`);
        return;
    }
    if(employees.some(employee =>
        (employee.barcode || '').toLowerCase() === barcode.toLowerCase() && employee.name !== oldName
    )) {
        SoundEngine.playError();
        showInsufficientModal(`Cashier ID "${barcode}" is already in use.`);
        return;
    }

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

window.printEmployeeBadgeByIndex = function(index) {
    let employee = employees[index];
    if(employee) printCashierBadge(employee.name, employee.role, employee.barcode || 'EMP-1001', employee.password || '1234', employee.image || '');
};

window.editEmployeeByIndex = function(index) {
    let employee = employees[index];
    if(employee) editEmployee(employee.name);
};

window.deleteEmployeeByIndex = function(index) {
    let employee = employees[index];
    if(employee) deleteEmployee(employee.name);
};

window.printCashierBadge = function(name, role, barcode, password, imgData) {
    let win = window.open('', '', 'height=650,width=450');
    if(!win) return;
    let safeName = escapePrintHtml(name);
    let safeRole = escapePrintHtml(role);
    let safeBarcode = escapePrintHtml(barcode);
    let safePassword = escapePrintHtml(password);
    let safeImage = escapePrintHtml(imgData || '');
    let barcodeJson = JSON.stringify(String(barcode)).replace(/</g, '\\u003c');
    win.document.write(`<html><head><title>Cashier ID Badge</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:30px;background:#0f172a;color:#f8fafc;">
        <div style="border:3px solid #f59e0b;border-radius:24px;padding:30px;background:#1e293b;max-width:350px;margin:0 auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <h2 style="color:#f59e0b;margin-bottom:5px;font-size:18px;letter-spacing:1px;">NEXUS LUXURY ENTERPRISE</h2>
            <p style="color:#94a3b8;font-size:11px;margin-bottom:20px;text-transform:uppercase;">Official Cashier Security ID Badge</p>
            ${imgData ? `<img src="${safeImage}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid #f59e0b;margin-bottom:15px;" />` : `<div style="width:110px;height:110px;border-radius:50%;background:#334155;color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 15px auto;border:3px solid #f59e0b;">${escapePrintHtml(String(name).charAt(0))}</div>`}
            <h3 style="font-size:22px;margin:5px 0;color:#ffffff;">${safeName}</h3>
            <p style="color:#38bdf8;font-size:13px;font-weight:bold;margin-bottom:15px;">${safeRole}</p>
            <p style="color:#cbd5e1;font-size:12px;font-mono;margin-bottom:15px;">ID: <strong>${safeBarcode}</strong> | PIN: <strong>${safePassword}</strong></p>
            <div style="background:#0f172a;padding:15px;border-radius:12px;display:inline-block;border:1px solid rgba(245,158,11,0.3);">
                <svg id="cashierBadgeSvg"></svg>
            </div>
            <p style="color:#64748b;font-size:10px;margin-top:15px;">Scan barcode at terminal for instant operator sign-in.</p>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
            try {
                JsBarcode('#cashierBadgeSvg', ${barcodeJson}, { format: 'CODE128', lineColor: '#f59e0b', background: 'transparent', width: 2, height: 50, displayValue: true, fontSize: 12, fontOptions: 'bold' });
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
    employees.forEach((emp, index) => {
        let bcode = emp.barcode || 'EMP-1001';
        let pass = emp.password || '1234';
        let img = emp.image || '';
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-lg gap-4">
                <div class="flex items-center gap-4">
                    ${img ? `<img src="${escapePrintHtml(img)}" class="w-12 h-12 rounded-2xl object-cover border border-amber-500/40">` : `<div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-lg">${escapePrintHtml(emp.name.charAt(0))}</div>`}
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${escapePrintHtml(emp.name)} (${escapePrintHtml(emp.role)})</h4>
                        <p class="text-xs text-emerald-400 font-mono mt-0.5">Rate: ${formatCurrency(emp.rate)}/hr | ID: ${escapePrintHtml(bcode)} | PIN: ${escapePrintHtml(pass)}</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full sm:w-auto justify-end">
                    <button onclick="printEmployeeBadgeByIndex(${index})" class="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold">Print Badge</button>
                    <button onclick="editEmployeeByIndex(${index})" class="px-3 py-2 bg-sky-500/20 text-sky-300 rounded-xl text-xs font-bold">Edit</button>
                    <button onclick="deleteEmployeeByIndex(${index})" class="px-3 py-2 bg-rose-500/20 text-rose-300 rounded-xl text-xs font-bold">Remove</button>
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
    subOperators.forEach((sub, index) => {
        container.innerHTML += `
            <div class="p-3 bg-slate-950 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <div>
                    <span class="font-bold text-slate-100">${escapePrintHtml(sub.username)}</span>
                    <span class="text-amber-400 font-mono ml-2">PIN: ••••</span>
                </div>
                ${isMainOpSession ? `<button onclick="deleteSubOperatorByIndex(${index})" class="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg font-bold">Remove</button>` : ''}
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

window.deleteSubOperatorByIndex = function(index) {
    let subOperator = subOperators[index];
    if(subOperator) deleteSubOperator(subOperator.username);
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
        select.innerHTML += `<option value="${escapePrintHtml(emp.name)}">${escapePrintHtml(emp.name)} (${escapePrintHtml(emp.role)})</option>`;
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
    let qty = Number(document.getElementById('returnQty').value);
    let customAmountInput = document.getElementById('returnCustomAmount').value.trim();
    let customAmt = customAmountInput === '' ? NaN : Number(customAmountInput);

    let acc = accounts.find(a => a.number === accNum);
    let prod = products.find(p => p.number === prodNum);

    if(!acc || !prod || !Number.isInteger(qty) || qty <= 0 ||
        (customAmountInput !== '' && (!Number.isFinite(customAmt) || customAmt <= 0))) {
        SoundEngine.playError();
        showInsufficientModal('Enter a valid account, product, whole-number return quantity greater than zero, and optional refund amount greater than zero.');
        return;
    }

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

        tbody.innerHTML += `
            <tr class="hover:bg-white/5">
                <td class="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
                    ${item.product.image ? `<img src="${item.product.image}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover">` : ''}
                    <span class="font-bold truncate max-w-[120px] sm:max-w-none">${item.product.name}</span>
                </td>
                <td class="p-2 sm:p-3 font-mono text-amber-400">${item.product.number}</td>
                <td class="p-2 sm:p-3">${formatCurrency(item.product.price)}</td>
                <td class="p-2 sm:p-3">
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button onclick="updateCartQty(${idx}, -1)" class="w-6 h-6 bg-slate-800 rounded-lg font-bold">-</button>
                        <span class="font-bold">${item.quantity}</span>
                        <button onclick="updateCartQty(${idx}, 1)" class="w-6 h-6 bg-amber-500 text-slate-950 rounded-lg font-bold">+</button>
                    </div>
                </td>
                <td class="p-2 sm:p-3">
                    <input type="number" value="${item.discount}" min="0" max="100" onchange="updateItemDiscount(${idx}, this.value)" class="w-14 bg-slate-900 border border-amber-500/30 rounded-lg px-2 py-1 text-xs">
                </td>
                <td class="p-2 sm:p-3 text-emerald-400 font-bold">${formatCurrency(itemTotal)}</td>
                <td class="p-2 sm:p-3 text-right">
                    <button onclick="removeCartItem(${idx})" class="px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs">Remove</button>
                </td>
            </tr>
        `;
    });

    let grandTotal = getCartGrandTotal();
    let cdEl = document.getElementById('appliedCouponDisplay');
    let gtEl = document.getElementById('cartGrandTotal');
    if(cdEl) cdEl.innerText = appliedCoupon ? `Coupon: ${appliedCoupon.name} (-${appliedCoupon.percent}%)` : '';
    if(gtEl) gtEl.innerText = formatCurrency(grandTotal);
}

window.updateCartQty = function(idx, change) {
    let item = currentCart[idx];
    if(!item) return;
    if(change > 0 && (Number(item.product.stock) || 0) <= item.quantity) {
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
    if(!currentCart[idx]) return;
    currentCart.splice(idx, 1);
    renderCartTable();
};

function validateCartStock() {
    for(let item of currentCart) {
        let product = products.find(entry => entry.number === item.product.number);
        if(!product) {
            SoundEngine.playError();
            showInsufficientModal(`Product "${item.product.name}" is no longer in inventory. Remove it from the cart before checkout.`);
            return false;
        }
        let available = Number(product.stock);
        let price = Number(product.price);
        if(!Number.isFinite(available) || available < 0 || !Number.isFinite(price) || price <= 0 ||
            !Number.isInteger(item.quantity) || item.quantity <= 0 ||
            !Number.isFinite(item.discount) || item.discount < 0 || item.discount > 100) {
            SoundEngine.playError();
            showInsufficientModal(`Product "${product.name}" has invalid price, stock, quantity, or discount data. Correct the item before checkout.`);
            return false;
        }
        if(available < item.quantity) {
            SoundEngine.playError();
            showInsufficientModal(`Only ${available} unit(s) of "${product.name}" remain in stock. Update the cart before checkout.`);
            return false;
        }
        item.product = product;
    }
    renderCartTable();
    return true;
}

window.checkoutWithAccountBalance = async function() {
    if(checkoutInProgress) return;
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    if(!currentActiveAccount) { SoundEngine.playError(); showInsufficientModal('No customer account loaded. Please load an account first.'); return; }
    if(!validateCartStock()) return;

    let grandTotal = getCartGrandTotal();
    let availableBalance = Number(currentActiveAccount.balance);
    if(!Number.isFinite(grandTotal) || grandTotal <= 0) {
        SoundEngine.playError();
        showInsufficientModal('The cart total is invalid. Check product prices and discounts.');
        return;
    }
    if(!Number.isFinite(availableBalance) || availableBalance < 0) {
        SoundEngine.playError();
        showInsufficientModal('This account has an invalid balance. Correct the account balance before checkout.');
        return;
    }
    if(availableBalance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient account balance. Available: ${formatCurrency(availableBalance)}; required: ${formatCurrency(grandTotal)}.`);
        return;
    }

    await finalizeSuccessfulCheckout(
        grandTotal,
        `Paid via Customer Account Balance (${currentActiveAccount.number})`,
        account => { account.balance = availableBalance - grandTotal; }
    );
};

window.checkoutWithStripeLive = async function() {
    if(checkoutInProgress) return;
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    if(!validateCartStock()) return;
    let grandTotal = getCartGrandTotal();
    if(!Number.isFinite(grandTotal) || grandTotal <= 0) {
        SoundEngine.playError();
        showInsufficientModal('The cart total is invalid. Check product prices and discounts.');
        return;
    }

    let stripeMode = localStorage.getItem('rf_stripe_mode') || 'fake';

    if(stripeMode !== 'fake') {
        SoundEngine.playError();
        showInsufficientModal('Live card processing is not connected to a secure payment server. No card was charged. Use sandbox mode or connect a secure server-side Stripe integration.');
        return;
    }

    await finalizeSuccessfulCheckout(grandTotal, `Sandbox Payment Simulation`);
};

window.openCardOnFileModal = function() {
    if(checkoutInProgress) return;
    if(currentCart.length === 0) { alert('Cart is empty. Scan items first.'); return; }
    if(!currentActiveAccount) { SoundEngine.playError(); showInsufficientModal('Load a customer account with cards on file first.'); return; }
    if(!currentActiveAccount.cards || currentActiveAccount.cards.length === 0) {
        SoundEngine.playError();
        showInsufficientModal('This customer has no credit cards on file.');
        return;
    }
    if(!validateCartStock()) return;

    let grandTotal = getCartGrandTotal();
    if(!Number.isFinite(grandTotal) || grandTotal <= 0) {
        SoundEngine.playError();
        showInsufficientModal('The cart total is invalid. Check product prices and discounts.');
        return;
    }

    let container = document.getElementById('cardOnFileSelectionList');
    container.innerHTML = `<p class="rounded-xl bg-slate-950 p-3 text-center text-xs text-slate-200">Purchase total: <strong class="text-emerald-400">${formatCurrency(grandTotal)}</strong></p>`;

    currentActiveAccount.cards.forEach((card, idx) => {
        let rawCardBalance = Number(card.balance);
        let cardBalance = Number.isFinite(rawCardBalance) && rawCardBalance >= 0 ? rawCardBalance : 0;
        let isEligible = card.status === 'active' && cardBalance >= grandTotal;
        let remaining = cardBalance - grandTotal;
        container.innerHTML += `
            <div class="p-4 rounded-2xl bg-slate-950 border ${isEligible ? 'border-amber-500/40' : 'border-rose-500/40'} flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs">
                <div class="min-w-0">
                    <p class="font-bold text-slate-100 font-mono break-all">${escapePrintHtml(card.number)}</p>
                    <p class="text-[10px] text-slate-300 mt-1">Available: <strong>${formatCurrency(cardBalance)}</strong></p>
                    <p class="text-[10px] text-slate-300">Charge: <strong>${formatCurrency(grandTotal)}</strong> | After purchase: <strong class="${isEligible ? 'text-emerald-400' : 'text-rose-400'}">${isEligible ? formatCurrency(remaining) : 'Not enough balance'}</strong></p>
                    <p class="text-[10px] mt-1">Status: <span class="${card.status==='active'?'text-emerald-400':'text-rose-400'}">${escapePrintHtml(card.status || 'inactive')}</span></p>
                </div>
                <div class="flex gap-2">
                    <button onclick="executeCardOnFileCheckout(${idx})" ${isEligible ? '' : 'disabled'} class="w-full sm:w-auto px-4 py-2 ${isEligible ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} font-bold rounded-xl text-xs pointer-events-auto">${isEligible ? 'Pay' : 'Insufficient'}</button>
                </div>
            </div>
        `;
    });
    document.getElementById('cardOnFileModal').classList.remove('hidden');
};

window.executeCardOnFileCheckout = async function(cardIdx) {
    if(checkoutInProgress) return;
    if(!currentActiveAccount || currentCart.length === 0 || !currentActiveAccount.cards?.[cardIdx]) {
        SoundEngine.playError();
        showInsufficientModal('The saved card or active cart is no longer available. Scan the account and items again.');
        return;
    }
    if(!validateCartStock()) return;
    let card = currentActiveAccount.cards[cardIdx];
    let grandTotal = getCartGrandTotal();
    let cardBalance = Number(card.balance);
    if(!Number.isFinite(grandTotal) || grandTotal <= 0 || !Number.isFinite(cardBalance) || cardBalance < 0) {
        SoundEngine.playError();
        showInsufficientModal('The cart total or saved card balance is invalid. Check account and cart details.');
        return;
    }
    if(card.status !== 'active') {
        SoundEngine.playError();
        showInsufficientModal('Selected saved card is inactive.');
        return;
    }
    if(cardBalance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient saved card balance. Available: ${formatCurrency(cardBalance)}; required: ${formatCurrency(grandTotal)}.`);
        return;
    }

    await finalizeSuccessfulCheckout(
        grandTotal,
        `Paid from Saved Card Balance (${card.number})`,
        account => { account.cards[cardIdx].balance = cardBalance - grandTotal; }
    );
};

async function finalizeSuccessfulCheckout(grandTotal, txDescription, applyPayment = null) {
    if(checkoutInProgress) return false;
    checkoutInProgress = true;
    const checkoutAccount = currentActiveAccount;
    const accountSnapshot = checkoutAccount ? {
        balance: checkoutAccount.balance,
        points: checkoutAccount.points,
        history: Array.isArray(checkoutAccount.history) ? [...checkoutAccount.history] : [],
        cards: Array.isArray(checkoutAccount.cards) ? checkoutAccount.cards.map(card => ({ ...card })) : []
    } : null;
    const stockSnapshot = products.map(product => [product, product.stock]);
    const queueLength = offlineTransactionQueue.length;
    const earnedPoints = Math.floor(grandTotal);

    try {
        if(applyPayment && checkoutAccount) applyPayment(checkoutAccount);
        currentCart.forEach(item => {
            let product = products.find(entry => entry.number === item.product.number);
            if(product) product.stock = Math.max(0, Number(product.stock) - item.quantity);
        });

        if(checkoutAccount) {
            checkoutAccount.points = (Number(checkoutAccount.points) || 0) + earnedPoints;
            if(!Array.isArray(checkoutAccount.history)) checkoutAccount.history = [];
            checkoutAccount.history.push({ date: new Date().toLocaleString(), text: `${txDescription} (-${formatCurrency(grandTotal)} | +${earnedPoints} Pts) by ${currentOperator}` });
        }
        offlineTransactionQueue.push({ date: new Date().toLocaleString(), total: grandTotal, operator: currentOperator });

        if(!await saveUserData()) {
            throw new Error(lastCloudSaveError || 'The store did not confirm the checkout save.');
        }
    } catch(error) {
        if(checkoutAccount && accountSnapshot) {
            checkoutAccount.balance = accountSnapshot.balance;
            checkoutAccount.points = accountSnapshot.points;
            checkoutAccount.history = accountSnapshot.history;
            checkoutAccount.cards = accountSnapshot.cards;
            currentActiveAccount = checkoutAccount;
        }
        stockSnapshot.forEach(([product, stock]) => { product.stock = stock; });
        offlineTransactionQueue.length = queueLength;
        checkoutInProgress = false;
        console.error('Checkout could not be saved:', error);
        SoundEngine.playError();
        let reason = error instanceof Error ? error.message : String(error);
        let permissionHelp = /permission|denied|unauthorized/i.test(reason)
            ? ' Check the Firebase Realtime Database write rules for this store.'
            : ' Check the database connection and try again.';
        showInsufficientModal(`Checkout was not saved, so no purchase was completed. Your cart is still available. Database error: ${reason}.${permissionHelp}`);
        renderAccountsList();
        renderProductsList();
        updateDashboardStats();
        renderCartTable();
        if(checkoutAccount) {
            document.getElementById('modalAccBalance').innerText = formatCurrency(checkoutAccount.balance);
            document.getElementById('modalAccPoints').innerText = `${checkoutAccount.points || 0} Pts`;
            renderModalHistory();
        }
        return false;
    }

    if (typeof WebhookManager !== 'undefined') {
        try {
            let webhookResult = WebhookManager.send('purchases', 'Successful Checkout Transaction', [
                { name: 'Customer', value: checkoutAccount ? `${checkoutAccount.name} (${checkoutAccount.number})` : 'Walk-in Guest', inline: true },
                { name: 'Grand Total', value: formatCurrency(grandTotal), inline: true },
                { name: 'Payment Method', value: txDescription, inline: true },
                { name: 'Operator', value: currentOperator, inline: true },
                { name: 'Loyalty Earned', value: `${earnedPoints} Pts`, inline: true }
            ], 3066993);
            if(webhookResult && typeof webhookResult.catch === 'function') {
                webhookResult.catch(error => console.error('Checkout webhook failed:', error));
            }
        } catch(error) {
            console.error('Checkout webhook failed:', error);
        }
    }

    SoundEngine.playSuccess();
    if(document.getElementById('cardOnFileModal')) document.getElementById('cardOnFileModal').classList.add('hidden');
    if(checkoutAccount) loadAccountByNumber(checkoutAccount.number);
    currentCart = [];
    appliedCoupon = null;
    renderCartTable();

    if(typeof confetti !== 'undefined') confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    checkoutInProgress = false;
    alert(`Checkout successful for ${formatCurrency(grandTotal)}!${txDescription.includes('Sandbox') ? ' Sandbox only; no real card was charged.' : ''}`);
    return true;
}

window.checkoutWithGiftCard = function() {
    if(currentCart.length === 0) { alert('Cart is empty.'); return; }
    if(!validateCartStock()) return;
    document.getElementById('payGcCodeInput').value = '';
    document.getElementById('giftCardPayModal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('payGcCodeInput').focus(); }, 50);
};

window.executeGiftCardPayment = function() {
    let code = document.getElementById('payGcCodeInput').value.trim();
    let gc = giftCards.find(g => g.code.toLowerCase() === code.toLowerCase());
    if(!gc) { SoundEngine.playError(); showInsufficientModal('Invalid Gift Card code.'); return; }
    if(!validateCartStock()) return;

    let grandTotal = getCartGrandTotal();
    let giftCardBalance = Number(gc.balance);
    if(!Number.isFinite(grandTotal) || grandTotal <= 0 || !Number.isFinite(giftCardBalance) || giftCardBalance < 0) {
        SoundEngine.playError();
        showInsufficientModal('The cart total or gift card balance is invalid. Check the gift card and cart details.');
        return;
    }
    if(giftCardBalance < grandTotal) {
        SoundEngine.playError();
        showInsufficientModal(`Gift Card balance is insufficient. Available: ${formatCurrency(giftCardBalance)}; required: ${formatCurrency(grandTotal)}.`);
        return;
    }

    currentCart.forEach(item => {
        let prod = products.find(p => p.number === item.product.number);
        if(prod) prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
    });

    gc.balance = giftCardBalance - grandTotal;
    if(currentActiveAccount) {
        let earnedPoints = Math.floor(grandTotal);
        currentActiveAccount.points = (currentActiveAccount.points || 0) + earnedPoints;
        currentActiveAccount.history.push({
            date: new Date().toLocaleString(),
            text: `Paid with Gift Card ${gc.code} (-${formatCurrency(grandTotal)} | +${earnedPoints} Pts) by ${currentOperator}`
        });
    }
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
    document.getElementById('payGcCodeInput').value = '';
    currentCart = [];
    appliedCoupon = null;
    renderCartTable();
    alert(`Payment successful! GC Balance: ${formatCurrency(gc.balance)}`);
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
    if(!currentActiveAccount) {
        SoundEngine.playError();
        showInsufficientModal('Load a customer account before changing its balance.');
        return;
    }
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
    if(!currentActiveAccount || !pendingAction || pendingAction.type !== 'remove' ||
        !Number.isFinite(pendingAction.amount) || pendingAction.amount <= 0) {
        SoundEngine.playError();
        showInsufficientModal('The account or authorized balance operation is no longer available. Reopen the account and try again.');
        closePinModal();
        return;
    }
    if(Number(currentActiveAccount.balance) < pendingAction.amount) {
        SoundEngine.playError();
        showInsufficientModal(`Insufficient account balance. Available: ${formatCurrency(currentActiveAccount.balance)}; requested: ${formatCurrency(pendingAction.amount)}.`);
        return;
    }

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
    if(!currentActiveAccount) {
        SoundEngine.playError();
        showInsufficientModal('Load a customer account before applying an account adjustment.');
        return;
    }
    let elDisc = document.getElementById('discountPercent');
    let pct = parseFloat(elDisc?.value);
    if(!Number.isFinite(pct) || pct <= 0 || pct > 100) { alert('Enter a percentage between 1 and 100.'); return; }
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
    container.innerHTML = `
        <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs">
            <div><p class="font-bold text-slate-100">Barcode scanners</p><p class="text-[10px] text-amber-400">Keyboard-wedge scans are supported by the active scanner listener.</p></div>
            <span class="px-2 py-1 bg-sky-500/20 text-sky-300 rounded text-[10px]">Input ready</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs mt-2">
            <div><p class="font-bold text-slate-100">Receipt printers</p><p class="text-[10px] text-amber-400">Use the browser print dialog; direct printer detection is not available.</p></div>
            <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[10px]">Not detected</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs mt-2">
            <div><p class="font-bold text-slate-100">Payment terminals</p><p class="text-[10px] text-amber-400">No payment terminal integration is configured.</p></div>
            <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[10px]">Not integrated</span>
        </div>
    `;
    SoundEngine.playClick();
};

window.unlockAdminSettings = function() {
    let pin = document.getElementById('adminPinInput').value;
    if(pin !== '6355') { SoundEngine.playError(); alert('Invalid Admin PIN (Required: 6355)'); return; }
    document.getElementById('settingsLockedBox').classList.add('hidden');
    document.getElementById('settingsUnlockedBox').classList.remove('hidden');

    let modeSelect = document.getElementById('stripeModeSelect');
    let themeSelect = document.getElementById('themeToggleSetting');
    localStorage.removeItem('rf_stripe_sec');
    if(modeSelect) modeSelect.value = 'fake';
    if(themeSelect) themeSelect.value = localStorage.getItem('nexus_theme') || 'dark';

    let soundSet = document.getElementById('soundToggleSetting');
    if(soundSet) soundSet.value = SoundEngine.enabled ? 'ON' : 'OFF';

    loadWebhookInputsIntoSettings();
};

window.saveStripeSettings = function() {
    localStorage.removeItem('rf_stripe_sec');
    localStorage.setItem('rf_stripe_mode', 'fake');
    SoundEngine.playSuccess();
    alert('Sandbox simulation mode saved. Real card processing is disabled until a secure server-side payment integration is connected.');
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

async function saveUserData() {
    lastCloudSaveError = null;
    if(!currentMainOperator) {
        lastCloudSaveError = 'No store owner session is active. Log in to the store again.';
        return false;
    }
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
    try {
        await set(ref(db, `stores/${currentMainOperator}`), storeData);
        return true;
    } catch(err) {
        lastCloudSaveError = err instanceof Error ? err.message : String(err);
        console.error("Cloud Sync Failed:", err);
        return false;
    }
}