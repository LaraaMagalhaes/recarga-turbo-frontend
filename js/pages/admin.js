/**
 * admin.js - Lógica do Dashboard Admin
 * 
 * Seções: Overview, Pedidos, Usuários, Parceiros, Logs
 * Modals: Transações, Ajuste de Saldo, Confirmação
 */

// ===== Estado Global =====
let currentSection = 'overview';
let allUsers = [];

let ordersState = { page: 1, limit: 20, status: null };
let logsState = { page: 1, limit: 20, action: null };

let modalState = { userId: null, userName: '', page: 1, limit: 10, txType: null };
let adjustState = { userId: null, userName: '' };

// ===== Inicialização =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    try {
        const profile = await apiGetProfile();
        storeUser(profile);

        if (profile.role !== 'admin') {
            window.location.href = 'login.html';
            return;
        }

        renderUserInfo(profile);
        navigateTo('overview');
    } catch (err) {
        showToast('Erro ao carregar perfil. Tente fazer login novamente.', 'error');
    }
});

function renderUserInfo(user) {
    const nameEl = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl) avatarEl.textContent = getInitials(user.name);
}

// ===== Navegação =====
function navigateTo(section) {
    currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    document.querySelectorAll('.section').forEach(s => {
        s.classList.toggle('active', s.id === `section-${section}`);
    });

    const titles = {
        overview: { title: 'Visão Geral', subtitle: 'Resumo do sistema' },
        orders: { title: 'Pedidos', subtitle: 'Gerenciamento de recargas' },
        users: { title: 'Usuários', subtitle: 'Gerenciamento de contas' },
        resellers: { title: 'Parceiros', subtitle: 'Aprovação de revendedores' },
        logs: { title: 'Logs', subtitle: 'Auditoria do sistema' },
    };
    const t = titles[section] || titles.overview;
    document.getElementById('topbar-title').textContent = t.title;
    document.getElementById('topbar-subtitle').textContent = t.subtitle;

    if (section === 'overview') loadOverview();
    if (section === 'orders') loadOrders();
    if (section === 'users') loadUsers();
    if (section === 'resellers') loadResellers();
    if (section === 'logs') loadLogs();

    closeSidebar();
}

// =============================================================================
// SEÇÃO: VISÃO GERAL
// =============================================================================
async function loadOverview() {
    try {
        const [users, orders, resellers] = await Promise.all([
            apiGetAllUsers(),
            apiGetOrders(1, 5).catch(() => ({ orders: [], total: 0 })),
            apiGetResellerRequests().catch(() => []),
        ]);

        allUsers = users;

        // Stats
        document.getElementById('stat-total-users').textContent = users.length;
        document.getElementById('stat-active-users').textContent = users.filter(u => u.is_active).length;
        document.getElementById('stat-pending-orders').textContent = orders.total;
        document.getElementById('stat-reseller-requests').textContent = resellers.length;

        // Últimos pedidos
        renderOverviewOrders(orders);
    } catch (err) {
        showToast('Erro ao carregar dados: ' + err.message, 'error');
    }
}

function renderOverviewOrders(data) {
    const container = document.getElementById('overview-recent-orders');

    if (!data || !data.orders || data.orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                <h4>Sem pedidos</h4>
                <p>Nenhum pedido de recarga registrado</p>
            </div>`;
        return;
    }

    let html = '<table class="data-table"><thead><tr>';
    html += '<th>Cliente</th><th>Operadora</th><th>Valor</th><th>Status</th><th>Data</th>';
    html += '</tr></thead><tbody>';

    data.orders.forEach(o => {
        html += `<tr>
            <td>${o.user_name}</td>
            <td>${o.operator}</td>
            <td class="text-bold">${formatCurrency(o.amount)}</td>
            <td>${renderOrderStatusBadge(o.status)}</td>
            <td class="text-muted text-sm">${formatDateTime(o.created_at)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderOrderStatusBadge(status) {
    const map = {
        pending: { cls: 'badge-pending', label: 'Pendente' },
        paid: { cls: 'badge-paid', label: 'Pago' },
        completed: { cls: 'badge-completed', label: 'Concluído' },
        canceled: { cls: 'badge-canceled', label: 'Cancelado' },
        failed: { cls: 'badge-failed', label: 'Falhou' },
    };
    const s = map[status] || { cls: '', label: status };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}


// =============================================================================
// SEÇÃO: PEDIDOS DE RECARGA
// =============================================================================
async function loadOrders() {
    const loading = document.getElementById('orders-loading');
    const wrapper = document.getElementById('orders-table-wrapper');

    loading.classList.remove('hidden');
    wrapper.classList.add('hidden');

    try {
        const data = await apiGetOrders(ordersState.page, ordersState.limit, ordersState.status);

        document.getElementById('orders-count-label').textContent = `${data.total} pedido${data.total !== 1 ? 's' : ''}`;

        const tbody = document.getElementById('orders-tbody');
        const empty = document.getElementById('orders-empty');
        tbody.innerHTML = '';

        if (data.orders.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');

            data.orders.forEach(o => {
                const canAct = o.status === 'pending' || o.status === 'paid';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="text-muted text-sm">#${o.id}</td>
                    <td>
                        <div class="cell-main">${o.user_name}</div>
                        <div class="cell-sub">${o.user_phone}</div>
                    </td>
                    <td>${o.operator}</td>
                    <td>${o.destination_phone}</td>
                    <td class="text-bold">${formatCurrency(o.amount)}</td>
                    <td>${renderOrderStatusBadge(o.status)}</td>
                    <td class="text-muted text-sm">${formatDateTime(o.created_at)}</td>
                    <td>
                        ${canAct ? `
                            <div class="action-btns">
                                <button class="btn btn-success btn-sm" onclick="confirmOrderAction(${o.id})">✅ Confirmar</button>
                                <button class="btn btn-danger btn-sm" onclick="refundOrderAction(${o.id}, '${o.user_name.replace(/'/g, "\\'")}', '${o.amount}')">↩️ Devolver</button>
                            </div>
                        ` : '<span class="text-muted text-sm">—</span>'}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderPagination('orders-pagination', data.page, data.pages, data.total, ordersGoToPage);

        loading.classList.add('hidden');
        wrapper.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        showToast('Erro ao carregar pedidos: ' + err.message, 'error');
    }
}

function onOrderStatusFilterChange(value) {
    ordersState.status = value || null;
    ordersState.page = 1;
    loadOrders();
}

function ordersGoToPage(page) {
    ordersState.page = page;
    loadOrders();
}

async function confirmOrderAction(orderId) {
    showConfirmModal(
        '✅ Confirmar Recarga',
        `Tem certeza que deseja confirmar o pedido #${orderId} como recarga realizada?`,
        async () => {
            try {
                const result = await apiConfirmOrder(orderId);
                showToast(result.message, 'success');
                loadOrders();
                if (currentSection === 'overview') loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    );
}

async function refundOrderAction(orderId, userName, amount) {
    showConfirmModal(
        '↩️ Devolver Saldo',
        `Deseja cancelar o pedido #${orderId} e devolver R$${amount} para ${userName}?`,
        async () => {
            try {
                const result = await apiRefundOrder(orderId);
                showToast(result.message, 'success');
                loadOrders();
                if (currentSection === 'overview') loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    );
}


// =============================================================================
// SEÇÃO: USUÁRIOS
// =============================================================================
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    const loading = document.getElementById('users-loading');
    const table = document.getElementById('users-table-wrapper');

    loading.classList.remove('hidden');
    table.classList.add('hidden');

    try {
        const users = await apiGetAllUsers();
        allUsers = users;
        renderUsersTable(users);

        loading.classList.add('hidden');
        table.classList.remove('hidden');

        document.getElementById('users-count-label').textContent = `${users.length} usuário${users.length !== 1 ? 's' : ''}`;

        const searchInput = document.getElementById('users-search');
        if (searchInput.value) filterUsers(searchInput.value);
    } catch (err) {
        loading.classList.add('hidden');
        showToast('Erro ao carregar usuários: ' + err.message, 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'user-row';
        row.dataset.name = user.name.toLowerCase();
        row.dataset.email = user.email.toLowerCase();
        row.onclick = () => openUserTransactions(user.id, user.name);

        const isAdmin = user.role === 'admin';
        const balanceDisplay = isAdmin
            ? '<span class="text-muted">—</span>'
            : `<span class="text-bold" style="color: var(--color-success-text)">${formatCurrency(user.balance || '0')}</span>`;

        row.innerHTML = `
            <td>
                <div class="user-name-cell">
                    <div class="user-avatar-sm">${getInitials(user.name)}</div>
                    <div>
                        <div class="cell-main">${user.name}</div>
                        <div class="cell-sub">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge badge-${user.role}">${translateRole(user.role)}</span></td>
            <td>${balanceDisplay}</td>
            <td><span class="badge ${user.is_active ? 'badge-active' : 'badge-inactive'}">${user.is_active ? 'Ativa' : 'Inativa'}</span></td>
            <td>
                ${!isAdmin ? `<div class="action-btns">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openUserTransactions(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Transações
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openAdjustModal(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Saldo
                    </button>
                </div>` : '<span class="text-muted text-sm">—</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Busca
function filterUsers(query) {
    const term = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#users-tbody .user-row');
    const noResults = document.getElementById('users-no-results');
    const clearBtn = document.getElementById('search-clear-btn');
    let visibleCount = 0;

    clearBtn.classList.toggle('hidden', term.length === 0);

    rows.forEach(row => {
        const name = row.dataset.name || '';
        const email = row.dataset.email || '';
        const matches = name.includes(term) || email.includes(term);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    noResults.classList.toggle('hidden', visibleCount > 0);

    const label = document.getElementById('users-count-label');
    if (term) {
        label.textContent = `${visibleCount} de ${rows.length} usuário${rows.length !== 1 ? 's' : ''}`;
    } else {
        label.textContent = `${rows.length} usuário${rows.length !== 1 ? 's' : ''}`;
    }
}

function clearSearch() {
    const input = document.getElementById('users-search');
    input.value = '';
    filterUsers('');
    input.focus();
}


// =============================================================================
// SEÇÃO: PARCEIROS (REVENDA)
// =============================================================================
async function loadResellers() {
    const loading = document.getElementById('resellers-loading');
    const content = document.getElementById('resellers-content');

    loading.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const requests = await apiGetResellerRequests();
        const empty = document.getElementById('resellers-empty');
        const list = document.getElementById('resellers-list');

        document.getElementById('resellers-count-label').textContent =
            `${requests.length} solicitação${requests.length !== 1 ? 'ões' : ''}`;

        if (requests.length === 0) {
            empty.classList.remove('hidden');
            list.innerHTML = '';
        } else {
            empty.classList.add('hidden');
            list.innerHTML = '';

            requests.forEach(user => {
                const card = document.createElement('div');
                card.className = 'reseller-request-card';
                card.innerHTML = `
                    <div class="reseller-info">
                        <div class="user-avatar-sm">${getInitials(user.name)}</div>
                        <div>
                            <div class="cell-main">${user.name}</div>
                            <div class="cell-sub">${user.email}${user.phone ? ' • ' + user.phone : ''}</div>
                        </div>
                    </div>
                    <div class="reseller-actions">
                        <button class="btn btn-ghost btn-sm" onclick="openUserTransactions(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Ver transações
                        </button>
                        <button class="btn btn-success btn-sm" onclick="approveResellerAction(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Aprovar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="rejectResellerAction(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Rejeitar
                        </button>
                    </div>
                `;
                list.appendChild(card);
            });
        }

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        showToast('Erro ao carregar solicitações: ' + err.message, 'error');
    }
}

async function approveResellerAction(userId, userName) {
    showConfirmModal(
        '✅ Aprovar Revendedor',
        `Deseja aprovar ${userName} como revendedor?`,
        async () => {
            try {
                const result = await apiApproveReseller(userId);
                showToast(result.message, 'success');
                loadResellers();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    );
}

async function rejectResellerAction(userId, userName) {
    showConfirmModal(
        '❌ Rejeitar Solicitação',
        `Deseja rejeitar a solicitação de ${userName}?`,
        async () => {
            try {
                const result = await apiRejectReseller(userId);
                showToast(result.message, 'success');
                loadResellers();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    );
}


// =============================================================================
// SEÇÃO: LOGS DE AUDITORIA
// =============================================================================
async function loadLogs() {
    const loading = document.getElementById('logs-loading');
    const wrapper = document.getElementById('logs-table-wrapper');

    loading.classList.remove('hidden');
    wrapper.classList.add('hidden');

    try {
        const data = await apiGetLogs(logsState.page, logsState.limit, logsState.action);

        document.getElementById('logs-count-label').textContent = `${data.total} registro${data.total !== 1 ? 's' : ''}`;

        const tbody = document.getElementById('logs-tbody');
        const empty = document.getElementById('logs-empty');
        tbody.innerHTML = '';

        if (data.logs.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');

            data.logs.forEach(log => {
                const tr = document.createElement('tr');

                // Extrair valor (R$...) e descrição separados do campo details
                const parsed = parseLogDetails(log.details || '');

                tr.innerHTML = `
                    <td class="text-muted text-sm">${formatDateTime(log.created_at)}</td>
                    <td>${renderLogActionBadge(log.action)}</td>
                    <td>${log.user_name || '—'}</td>
                    <td>${log.target_user_name || '—'}</td>
                    <td class="text-bold">${parsed.valor}</td>
                    <td class="text-sm">${parsed.descricao}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderPagination('logs-pagination', data.page, data.pages, data.total, logsGoToPage);

        loading.classList.add('hidden');
        wrapper.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        showToast('Erro ao carregar logs: ' + err.message, 'error');
    }
}

function renderLogActionBadge(action) {
    const map = {
        order_confirm: { cls: 'badge-completed', label: 'Recarga confirmada' },
        order_refund: { cls: 'badge-canceled', label: 'Saldo devolvido' },
        order_create: { cls: 'badge-pending', label: 'Pedido criado' },
        balance_adjust: { cls: 'badge-paid', label: 'Ajuste de saldo' },
        deposit_pix: { cls: 'badge-completed', label: 'Depósito PIX' },
        reseller_approve: { cls: 'badge-active', label: 'Revenda aprovada' },
        reseller_reject: { cls: 'badge-inactive', label: 'Revenda rejeitada' },
    };
    const a = map[action] || { cls: '', label: action };
    return `<span class="badge ${a.cls}">${a.label}</span>`;
}

/**
 * Extrai valor (R$) e descrição de um campo details de log.
 * Usa indexOf puro — sem regex — porque $ causa problemas em regex/template.
 */
function parseLogDetails(details) {
    if (!details) return { valor: '\u2014', descricao: '\u2014' };

    var valor = '\u2014';
    var descricao = details;
    var marker = 'R' + '\u0024'; // R$
    var pos = details.indexOf(marker);

    if (pos >= 0) {
        // Encontrou R$ — extrair o número que segue
        var numStart = pos + 2; // depois do "R$"
        var numEnd = numStart;
        while (numEnd < details.length) {
            var ch = details.charAt(numEnd);
            if ((ch >= '0' && ch <= '9') || ch === '.' || ch === ',') {
                numEnd++;
            } else {
                break;
            }
        }
        valor = details.substring(pos, numEnd);
        // Descrição é o texto sem o valor
        descricao = details.substring(0, pos) + details.substring(numEnd);
    }

    // Limpar a descrição
    descricao = descricao
        .split('|').join(' ')
        .split('Motivo:').join('')
        .replace(/\s+/g, ' ')
        .trim();

    if (!descricao || descricao.length < 2) descricao = '\u2014';

    return { valor: valor, descricao: descricao };
}

function onLogActionFilterChange(value) {
    logsState.action = value || null;
    logsState.page = 1;
    loadLogs();
}

function logsGoToPage(page) {
    logsState.page = page;
    loadLogs();
}


// =============================================================================
// MODAL: TRANSAÇÕES DO USUÁRIO
// =============================================================================
async function openUserTransactions(userId, userName) {
    modalState = { userId, userName, page: 1, limit: 10, txType: null };

    document.getElementById('modal-user-name').textContent = userName;
    document.getElementById('modal-tx-filter').value = '';
    document.getElementById('user-tx-modal').classList.remove('hidden');

    await loadUserTransactionsModal();
}

function closeModal() {
    document.getElementById('user-tx-modal').classList.add('hidden');
}

async function loadUserTransactionsModal() {
    const container = document.getElementById('modal-tx-content');
    container.innerHTML = '<div class="loading-state"><div class="spinner spinner-lg"></div><span>Carregando...</span></div>';

    try {
        const data = await apiGetUserTransactions(
            modalState.userId, modalState.page, modalState.limit, modalState.txType,
        );

        document.getElementById('modal-tx-total').textContent = data.total;

        if (data.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h4>Sem transações</h4>
                    <p>Este usuário não possui movimentações${modalState.txType ? ' deste tipo' : ''}</p>
                </div>`;
            document.getElementById('modal-pagination').innerHTML = '';
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>ID</th><th>Tipo</th><th>Valor</th><th>Descrição</th><th>Data</th>';
        html += '</tr></thead><tbody>';

        data.transactions.forEach(tx => {
            const isCredit = tx.tx_type === 'credit';
            html += `<tr>
                <td class="text-muted text-sm">#${tx.id}</td>
                <td><span class="badge ${isCredit ? 'badge-credit' : 'badge-debit'}">${isCredit ? '↑ Entrada' : '↓ Saída'}</span></td>
                <td class="tx-amount ${tx.tx_type}">${isCredit ? '+' : '-'} ${formatCurrency(tx.amount)}</td>
                <td>${tx.description || '—'}</td>
                <td class="text-muted text-sm">${formatDateTime(tx.created_at)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        renderPagination('modal-pagination', data.page, data.pages, data.total, modalGoToPage);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Erro</h4><p>${err.message}</p></div>`;
    }
}

function modalGoToPage(page) {
    modalState.page = page;
    loadUserTransactionsModal();
}

function onModalFilterChange(value) {
    modalState.txType = value || null;
    modalState.page = 1;
    loadUserTransactionsModal();
}


// =============================================================================
// MODAL: AJUSTE DE SALDO
// =============================================================================
function openAdjustModal(userId, userName) {
    adjustState = { userId, userName };
    document.getElementById('adjust-user-name').textContent = userName;
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-type').value = 'credit';
    document.getElementById('adjust-reason').value = '';

    // Show current balance from allUsers
    const user = allUsers.find(u => u.id === userId);
    const currentBalance = user ? (user.balance || 0) : 0;
    const balanceEl = document.getElementById('adjust-current-balance');
    if (balanceEl) balanceEl.textContent = formatCurrency(currentBalance);

    document.getElementById('adjust-balance-modal').classList.remove('hidden');
}

function closeAdjustModal() {
    document.getElementById('adjust-balance-modal').classList.add('hidden');
}

async function submitAdjustBalance() {
    const amount = parseFloat(document.getElementById('adjust-amount').value);
    const txType = document.getElementById('adjust-type').value;
    const reason = document.getElementById('adjust-reason').value.trim();

    if (!amount || amount <= 0) {
        showToast('Informe um valor válido', 'error');
        return;
    }

    if (!reason || reason.length < 5) {
        showToast('Motivo obrigatório (mín. 5 caracteres)', 'error');
        return;
    }

    const btn = document.getElementById('adjust-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
        const result = await apiAdjustBalance(adjustState.userId, amount, txType, reason);
        showToast(`${result.message}. Novo saldo: ${formatCurrency(result.new_balance)}`, 'success');

        // Update the user balance in allUsers so the table and modal stay in sync
        const userIdx = allUsers.findIndex(u => u.id === adjustState.userId);
        if (userIdx !== -1) {
            allUsers[userIdx].balance = result.new_balance;
            renderUsersTable(allUsers);
        }

        closeAdjustModal();

        // Recarregar logs se estiver na seção
        if (currentSection === 'logs') loadLogs();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Ajuste';
    }
}


// =============================================================================
// MODAL: CONFIRMAÇÃO GENÉRICA
// =============================================================================
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;

    const btn = document.getElementById('confirm-modal-btn');
    btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Processando...';
        try {
            await onConfirm();
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirmar';
            closeConfirmModal();
        }
    };

    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
}


// =============================================================================
// PAGINAÇÃO REUTILIZÁVEL
// =============================================================================
function renderPagination(containerId, current, totalPages, totalItems, goToFn) {
    const container = document.getElementById(containerId);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';
    html += `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} onclick="window._paginateFns['${containerId}'](${current - 1})">‹</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7) {
            if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
                html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="window._paginateFns['${containerId}'](${i})">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += `<span class="page-info">…</span>`;
            }
        } else {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="window._paginateFns['${containerId}'](${i})">${i}</button>`;
        }
    }

    html += `<button class="page-btn" ${current >= totalPages ? 'disabled' : ''} onclick="window._paginateFns['${containerId}'](${current + 1})">›</button>`;
    html += `<span class="page-info">${totalItems} registro${totalItems !== 1 ? 's' : ''}</span>`;
    html += '</div>';

    // Store function reference for onclick
    window._paginateFns = window._paginateFns || {};
    window._paginateFns[containerId] = goToFn;

    container.innerHTML = html;
}


// =============================================================================
// SIDEBAR MOBILE
// =============================================================================
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}
