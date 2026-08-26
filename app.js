// Multi-User & State Management
let operators = JSON.parse(localStorage.getItem('rf_operators')) || [];
let currentOperator = localStorage.getItem('rf_current_operator') || null;

let accounts = [];
let products = [];
let currentActiveAccount = null;
let currentCart = [];
let pendingAction = null;

// Initialization & Auth Routing
window.onload = function() {
    renderAuthScreen();
    setupSafeKeybinds();
    lucide.createIcons();
};

function renderAuthScreen() {
    let container = document.getElementById('authFormContainer');
    container.innerHTML = '';

    if(operators.length === 0) {
        document.getElementById('authSubtitle').innerText = 'Welcome! Create your initial operator username and 4-digit PIN.';
        container.innerHTML = `
            <form onsubmit="handleInitialRegister(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Username *</label>
                    <input type="text" id="regUser" required class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-400 shadow-inner" placeholder="e.g. Administrator">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">4-Digit PIN *</label>
                    <input type="password" id="regPin" maxlength="4" required class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm tracking-widest focus:outline-none focus:border-amber-400 shadow-inner" placeholder="••••">
                </div>
                <button type="submit" class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/25 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-wider text-xs">Create & Enter (Press Enter)</button>
            </form>
        `;
    } else {
        document.getElementById('authSubtitle').innerText = 'Select or enter your operator credentials.';
        container.innerHTML = `
            <form onsubmit="handleLogin(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">Select Operator</label>
                    <select id="loginUserSelect" class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-400 cursor-pointer">
                        ${operators.map(op => `<option value="${op.username}">${op.username}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">4-Digit PIN *</label>
                    <input type="password" id="loginPin" maxlength="4" required class="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-3 text-slate-200 text-sm tracking-widest focus:outline-none focus:border-amber-400 shadow-inner" placeholder="••••">
                </div>
                <button type="submit" class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/25 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-wider text-xs">Login to Terminal (Press Enter)</button>
            </form>
        `;
    }
}

function handleInitialRegister(e) {
    e.preventDefault();
    let username = document.getElementById('regUser').value.trim();
    let pin = document.getElementById('regPin').value.trim();
    if(!username || pin.length !== 4) {
        alert('Please enter a valid username and 4-digit PIN.');
        return;
    }
    operators.push({ username, pin });
    localStorage.setItem('rf_operators', JSON.stringify(operators));
    loginOperator(username);
}

function handleLogin(e) {
    e.preventDefault();
    let username = document.getElementById('loginUserSelect').value;
    let pin = document.getElementById('loginPin').value.trim();
    let op = operators.find(o => o.username === username);
    if(!op || op.pin !== pin) {
        alert('Invalid PIN code.');
        return;
    }
    loginOperator(username);
}

function loginOperator(username) {
    currentOperator = username;
    localStorage.setItem('rf_current_operator', username);
    loadUserStorage();
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('currentOperatorName').innerText = username;
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    updateDashboardStats();
    renderAccountsList();
    renderProductsList();
    renderOperatorsAdminList();
    lucide.createIcons();
}

function logoutOperator() {
    currentOperator = null;
    localStorage.removeItem('rf_current_operator');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    renderAuthScreen();
}

function loadUserStorage() {
    let keyAcc = `rf_accounts_${currentOperator}`;
    let keyProd = `rf_products_${currentOperator}`;
    accounts = JSON.parse(localStorage.getItem(keyAcc)) || [
        { number: 'ACC-1001', name: 'Victoria Sterling', email: 'victoria@royal.com', balance: 2500.00, info: 'VIP Platinum Member', history: [{date: new Date().toLocaleString(), text: 'Account initialized with $2500.00'}] }
    ];
    products = JSON.parse(localStorage.getItem(keyProd)) || [
        { number: 'P-101', name: 'Royal Crown Elixir', price: 150.00, image: '' }
    ];
}

function saveUserData() {
    if(!currentOperator) return;
    localStorage.setItem(`rf_accounts_${currentOperator}`, JSON.stringify(accounts));
    localStorage.setItem(`rf_products_${currentOperator}`, JSON.stringify(products));
    updateDashboardStats();
    renderAccountsList();
    renderProductsList();
}

// Safe Function-Key Keybindings Engine (No Chrome conflicts)
function setupSafeKeybinds() {
    window.addEventListener('keydown', (e) => {
        let authHidden = document.getElementById('authScreen').classList.contains('hidden');
        if(!authHidden) {
            if(e.key === 'Enter') {
                let form = document.querySelector('#authScreen form');
                if(form) form.requestSubmit();
            }
            return;
        }

        let isModalOpen = !document.getElementById('accountModal').classList.contains('hidden');
        let isPinOpen = !document.getElementById('pinModal').classList.contains('hidden');
        let isInsufficientOpen = !document.getElementById('insufficientModal').classList.contains('hidden');

        if(e.key === 'Escape') {
            if(isPinOpen) closePinModal();
            else if(isInsufficientOpen) closeInsufficientModal();
            else if(isModalOpen) closeAccountModal();
            return;
        }

        if(e.key === 'Enter') {
            if(isPinOpen) { verifyPinAndExecute(); e.preventDefault(); return; }
            if(isInsufficientOpen) { closeInsufficientModal(); e.preventDefault(); return; }
            if(isModalOpen) {
                let cartInput = document.getElementById('cartProdNumInput');
                if(document.activeElement === cartInput) {
                    addProductToCart(cartInput.value.trim());
                    e.preventDefault();
                    return;
                }
            }
            let loadInput = document.getElementById('loadAccNumInput');
            if(document.activeElement === loadInput) {
                loadAccountByNumber(loadInput.value.trim());
                e.preventDefault();
                return;
            }
            let quickInput = document.getElementById('quickSearchInput');
            if(document.activeElement === quickInput) {
                executeQuickSearch();
                e.preventDefault();
                return;
            }
        }

        // Safe Function keys
        if(e.key === 'F1') { e.preventDefault(); switchTab('dashboard'); }
        if(e.key === 'F2') { e.preventDefault(); switchTab('accounts'); }
        if(e.key === 'F3') { e.preventDefault(); switchTab('createAccount'); }
        if(e.key === 'F4') { e.preventDefault(); switchTab('products'); }
        if(e.key === 'F5') { e.preventDefault(); switchTab('keybinds'); }
        if(e.key === 'F6') { e.preventDefault(); switchTab('settings'); }
    });
}

// Tab Navigation
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gradient-to-r', 'from-amber-500/25', 'to-amber-500/5', 'text-amber-300', 'border-l-4', 'border-amber-400', 'shadow-lg', 'scale-[1.02]');
        btn.classList.add('text-slate-400');
        if(btn.dataset.tab === tabId) {
            btn.classList.add('bg-gradient-to-r', 'from-amber-500/25', 'to-amber-500/5', 'text-amber-300', 'border-l-4', 'border-amber-400', 'shadow-lg', 'scale-[1.02]');
            btn.classList.remove('text-slate-400');
        }
    });
    lucide.createIcons();
}

// Dashboard & Stats
function updateDashboardStats() {
    document.getElementById('statTotalAccounts').innerText = accounts.length;
    let totalCap = accounts.reduce((acc, curr) => acc + curr.balance, 0);
    document.getElementById('statTotalCapital').innerText = `$${totalCap.toFixed(2)}`;
    document.getElementById('statTotalProducts').innerText = products.length;
}

function executeQuickSearch() {
    let query = document.getElementById('quickSearchInput').value.trim().toLowerCase();
    let found = accounts.find(a => a.number.toLowerCase() === query || a.name.toLowerCase().includes(query));
    if(found) loadAccountByNumber(found.number);
    else alert('Account not found.');
}

// Account Management
function handleCreateAccount(e) {
    e.preventDefault();
    let number = document.getElementById('newAccNumber').value.trim();
    let name = document.getElementById('newAccName').value.trim();
    let email = document.getElementById('newAccEmail').value.trim();
    let balance = parseFloat(document.getElementById('newAccBalance').value);
    let info = document.getElementById('newAccInfo').value.trim();

    if(accounts.some(a => a.number === number)) {
        alert('Account number already exists!');
        return;
    }

    accounts.push({
        number, name, email, balance, info,
        history: [{ date: new Date().toLocaleString(), text: `Account created with initial balance $${balance.toFixed(2)}` }]
    });

    saveUserData();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    e.target.reset();
    switchTab('accounts');
}

function renderAccountsList(filter = '') {
    let container = document.getElementById('accountsGrid');
    container.innerHTML = '';
    let filtered = accounts.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()) || a.number.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(acc => {
        container.innerHTML += `
            <div class="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-amber-500/20 hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-4 shadow-xl">
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/25">${acc.number}</span>
                        <span class="text-emerald-400 font-black text-lg">$${acc.balance.toFixed(2)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-slate-100">${acc.name}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">${acc.email}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="loadAccountByNumber('${acc.number}')" class="flex-1 py-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-2xl text-xs hover:bg-amber-500/30 transition-all">Load Account</button>
                    <button onclick="deleteAccount('${acc.number}')" class="px-3 py-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold rounded-2xl text-xs hover:bg-rose-500/30 transition-all" title="Delete Account">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function filterAccountList(val) {
    renderAccountsList(val);
}

function loadAccountByNumber(num) {
    let acc = accounts.find(a => a.number === num);
    if(!acc) {
        alert('Account not found!');
        return;
    }
    currentActiveAccount = acc;
    currentCart = [];

    document.getElementById('modalAvatar').innerText = acc.name.charAt(0);
    document.getElementById('modalAccName').innerText = acc.name;
    document.getElementById('modalAccNum').innerText = acc.number;
    document.getElementById('modalAccEmail').innerText = acc.email;
    document.getElementById('modalAccBalance').innerText = `$${acc.balance.toFixed(2)}`;
    document.getElementById('modalAccInfoText').innerText = acc.info || 'No notes';

    renderModalHistory();
    renderCartTable();
    document.getElementById('accountModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.add('hidden');
    currentActiveAccount = null;
    currentCart = [];
}

function deleteAccount(num) {
    let acc = accounts.find(a => a.number === num);
    if(confirm(`Are you sure you want to delete account "${acc ? acc.name : num}"?`)) {
        accounts = accounts.filter(a => a.number !== num);
        saveUserData();
        if(currentActiveAccount && currentActiveAccount.number === num) closeAccountModal();
    }
}

function deleteCurrentAccount() {
    if(currentActiveAccount) deleteAccount(currentActiveAccount.number);
}

function renderModalHistory() {
    let container = document.getElementById('modalHistoryList');
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

// POS Cart & Products
function addProductToCart(prodNum) {
    let prod = products.find(p => p.number === prodNum);
    if(!prod) {
        alert(`Product number "${prodNum}" not found in catalog.`);
        return;
    }
    let existingItem = currentCart.find(i => i.product.number === prodNum);
    if(existingItem) existingItem.quantity += 1;
    else currentCart.push({ product: prod, quantity: 1, discount: 0 });
    document.getElementById('cartProdNumInput').value = '';
    renderCartTable();
}

function renderCartTable() {
    let tbody = document.getElementById('cartItemsTableBody');
    tbody.innerHTML = '';
    let grandTotal = 0;

    if(currentCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Cart is empty. Enter product number above and press Enter.</td></tr>`;
        document.getElementById('cartGrandTotal').innerText = `$0.00`;
        return;
    }

    currentCart.forEach((item, idx) => {
        let itemTotal = (item.product.price * item.quantity) * (1 - (item.discount / 100));
        grandTotal += itemTotal;

        tbody.innerHTML += `
            <tr class="hover:bg-white/5">
                <td class="p-3 flex items-center gap-3">
                    ${item.product.image ? `<img src="${item.product.image}" class="w-8 h-8 rounded-lg object-cover">` : ''}
                    <span class="font-bold">${item.product.name}</span>
                </td>
                <td class="p-3 font-mono text-amber-400">${item.product.number}</td>
                <td class="p-3">$${item.product.price.toFixed(2)}</td>
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
                <td class="p-3 text-emerald-400 font-bold">$${itemTotal.toFixed(2)}</td>
                <td class="p-3 text-right">
                    <button onclick="removeCartItem(${idx})" class="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs">Remove</button>
                </td>
            </tr>
        `;
    });
    document.getElementById('cartGrandTotal').innerText = `$${grandTotal.toFixed(2)}`;
}

function updateCartQty(idx, change) {
    currentCart[idx].quantity += change;
    if(currentCart[idx].quantity <= 0) currentCart.splice(idx, 1);
    renderCartTable();
}

function updateItemDiscount(idx, val) {
    currentCart[idx].discount = Math.max(0, Math.min(100, parseFloat(val) || 0));
    renderCartTable();
}

function removeCartItem(idx) {
    currentCart.splice(idx, 1);
    renderCartTable();
}

function checkoutCart() {
    let grandTotal = currentCart.reduce((sum, item) => sum + ((item.product.price * item.quantity) * (1 - (item.discount / 100))), 0);
    if(grandTotal <= 0) { alert('Cart is empty.'); return; }
    if(currentActiveAccount.balance < grandTotal) {
        showInsufficientModal(`Account balance ($${currentActiveAccount.balance.toFixed(2)}) is insufficient for grand total ($${grandTotal.toFixed(2)}).`);
        return;
    }

    currentActiveAccount.balance -= grandTotal;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Completed cart checkout (-$${grandTotal.toFixed(2)})` });
    saveUserData();
    loadAccountByNumber(currentActiveAccount.number);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
}

// Financial Operations & PIN (2285)
function promptMoneyAction(type) {
    let amt = parseFloat(document.getElementById('transAmount').value);
    if(isNaN(amt) || amt <= 0) { alert('Enter a valid amount.'); return; }
    if(type === 'remove') {
        pendingAction = { type, amount: amt };
        document.getElementById('pinInput').value = '';
        document.getElementById('pinModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('pinInput').focus(), 50);
    } else {
        currentActiveAccount.balance += amt;
        currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Added $${amt.toFixed(2)}` });
        saveUserData();
        loadAccountByNumber(currentActiveAccount.number);
        document.getElementById('transAmount').value = '';
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
    }
}

function closePinModal() {
    document.getElementById('pinModal').classList.add('hidden');
    pendingAction = null;
}

function verifyPinAndExecute() {
    let pin = document.getElementById('pinInput').value;
    if(pin !== '2285') { alert('Invalid Security PIN! Access denied.'); return; }
    if(currentActiveAccount.balance < pendingAction.amount) {
        closePinModal();
        showInsufficientModal(`Cannot remove $${pendingAction.amount.toFixed(2)}. Balance is $${currentActiveAccount.balance.toFixed(2)}.`);
        return;
    }
    currentActiveAccount.balance -= pendingAction.amount;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Removed $${pendingAction.amount.toFixed(2)} (Authorized)` });
    saveUserData();
    loadAccountByNumber(currentActiveAccount.number);
    closePinModal();
    document.getElementById('transAmount').value = '';
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
}

function applyDiscount() {
    let pct = parseFloat(document.getElementById('discountPercent').value);
    if(isNaN(pct) || pct <= 0) { alert('Enter valid discount percentage.'); return; }
    let discountVal = (currentActiveAccount.balance * (pct / 100));
    currentActiveAccount.balance -= discountVal;
    currentActiveAccount.history.push({ date: new Date().toLocaleString(), text: `Applied ${pct}% account discount (-$${discountVal.toFixed(2)})` });
    saveUserData();
    loadAccountByNumber(currentActiveAccount.number);
    document.getElementById('discountPercent').value = '';
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
}

function showInsufficientModal(msg) {
    document.getElementById('insufficientMsg').innerText = msg;
    document.getElementById('insufficientModal').classList.remove('hidden');
    lucide.createIcons();
}
function closeInsufficientModal() {
    document.getElementById('insufficientModal').classList.add('hidden');
}

// Products Catalog
function handleCreateProduct(e) {
    e.preventDefault();
    let number = document.getElementById('prodNumber').value.trim();
    let name = document.getElementById('prodName').value.trim();
    let price = parseFloat(document.getElementById('prodPrice').value);
    let fileInput = document.getElementById('prodImageFile');

    let reader = new FileReader();
    let saveProd = (imgData = '') => {
        products.push({ number, name, price, image: imgData });
        saveUserData();
        e.target.reset();
        alert('Product registered successfully!');
    };

    if(fileInput.files && fileInput.files[0]) {
        reader.onload = function(evt) { saveProd(evt.target.result); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        saveProd();
    }
}

function deleteProduct(num) {
    let prod = products.find(p => p.number === num);
    if(confirm(`Are you sure you want to delete product "${prod ? prod.name : num}"?`)) {
        products = products.filter(p => p.number !== num);
        saveUserData();
    }
}

function renderProductsList() {
    let container = document.getElementById('productsListContainer');
    container.innerHTML = '';
    if(products.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">No products registered yet.</div>`;
        return;
    }
    products.forEach(p => {
        container.innerHTML += `
            <div class="p-4 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-amber-500/20 flex items-center justify-between shadow-lg">
                <div class="flex items-center gap-4">
                    ${p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-xl object-cover">` : `<div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">${p.number}</div>`}
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${p.name}</h4>
                        <p class="text-xs text-amber-400 font-mono mt-0.5">Item #: ${p.number} | <strong class="text-emerald-400">$${p.price.toFixed(2)}</strong></p>
                    </div>
                </div>
                <button onclick="deleteProduct('${p.number}')" class="px-3 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold rounded-2xl text-xs hover:bg-rose-500/30 transition-all">Delete</button>
            </div>
        `;
    });
}

// Admin Settings (PIN 6355)
function unlockAdminSettings() {
    let pin = document.getElementById('adminPinInput').value;
    if(pin !== '6355') { alert('Invalid Admin PIN! Required code: 6355'); return; }
    document.getElementById('settingsLockedBox').classList.add('hidden');
    document.getElementById('settingsUnlockedBox').classList.remove('hidden');
    renderOperatorsAdminList();
}

function renderOperatorsAdminList() {
    let container = document.getElementById('operatorsListContainer');
    let selectSource = document.getElementById('cloneSourceUser');
    if(!container || !selectSource) return;

    container.innerHTML = `<h5 class="text-xs font-bold text-slate-300 mt-4 mb-2">Existing Operators</h5>`;
    selectSource.innerHTML = '';

    operators.forEach(op => {
        selectSource.innerHTML += `<option value="${op.username}">${op.username}</option>`;
        container.innerHTML += `
            <div class="p-3 bg-slate-900 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <span class="font-bold text-amber-300">${op.username}</span>
                ${operators.length > 1 ? `<button onclick="deleteOperator('${op.username}')" class="px-2 py-1 bg-rose-500/20 text-rose-300 rounded-lg">Delete</button>` : `<span class="text-slate-500">Master</span>`}
            </div>
        `;
    });
}

function adminCreateOperator() {
    let user = document.getElementById('adminNewUser').value.trim();
    let pin = document.getElementById('adminNewPin').value.trim();
    if(!user || pin.length !== 4) { alert('Enter valid username and 4-digit PIN.'); return; }
    if(operators.some(o => o.username === user)) { alert('Operator already exists.'); return; }
    operators.push({ username: user, pin });
    localStorage.setItem('rf_operators', JSON.stringify(operators));
    document.getElementById('adminNewUser').value = '';
    document.getElementById('adminNewPin').value = '';
    renderOperatorsAdminList();
    alert('Operator created successfully.');
}

function adminCloneOperator() {
    let source = document.getElementById('cloneSourceUser').value;
    let newUser = document.getElementById('cloneNewUser').value.trim();
    let newPin = document.getElementById('cloneNewPin').value.trim();
    if(!newUser || newPin.length !== 4) { alert('Enter valid new username and 4-digit PIN.'); return; }
    if(operators.some(o => o.username === newUser)) { alert('Operator already exists.'); return; }

    let srcAcc = localStorage.getItem(`rf_accounts_${source}`) || '[]';
    let srcProd = localStorage.getItem(`rf_products_${source}`) || '[]';
    localStorage.setItem(`rf_accounts_${newUser}`, srcAcc);
    localStorage.setItem(`rf_products_${newUser}`, srcProd);

    operators.push({ username: newUser, pin: newPin });
    localStorage.setItem('rf_operators', JSON.stringify(operators));
    document.getElementById('cloneNewUser').value = '';
    document.getElementById('cloneNewPin').value = '';
    renderOperatorsAdminList();
    alert(`Successfully cloned vault data from "${source}" to "${newUser}"!`);
}

function deleteOperator(username) {
    if(operators.length <= 1) { alert('Cannot delete last operator.'); return; }
    if(confirm(`Delete operator "${username}"?`)) {
        operators = operators.filter(o => o.username !== username);
        localStorage.setItem('rf_operators', JSON.stringify(operators));
        localStorage.removeItem(`rf_accounts_${username}`);
        localStorage.removeItem(`rf_products_${username}`);
        renderOperatorsAdminList();
    }
}

function clearAllSystemData() {
    if(confirm('Are you sure you want to wipe current operator storage?')) {
        localStorage.removeItem(`rf_accounts_${currentOperator}`);
        localStorage.removeItem(`rf_products_${currentOperator}`);
        location.reload();
    }
}

function changeTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    document.getElementById('themeSelector').value = themeName;
}