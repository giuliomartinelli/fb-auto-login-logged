# 🤖 Facebook Auto Login Bot (Playwright)

Este projeto é um **robô automatizado** feito em **Node.js + Playwright** que realiza **login automático no Facebook**, mantendo a sessão ativa entre execuções.

> 🧠 Ideal para quem precisa manter uma sessão autenticada (por exemplo, para automação, scraping legítimo, ou testes de UI com conta logada) sem precisar logar manualmente toda vez.

---

## ⚙️ Funcionalidades

* ✅ **Login automático** no Facebook (`https://www.facebook.com/login`)
* ✅ **Detecção de sessão ativa** com base na URL (regras simples e diretas)

  * Se a URL for `https://www.facebook.com/login` → não está logado
  * Se a URL for `https://www.facebook.com/home.php` ou `https://www.facebook.com` → já está logado
* ✅ **Sessão persistente** entre execuções (cookies e localStorage salvos no diretório `fb-profile`)
* ✅ **Humanização** de ações (digitação com delays e movimentos de mouse)
* ✅ **Logs detalhados** em cada etapa
* ✅ **.env configurável** (credenciais e opções)
* ✅ **Compatível com headless ou modo visível**
* ✅ **Gera screenshots automáticos** em caso de erro

---

## 🧩 Tecnologias

* [Node.js](https://nodejs.org/)
* [Playwright](https://playwright.dev/)
* [dotenv](https://www.npmjs.com/package/dotenv)

---

## 📁 Estrutura de pastas

```
fb-robot/
├── fb-auto-login-logged.js   # Script principal
├── package.json
├── package-lock.json
├── .env                      # Credenciais (não comitar)
├── fb-profile/               # Perfil persistente (cookies/localStorage)
├── fb-cookies.json           # Backup de cookies (opcional)
├── fb-login-maybe-failed.png # Screenshot se o login falhar
└── README.md
```

---

## 🚀 Instalação (Linux / Ubuntu)

### 1. Atualize o sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instale Node.js (v18+)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

### 3. Crie e configure o projeto

```bash
mkdir ~/fb-robot && cd ~/fb-robot
npm init -y
npm install playwright dotenv
npx playwright install --with-deps
```

### 4. Crie o arquivo `.env`

```bash
nano .env
```

Exemplo de conteúdo:

```env
FACEBOOK_EMAIL=seu@email.com
FACEBOOK_PASSWORD=SUA_SENHA
HEADLESS=false
```

## ▶️ Como executar

### Execução direta

```bash
node fb-auto-login-logged.js
```

Ou, se quiser rodar sem modificar o script:

```bash
node -r dotenv/config fb-auto-login-logged.js
```

### Rodar em segundo plano (opcional)

```bash
nohup node fb-auto-login-logged.js > fb.log 2>&1 &
```

### Rodar com PM2

```bash
npm i -g pm2
pm2 start fb-auto-login-logged.js --name fb-robot
pm2 logs fb-robot
```

---

## 💡 Como o script funciona

### 1️⃣ Verificação de login

O script acessa `https://www.facebook.com/login` e aplica a seguinte regra:

* Se a URL final for `https://www.facebook.com/login` → **não logado**
* Se a URL final for `https://www.facebook.com/home.php` ou `https://www.facebook.com` → **logado**

### 2️⃣ Login automático (se necessário)

Se não estiver logado:

* Preenche `#email` e `#pass` com as credenciais do `.env`
* Clica no botão de login
* Aguarda redirecionamento
* Salva cookies e sessão no diretório `fb-profile/`

### 3️⃣ Sessão persistente

* Usa **Playwright Persistent Context** → mantém cookies/localStorage automaticamente entre execuções
* Também salva um backup manual em `fb-cookies.json`

### 4️⃣ Humanização

Para evitar bloqueios simples:

* Simula movimentos de mouse com pequenos desvios
* Digita caractere por caractere com pequenos delays aleatórios

### 5️⃣ Logs e debug

* Todos os passos são logados no terminal (`[LOG]`, `[INFO]`, `[WARN]`, `[OK]`)
* Em caso de erro ou captcha, tira um screenshot automático (`fb-login-maybe-failed.png`)

---

## 🧠 Dicas avançadas

* Para rodar sem interface gráfica (servidores), defina:

```env
HEADLESS=true
```

* Para usar proxy (por exemplo, proxy móvel):

```env
PROXY=http://usuario:senha@ip:porta
```

e adicione no script:

```js
proxy: { server: process.env.PROXY }
```

---

## 🧾 Licença

Este projeto é apenas para fins **educacionais**.
O uso do script para fins de **spam, scraping não autorizado ou violação dos Termos de Serviço do Facebook** é de total responsabilidade do usuário.

---
