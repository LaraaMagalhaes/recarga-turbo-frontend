/**
 * login-page.js - Lógica da página de login
 * 
 * Externalizado do inline script de login.html para compatibilidade
 * com Content-Security-Policy sem 'unsafe-inline'.
 */

// Redirecionar se já logado
(function () {
    const user = getStoredUser();
    const token = localStorage.getItem('token');
    if (token && user) {
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }
})();

async function handleLogin(e) {
    e.preventDefault();

    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('login-btn-text');
    const alertBox = document.getElementById('login-alert');
    const alertText = document.getElementById('login-alert-text');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Loading state
    btn.disabled = true;
    btnText.innerHTML = '<div class="spinner"></div> Entrando...';
    alertBox.classList.add('hidden');

    try {
        const data = await apiLogin(email, password);

        // Salvar token e dados
        storeToken(data.access_token);

        // Buscar perfil completo
        const profile = await apiGetProfile();
        storeUser(profile);

        // Redirecionar por role
        if (profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }

    } catch (err) {
        alertText.textContent = err.message || 'Credenciais inválidas. Tente novamente.';
        alertBox.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Entrar';
    }
}
