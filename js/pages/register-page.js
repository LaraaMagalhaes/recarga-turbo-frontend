/**
 * register-page.js - Lógica da página de cadastro
 * 
 * Externalizado do inline script de register.html para compatibilidade
 * com Content-Security-Policy sem 'unsafe-inline'.
 */

const API_URL = 'http://localhost:8000';

function showAlert(message, type = 'error') {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// --- Client-side validation helpers ---

function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('input').forEach(el => el.style.borderColor = '#e0e0e0');
}

function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.style.borderColor = '#e74c3c';
    const existing = input.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
    const err = document.createElement('div');
    err.className = 'field-error';
    err.style.cssText = 'color:#c00;font-size:12px;margin-top:4px;';
    err.textContent = message;
    input.parentNode.appendChild(err);
}

function validateForm(name, email, phone, password) {
    let valid = true;

    // Nome: mínimo 2 caracteres
    if (!name || name.trim().length < 2) {
        showFieldError('name', 'Nome deve ter pelo menos 2 caracteres.');
        valid = false;
    }

    // Email: formato básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showFieldError('email', 'Informe um e-mail válido.');
        valid = false;
    }

    // Telefone: formato brasileiro (se preenchido)
    if (phone && phone.trim()) {
        const digits = phone.replace(/\D/g, '');
        // Remove código do país se presente
        const cleaned = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
        const phoneRegex = /^[1-9]{2}9[0-9]{8}$/;
        if (!phoneRegex.test(cleaned)) {
            showFieldError('phone', 'Telefone inválido. Use: (XX) 9XXXX-XXXX');
            valid = false;
        }
    }

    // Senha: política reforçada (sincronizada com backend)
    if (!password || password.length < 8) {
        showFieldError('password', 'Senha deve ter no mínimo 8 caracteres.');
        valid = false;
    } else if (!/[A-Z]/.test(password)) {
        showFieldError('password', 'Senha deve ter ao menos uma letra maiúscula.');
        valid = false;
    } else if (!/[0-9]/.test(password)) {
        showFieldError('password', 'Senha deve ter ao menos um número.');
        valid = false;
    }

    return valid;
}

// --- Phone mask ---
document.getElementById('phone').addEventListener('input', function () {
    let digits = this.value.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.substring(0, 11);

    let formatted = '';
    if (digits.length >= 1) formatted = '(' + digits.substring(0, 2);
    if (digits.length >= 3) formatted += ') ' + digits.substring(2, 7);
    if (digits.length >= 8) formatted += '-' + digits.substring(7, 11);

    if (digits.length >= 2) {
        this.value = formatted;
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const loading = document.getElementById('loading');
    const submitBtn = e.target.querySelector('button');

    // Client-side validation
    if (!validateForm(name, email, phone, password)) {
        return;
    }

    const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password
    };

    // Só adicionar phone se tiver valor
    if (phone.trim()) {
        payload.phone = phone;
    }

    try {
        submitBtn.disabled = true;
        loading.style.display = 'block';

        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            // Salvar token e dados do usuário
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data));

            showAlert('Conta criada com sucesso! Redirecionando...', 'success');

            // Redirecionar para dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            // Mostrar erro específico
            if (data.detail) {
                if (typeof data.detail === 'string') {
                    showAlert(data.detail);
                } else if (Array.isArray(data.detail)) {
                    // Pydantic validation errors
                    const errorMsg = data.detail.map(err => err.msg).join(', ');
                    showAlert(errorMsg);
                }
            } else {
                showAlert('Erro ao criar conta');
            }
        }
    } catch (error) {
        showAlert('Erro ao conectar com o servidor. Backend está rodando?');
        console.error('Erro:', error);
    } finally {
        submitBtn.disabled = false;
        loading.style.display = 'none';
    }
});
