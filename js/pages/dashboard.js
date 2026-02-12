/**
 * dashboard.js — Lógica do Dashboard do Cliente
 * 
 * Sections: Nova Recarga, Pedidos, Extrato, Minha Conta
 * Mobile-first: bottom nav (no sidebar on mobile)
 * 
 * Depende de: api.js, auth.js (carregados antes desse script)
 */

// =============================================================================
// Estado
// =============================================================================

const DashboardState = {
    user: null,
    balance: 0,
    // Pedidos
    ordersPage: 1,
    ordersLimit: 10,
    ordersFilter: null,
    // Extrato
    depositsPage: 1,
    depositsLimit: 10,
    depositsFilter: null,
    // Recarga
    selectedOperator: null,
    selectedRechargeAmount: null,
    // Depósito
    selectedDepositAmount: null,
};


// =============================================================================
// Inicialização
// =============================================================================

async function initDashboard() {
    if (!requireAuth()) return;

    const user = getStoredUser();
    if (user && user.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }

    await Promise.all([
        loadUserProfile(),
        loadWalletBalance(),
    ]);

    showSection('inicio');
}


// =============================================================================
// Navegação
// =============================================================================

function showSection(sectionId) {
    // Seções
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const section = document.getElementById(`section-${sectionId}`);
    if (section) section.classList.add('active');

    // Nav sidebar (desktop)
    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${sectionId}`);
    if (navItem) navItem.classList.add('active');

    // Bottom nav (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    const bnavItem = document.getElementById(`bnav-${sectionId}`);
    if (bnavItem) bnavItem.classList.add('active');

    // Títulos
    const titles = {
        inicio: { title: 'Nova Recarga', subtitle: 'Recarregue seu celular de forma rápida' },
        pedidos: { title: 'Histórico de Pedidos', subtitle: 'Ver todas as recargas realizadas' },
        extrato: { title: 'Extrato de Depósitos', subtitle: 'Entradas e saídas de saldo' },
        perfil: { title: 'Minha Conta', subtitle: 'Gerencie seus dados pessoais e preferências' },
    };

    const info = titles[sectionId];
    if (info) {
        document.getElementById('page-title').textContent = info.title;
        document.getElementById('page-subtitle').textContent = info.subtitle;
    }

    // Carregar dados sob demanda
    if (sectionId === 'pedidos') {
        DashboardState.ordersPage = 1;
        loadOrderHistory();
    }
    if (sectionId === 'extrato') {
        DashboardState.depositsPage = 1;
        loadDepositHistory();
    }
}


// =============================================================================
// Perfil
// =============================================================================

async function loadUserProfile() {
    try {
        const profile = await apiGetProfile();
        DashboardState.user = profile;
        storeUser(profile);

        // Sidebar (desktop only)
        const nameEl = document.getElementById('sidebar-user-name');
        const avatarEl = document.getElementById('sidebar-user-avatar');
        const emailEl = document.getElementById('sidebar-user-email');
        if (nameEl) nameEl.textContent = profile.name || 'Usuário';
        if (avatarEl) avatarEl.textContent = getInitials(profile.name);
        if (emailEl) emailEl.textContent = profile.email || '';

        // Topbar
        const topName = document.getElementById('topbar-user-name');
        if (topName) topName.textContent = profile.name;

        // Profile page
        updateProfileSection(profile);

        // Reseller CTA
        updateResellerCTA(profile);

    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
    }
}

function updateProfileSection(profile) {
    // Profile header card
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('profile-avatar-lg');
    const badgeEl = document.getElementById('profile-role-badge');

    if (nameEl) nameEl.textContent = profile.name || '—';
    if (emailEl) emailEl.textContent = profile.email || '—';
    if (avatarEl) avatarEl.textContent = getInitials(profile.name);
    if (badgeEl) badgeEl.textContent = translateRole(profile.role);

    // Data section
    const dataName = document.getElementById('profile-data-name');
    const dataEmail = document.getElementById('profile-data-email');
    const dataPhone = document.getElementById('profile-data-phone');
    const dataAddress = document.getElementById('profile-data-address');

    if (dataName) dataName.textContent = profile.name || '—';
    if (dataEmail) dataEmail.textContent = profile.email || '—';
    if (dataPhone) dataPhone.textContent = profile.phone ? formatPhone(profile.phone) : 'Não informado';
    if (dataAddress) dataAddress.textContent = profile.address || 'Não informado';
}


// =============================================================================
// Saldo
// =============================================================================

async function loadWalletBalance() {
    try {
        const data = await apiGetBalance();
        const balance = parseFloat(data.balance) || 0;
        DashboardState.balance = balance;

        document.querySelectorAll('.js-balance').forEach(el => {
            el.textContent = formatCurrency(balance);
        });

        const updatedEl = document.getElementById('balance-updated');
        if (updatedEl && data.last_updated) {
            updatedEl.textContent = `Atualizado ${formatDateTime(data.last_updated)}`;
        }
    } catch (err) {
        console.error('Erro ao carregar saldo:', err);
        document.querySelectorAll('.js-balance').forEach(el => {
            el.textContent = 'R$ --';
        });
    }
}


// =============================================================================
// Recarga (Home) — Fluxo principal
// =============================================================================

function onPhoneInput(input) {
    let digits = input.value.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.substring(0, 11);

    let formatted = '';
    if (digits.length >= 1) formatted = '(' + digits.substring(0, 2);
    if (digits.length >= 3) formatted += ') ' + digits.substring(2, 7);
    if (digits.length >= 8) formatted += '-' + digits.substring(7, 11);

    if (digits.length >= 2) {
        input.value = formatted;
    }

    updateRechargeSummary();
}

function selectOperator(op) {
    DashboardState.selectedOperator = op;
    document.querySelectorAll('.operator-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.operator-btn[data-op="${op}"]`);
    if (btn) btn.classList.add('selected');
    updateRechargeSummary();
}

function selectRechargeAmount(amount) {
    DashboardState.selectedRechargeAmount = amount;
    document.querySelectorAll('.recharge-amount-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.recharge-amount-btn[data-amount="${amount}"]`);
    if (btn) btn.classList.add('selected');
    updateRechargeSummary();
}

function updateRechargeSummary() {
    const amount = DashboardState.selectedRechargeAmount;
    const operator = DashboardState.selectedOperator;
    const phoneInput = document.getElementById('recharge-phone');
    const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';

    const summary = document.getElementById('recharge-summary');
    const submitBtn = document.getElementById('btn-submit-recharge');

    if (!summary) return;

    if (amount && operator && phone.length >= 10) {
        summary.classList.remove('hidden');
        document.getElementById('summary-phone').textContent = formatPhone(phone);
        document.getElementById('summary-operator').textContent = operator;
        document.getElementById('summary-amount').textContent = formatCurrency(amount);

        const afterBalance = DashboardState.balance - amount;
        const afterEl = document.getElementById('summary-balance-after');
        if (afterEl) {
            afterEl.textContent = formatCurrency(afterBalance);
            afterEl.style.color = afterBalance < 0 ? 'var(--color-danger-text)' : '';
        }

        if (submitBtn) submitBtn.disabled = false;
    } else {
        summary.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = true;
    }
}

async function submitRecharge() {
    const phoneInput = document.getElementById('recharge-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const operator = DashboardState.selectedOperator;
    const amount = DashboardState.selectedRechargeAmount;

    if (!phone || phone.replace(/\D/g, '').length < 10) {
        showToast('Digite um número de telefone válido', 'error');
        return;
    }
    if (!operator) {
        showToast('Selecione a operadora', 'error');
        return;
    }
    if (!amount) {
        showToast('Selecione o valor da recarga', 'error');
        return;
    }
    if (DashboardState.balance < amount) {
        showToast('Saldo insuficiente. Adicione crédito primeiro.', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-recharge');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Processando...';

    try {
        const result = await apiCreateOrder(phone, operator, amount);
        showToast(result.message || 'Recarga realizada com sucesso! ⚡', 'success');
        resetRechargeForm();
        await loadWalletBalance();
    } catch (err) {
        showToast(err.message || 'Erro ao fazer recarga', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function resetRechargeForm() {
    DashboardState.selectedOperator = null;
    DashboardState.selectedRechargeAmount = null;
    document.querySelectorAll('.operator-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.recharge-amount-btn').forEach(btn => btn.classList.remove('selected'));
    const phone = document.getElementById('recharge-phone');
    const summary = document.getElementById('recharge-summary');
    const submitBtn = document.getElementById('btn-submit-recharge');
    if (phone) phone.value = '';
    if (summary) summary.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
}


// =============================================================================
// Histórico de Pedidos
// =============================================================================

async function loadOrderHistory() {
    const container = document.getElementById('orders-list');
    const paginationEl = document.getElementById('orders-pagination');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <span>Carregando pedidos...</span>
        </div>
    `;

    try {
        const data = await apiGetMyTransactions(
            DashboardState.ordersPage,
            DashboardState.ordersLimit,
            'debit',
        );

        const txs = data.transactions || [];

        if (txs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h4>Nenhum pedido encontrado</h4>
                    <p>Faça uma recarga para ver seu histórico!</p>
                </div>
            `;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = txs.map(tx => renderTransactionItem(tx)).join('');

        if (paginationEl && data.pages > 1) {
            paginationEl.innerHTML = renderPagination(data.page, data.pages, 'changeOrdersPage');
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h4>Erro ao carregar pedidos</h4>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function changeOrdersPage(page) {
    DashboardState.ordersPage = page;
    loadOrderHistory();
}

function filterOrders(value) {
    DashboardState.ordersFilter = value || null;
    DashboardState.ordersPage = 1;
    loadOrderHistory();
}


// =============================================================================
// Extrato de Depósitos
// =============================================================================

async function loadDepositHistory() {
    const container = document.getElementById('deposits-list');
    const paginationEl = document.getElementById('deposits-pagination');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <span>Carregando extrato...</span>
        </div>
    `;

    try {
        const data = await apiGetMyTransactions(
            DashboardState.depositsPage,
            DashboardState.depositsLimit,
            DashboardState.depositsFilter,
        );

        const txs = data.transactions || [];

        if (txs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏦</div>
                    <h4>Nenhuma transação encontrada</h4>
                    <p>Faça um depósito para começar!</p>
                </div>
            `;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = txs.map(tx => renderTransactionItem(tx)).join('');

        if (paginationEl && data.pages > 1) {
            paginationEl.innerHTML = renderPagination(data.page, data.pages, 'changeDepositsPage');
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h4>Erro ao carregar extrato</h4>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function changeDepositsPage(page) {
    DashboardState.depositsPage = page;
    loadDepositHistory();
}

function filterDeposits(value) {
    DashboardState.depositsFilter = value || null;
    DashboardState.depositsPage = 1;
    loadDepositHistory();
}


// =============================================================================
// Renderizar transação (compartilhado)
// =============================================================================

function renderTransactionItem(tx) {
    const isCredit = tx.tx_type === 'credit';
    const icon = isCredit ? '↑' : '↓';
    const typeClass = isCredit ? 'credit' : 'debit';
    const sign = isCredit ? '+' : '-';
    const amount = parseFloat(tx.amount) || 0;

    return `
        <li class="transaction-item">
            <div class="tx-info">
                <div class="tx-icon ${typeClass}">${icon}</div>
                <div class="tx-details">
                    <div class="tx-description">${escapeHtml(tx.description || 'Transação')}</div>
                    <div class="tx-date">${formatDateTime(tx.created_at)}</div>
                </div>
            </div>
            <div class="tx-amount ${typeClass}">${sign} ${formatCurrency(amount)}</div>
        </li>
    `;
}


// =============================================================================
// Depósito PIX (Modal)
// =============================================================================

function openDepositModal() {
    DashboardState.selectedDepositAmount = null;
    const modal = document.getElementById('modal-deposit');
    if (modal) {
        modal.classList.remove('hidden');
        resetDepositForm();
    }
}

function closeDepositModal() {
    const modal = document.getElementById('modal-deposit');
    if (modal) modal.classList.add('hidden');
}

function selectDepositAmount(amount) {
    DashboardState.selectedDepositAmount = amount;

    // Highlight quick btn
    document.querySelectorAll('.deposit-quick-btn').forEach(btn => btn.classList.remove('selected'));
    if (event && event.target) event.target.classList.add('selected');

    // Update input
    const input = document.getElementById('deposit-amount-input');
    if (input) input.value = amount.toFixed(2).replace('.', ',');

    updateDepositButton();
}

function onDepositAmountInput(input) {
    let raw = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const value = parseFloat(raw);

    document.querySelectorAll('.deposit-quick-btn').forEach(btn => btn.classList.remove('selected'));

    if (value > 0 && value <= 1000) {
        DashboardState.selectedDepositAmount = value;
    } else {
        DashboardState.selectedDepositAmount = null;
    }

    updateDepositButton();
}

function updateDepositButton() {
    const btn = document.getElementById('btn-confirm-deposit');
    const amount = DashboardState.selectedDepositAmount;
    if (btn) {
        btn.disabled = !amount || amount < 10 || amount > 1000;
    }
}

function resetDepositForm() {
    DashboardState.selectedDepositAmount = null;
    document.querySelectorAll('.deposit-quick-btn').forEach(btn => btn.classList.remove('selected'));
    const input = document.getElementById('deposit-amount-input');
    if (input) input.value = '';
    updateDepositButton();
}

async function confirmDeposit() {
    const amount = DashboardState.selectedDepositAmount;
    if (!amount || amount < 10 || amount > 1000) {
        showToast('Valor inválido. Mínimo R$ 10, Máximo R$ 1.000', 'error');
        return;
    }

    const btn = document.getElementById('btn-confirm-deposit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Gerando PIX...';

    try {
        const result = await apiCreateDeposit(amount);
        showToast(result.message || 'Depósito realizado com sucesso! 💰', 'success');
        closeDepositModal();

        await loadWalletBalance();
        if (document.getElementById('section-extrato')?.classList.contains('active')) {
            loadDepositHistory();
        }
    } catch (err) {
        showToast(err.message || 'Erro ao processar depósito', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}


// =============================================================================
// Editar Perfil (Modal funcional)
// =============================================================================

function openEditProfileModal() {
    const profile = DashboardState.user;
    if (!profile) {
        showToast('Dados do perfil não carregados', 'error');
        return;
    }

    // Preencher campos com dados atuais
    const nameInput = document.getElementById('edit-name');
    const emailInput = document.getElementById('edit-email');
    const phoneInput = document.getElementById('edit-phone');
    const addressInput = document.getElementById('edit-address');

    if (nameInput) nameInput.value = profile.name || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (phoneInput) phoneInput.value = profile.phone ? formatPhone(profile.phone) : '';
    if (addressInput) addressInput.value = profile.address || '';

    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.remove('hidden');
}

function closeEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.add('hidden');
}

async function saveProfile() {
    const nameInput = document.getElementById('edit-name');
    const emailInput = document.getElementById('edit-email');
    const phoneInput = document.getElementById('edit-phone');
    const addressInput = document.getElementById('edit-address');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';

    // Validação básica
    if (!name || name.length < 2) {
        showToast('Nome deve ter pelo menos 2 caracteres', 'error');
        return;
    }
    if (!email || !email.includes('@')) {
        showToast('Informe um e-mail válido', 'error');
        return;
    }

    const btn = document.getElementById('btn-save-profile');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Salvando...';

    try {
        const payload = { name, email };
        if (phone) payload.phone = phone;
        if (address) payload.address = address;

        const result = await apiUpdateProfile(payload);
        showToast('Perfil atualizado com sucesso! ✅', 'success');

        // Atualizar estado e UI
        DashboardState.user = result;
        storeUser(result);
        updateProfileSection(result);

        // Atualizar nome na sidebar e topbar
        const sidebarName = document.getElementById('sidebar-user-name');
        const sidebarAvatar = document.getElementById('sidebar-user-avatar');
        const topbarName = document.getElementById('topbar-user-name');
        if (sidebarName) sidebarName.textContent = result.name;
        if (sidebarAvatar) sidebarAvatar.textContent = getInitials(result.name);
        if (topbarName) topbarName.textContent = result.name;

        closeEditProfileModal();
    } catch (err) {
        showToast(err.message || 'Erro ao salvar perfil', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}


// =============================================================================
// Solicitar Revenda
// =============================================================================

function updateResellerCTA(profile) {
    const container = document.getElementById('reseller-cta');
    if (!container) return;

    if (profile.role === 'admin') {
        container.classList.add('hidden');
        return;
    }

    if (profile.role === 'revendedor') {
        container.classList.add('requested');
        container.innerHTML = `<h3>🏪 Você é um Revendedor!</h3><p>Parabéns! Sua conta tem acesso de revendedor.</p>`;
        return;
    }

    if (profile.reseller_requested) {
        container.classList.add('requested');
        container.innerHTML = `<h3>⏳ Solicitação em Análise</h3><p>Sua solicitação está sendo analisada. Aguarde!</p>`;
        return;
    }

    container.innerHTML = `
        <h3>💼 Seja um Revendedor!</h3>
        <p>Ganhe comissões revendendo recargas. Solicite agora!</p>
        <button class="btn-reseller" id="btn-request-reseller" onclick="requestReseller()">
            🚀 Solicitar Revenda
        </button>
    `;
}

async function requestReseller() {
    const btn = document.getElementById('btn-request-reseller');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Enviando...';

    try {
        const result = await apiRequestReseller();
        showToast(result.message || 'Solicitação enviada!', 'success');

        DashboardState.user.reseller_requested = true;
        storeUser(DashboardState.user);
        updateResellerCTA(DashboardState.user);
    } catch (err) {
        showToast(err.message || 'Erro ao solicitar revenda', 'error');
        btn.disabled = false;
        btn.textContent = '🚀 Solicitar Revenda';
    }
}


// =============================================================================
// Utilitários
// =============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPhone(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

function renderPagination(currentPage, totalPages, callbackName) {
    let html = '<div class="pagination">';
    html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="${callbackName}(${currentPage - 1})">‹</button>`;

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        html += `<button class="page-btn" onclick="${callbackName}(1)">1</button>`;
        if (start > 2) html += '<span class="page-info">...</span>';
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += '<span class="page-info">...</span>';
        html += `<button class="page-btn" onclick="${callbackName}(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${callbackName}(${currentPage + 1})">›</button>`;
    html += '</div>';
    return html;
}


// =============================================================================
// INIT
// =============================================================================

initDashboard();
