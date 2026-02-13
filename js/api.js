/**
 * api.js - Módulo de comunicação com o Backend
 * 
 * Centraliza todas as chamadas HTTP com:
 * - Auto-inject do token JWT
 * - Tratamento de erros padronizado
 * - Auto-refresh silencioso quando access token expira (401)
 * - Redirect em 401 somente se refresh também falhar
 */

const API_BASE = 'http://localhost:8000';

// Flag para evitar múltiplos refreshes simultâneos
let _isRefreshing = false;
let _refreshPromise = null;

/**
 * Tenta renovar o access token usando o refresh token cookie.
 * Retorna o novo token ou null se falhar.
 */
async function _tryRefreshToken() {
    if (_isRefreshing) return _refreshPromise;

    _isRefreshing = true;
    _refreshPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/users/refresh`, {
                method: 'POST',
                credentials: 'include', // Envia o cookie refresh_token
            });
            if (res.ok) {
                const data = await res.json();
                storeToken(data.access_token);
                return data.access_token;
            }
            return null;
        } catch {
            return null;
        } finally {
            _isRefreshing = false;
            _refreshPromise = null;
        }
    })();

    return _refreshPromise;
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        credentials: 'include', // Sempre enviar cookies (refresh_token)
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
        // Tentar auto-refresh silencioso antes de redirecionar
        const newToken = await _tryRefreshToken();
        if (newToken) {
            // Retry a requisição original com o novo token
            config.headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE}${endpoint}`, config);

            if (retryResponse.ok) {
                return retryResponse.json();
            }

            // Se ainda falhou, tratar como erro normal
            if (retryResponse.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                throw new Error('Sessão expirada');
            }

            if (!retryResponse.ok) {
                const data = await retryResponse.json().catch(() => ({}));
                throw new Error(data.detail || `Erro ${retryResponse.status}`);
            }
        }

        // Refresh falhou — sessão expirou de verdade
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Sessão expirada');
    }

    if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Acesso negado');
    }

    if (response.status === 404) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Recurso não encontrado');
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Erro ${response.status}`);
    }

    return response.json();
}

// ===== Auth =====
async function apiLogin(email, password) {
    return apiRequest('/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

async function apiGetProfile() {
    return apiRequest('/users/me');
}

async function apiLogout() {
    try {
        await apiRequest('/users/logout', { method: 'POST' });
    } catch {
        // Ignora erros no logout (pode já ter expirado)
    }
}

// ===== Wallet =====
async function apiGetBalance() {
    return apiRequest('/wallet/balance');
}

async function apiGetMyTransactions(page = 1, limit = 20, txType = null) {
    let url = `/wallet/history?page=${page}&limit=${limit}`;
    if (txType) url += `&tx_type=${txType}`;
    return apiRequest(url);
}

// ===== Admin: Usuários =====
async function apiGetAllUsers() {
    return apiRequest('/admin/users');
}

async function apiGetUserTransactions(userId, page = 1, limit = 20, txType = null) {
    let url = `/admin/users/${userId}/transactions?page=${page}&limit=${limit}`;
    if (txType) url += `&tx_type=${txType}`;
    return apiRequest(url);
}

// ===== Admin: Pedidos de Recarga =====
async function apiGetOrders(page = 1, limit = 20, status = null) {
    let url = `/admin/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return apiRequest(url);
}

async function apiConfirmOrder(orderId) {
    return apiRequest(`/admin/orders/${orderId}/confirm`, { method: 'PATCH' });
}

async function apiRefundOrder(orderId) {
    return apiRequest(`/admin/orders/${orderId}/refund`, { method: 'PATCH' });
}

// ===== Admin: Revendedores =====
async function apiGetResellerRequests() {
    return apiRequest('/admin/reseller-requests');
}

async function apiApproveReseller(userId) {
    return apiRequest(`/admin/users/${userId}/approve-reseller`, { method: 'PATCH' });
}

async function apiRejectReseller(userId) {
    return apiRequest(`/admin/users/${userId}/reject-reseller`, { method: 'PATCH' });
}

// ===== Admin: Ajuste de Saldo =====
async function apiAdjustBalance(userId, amount, txType, reason) {
    return apiRequest(`/admin/users/${userId}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount, tx_type: txType, reason }),
    });
}

// ===== Admin: Logs =====
async function apiGetLogs(page = 1, limit = 20, action = null) {
    let url = `/admin/logs?page=${page}&limit=${limit}`;
    if (action) url += `&action=${action}`;
    return apiRequest(url);
}

// ===== Cliente: Depósito (PIX Simulado) =====
async function apiCreateDeposit(amount) {
    return apiRequest('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(amount) }),
    });
}

// ===== Cliente: Pedido de Recarga =====
async function apiCreateOrder(destinationPhone, operator, amount) {
    return apiRequest('/orders/', {
        method: 'POST',
        body: JSON.stringify({
            destination_phone: destinationPhone,
            operator: operator,
            amount: parseFloat(amount),
        }),
    });
}

// ===== Cliente: Solicitar Revenda =====
async function apiRequestReseller() {
    return apiRequest('/users/request-reseller', {
        method: 'POST',
    });
}

// ===== Cliente: Atualizar Perfil =====
async function apiUpdateProfile(data) {
    return apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}
// ===== Pacotes de Recarga (Descontos) =====
async function apiGetPackages() {
    return apiRequest('/packages/');
}

async function apiGetAllPackagesAdmin() {
    return apiRequest('/packages/admin/all');
}

async function apiUpdatePackagePrice(packageId, sellingPrice, isActive) {
    const payload = { selling_price: parseFloat(sellingPrice) };
    if (isActive !== undefined) payload.is_active = isActive;

    return apiRequest(`/packages/${packageId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}
