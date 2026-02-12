/**
 * auth.js - Módulo de Autenticação
 * 
 * Gerencia login, logout e verificação de sessão/role.
 */

/**
 * Verifica se o usuário está autenticado.
 * Redireciona para login se não estiver.
 */
function requireAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Verifica se o usuário tem role de admin.
 * Redireciona para dashboard normal se não for.
 */
function requireAdmin() {
    const user = getStoredUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/** Retorna o usuário do localStorage */
function getStoredUser() {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Salva dados do usuário no localStorage */
function storeUser(userData) {
    localStorage.setItem('user', JSON.stringify(userData));
}

/** Salva token no localStorage */
function storeToken(token) {
    localStorage.setItem('token', token);
}

/** Logout: limpa refresh cookie (via API), storage e redireciona */
async function logout() {
    try {
        await apiLogout();
    } catch {
        // Ignora erros — cookie pode já ter expirado
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/** Retorna as iniciais do nome (para avatar) */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

/** Formata valor como moeda BR */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

/** Formata data para exibição */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/** Formata data + hora */
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Tradução de roles */
function translateRole(role) {
    const map = {
        admin: 'Administrador',
        cliente: 'Cliente',
        revendedor: 'Revendedor',
    };
    return map[role] || role;
}

/** Tradução de tipo de transação */
function translateTxType(type) {
    return type === 'credit' ? 'Entrada' : 'Saída';
}

/**
 * Mostra um toast de notificação.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
    // Remove toast anterior se existir
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = `toast toast-${type}`;
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
