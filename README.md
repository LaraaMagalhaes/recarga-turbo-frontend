# Recarga Turbo - Frontend

## 📋 Descrição

Interface web para plataforma de recargas de celular com autenticação, carteira digital e painéis específicos por role.

**Status:** ✅ Production-Ready para MVP  
**Versão:** 1.0.0

---

## 🎨 Páginas Implementadas

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| **Login** | `login.html` | Autenticação de usuários |
| **Cadastro** | `register.html` | Criação de nova conta |
| **Dashboard Cliente** | `dashboard.html` | Perfil + Saldo + Recargas |
| **Dashboard Admin** | `dashboard-admin.html` | Gerenciar usuários |

---

## 🚀 Features

- ✅ **Login/Register** com validação
- ✅ **JWT** salvo em localStorage
- ✅ **Perfil em tempo real** (GET /users/me)
- ✅ **Saldo formatado** (R$ X.XXX,XX)
- ✅ **Dashboards separados por role**
- ✅ **Responsivo** (mobile-friendly)

---

## 🛠️ Tecnologias

- **HTML5** + **CSS3** + **JavaScript** (Vanilla)
- **Fetch API** para requisições
- **localStorage** para JWT
- **Intl.NumberFormat** para formatação brasileira

---

## ⚙️ Configuração

### 1. Conectar ao Backend

Edite a variável `API_URL` nos arquivos HTML:

```javascript
// login.html, register.html, dashboard.html, dashboard-admin.html
const API_URL = 'http://localhost:8000';  // Trocar em produção
```

### 2. Abrir no Navegador

```bash
# Servidor HTTP simples:
python -m http.server 8080
# Acesse: http://localhost:8080
```

Ou abra os arquivos `.html` diretamente!

---

## 📚 Fluxo de Navegação

```
login.html
    ↓
[JWT salvo]
    ↓
dashboard.html (Cliente/Revendedor)
    OU
dashboard-admin.html (Admin)
    ↓
[Logout] → login.html
```

---

## 🎯 Integração com Backend

### Endpoints Consumidos

| Frontend | Backend Endpoint | Descrição |
|----------|------------------|-----------|
| Login | POST `/users/login` | Autentica e retorna JWT |
| Register | POST `/users/register` | Cria nova conta |
| Dashboard | GET `/users/me` | Dados do usuário |
| Dashboard | GET `/wallet/balance` | Saldo da carteira |
| Admin | GET `/admin/users` | Lista todos usuários |

---

## 🔐 Segurança

- ✅ **JWT** armazenado em localStorage
- ✅ **Validação de role** (redireciona para dashboard correto)
- ✅ **Logout** limpa token
- ⚠️ **HTTPS obrigatório em produção**

---

## 📈 Próximas Features

- ⏳ Histórico de Transações
- 📅 Adicionar Crédito via PIX
- 📅 Comprar Recargas
- 📅 Painel de Revendedor

---

## 📄 Licença

Proprietary - © 2024 Recarga Turbo
