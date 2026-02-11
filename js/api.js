/**
 * api.js - Módulo de comunicação com o Backend
 * 
 * Centraliza todas as chamadas HTTP com:
 * - Auto-inject do token JWT
 * - Tratamento de erros padronizado
 * - Redirect em 401 (sessão expirada)
 */

const API_BASE = 'http://localhost:8000';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
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
