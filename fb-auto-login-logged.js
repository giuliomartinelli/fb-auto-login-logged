require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const USER_DATA_DIR = path.resolve(__dirname, 'fb-profile'); // pasta do perfil persistente
const COOKIE_BACKUP = path.resolve(__dirname, 'fb-cookies.json');
const LOGIN_URL = 'https://www.facebook.com/login';
const HOME_URL = 'https://www.facebook.com';
const HOME_URL_ALT = 'https://www.facebook.com/home.php';

const EMAIL = process.env.FACEBOOK_EMAIL;
const PASSWORD = process.env.FACEBOOK_PASSWORD;
const HEADLESS = (process.env.HEADLESS === 'true');

if (!EMAIL || !PASSWORD) {
  console.error('[ERRO] Variáveis FACEBOOK_EMAIL e FACEBOOK_PASSWORD não definidas. Abortando.');
  process.exit(1);
}

// --- humanização simples ---
async function humanType(page, selector, text) {
  console.log(`[LOG] humanType -> selector: ${selector} text-length: ${text.length}`);
  for (const ch of text) {
    await page.type(selector, ch, { delay: 60 + Math.floor(Math.random() * 60) });
  }
}

async function humanMoveAndClick(page, handle) {
  try {
    const box = await handle.boundingBox();
    if (!box) {
      console.log('[LOG] humanMoveAndClick -> sem boundingBox, click direto');
      await handle.click();
      return;
    }
    const start = { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 };
    const steps = 15 + Math.floor(Math.random() * 15);
    const dx = (box.x + box.width / 2 - start.x) / steps;
    const dy = (box.y + box.height / 2 - start.y) / steps;
    console.log(`[LOG] humanMoveAndClick -> movendo mouse de (${start.x.toFixed(0)},${start.y.toFixed(0)}) para botão em ${Math.round(box.x + box.width/2)},${Math.round(box.y + box.height/2)} em ${steps} steps`);
    await page.mouse.move(start.x, start.y);
    for (let i = 0; i < steps; i++) {
      await page.mouse.move(start.x + dx * i + (Math.random() - 0.5) * 3, start.y + dy * i + (Math.random() - 0.5) * 3);
      await page.waitForTimeout(5 + Math.random() * 15);
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(50 + Math.random() * 150);
    console.log('[LOG] humanMoveAndClick -> clicando');
    await handle.click();
  } catch (e) {
    console.warn('[WARN] humanMoveAndClick fallback click direto ->', e.message);
    try { await handle.click(); } catch {}
  }
}

// --- cookies backup helpers ---
async function saveCookies(context) {
  try {
    console.log('[LOG] Salvando backup de cookies em', COOKIE_BACKUP);
    const cookies = await context.cookies();
    await fs.writeFile(COOKIE_BACKUP, JSON.stringify(cookies, null, 2));
    console.log('[OK] cookies salvos.');
  } catch (e) {
    console.warn('[WARN] falha ao salvar backup de cookies:', e.message);
  }
}

async function loadCookies(context) {
  try {
    console.log('[LOG] Tentando carregar backup de cookies de', COOKIE_BACKUP);
    const content = await fs.readFile(COOKIE_BACKUP, 'utf8');
    const cookies = JSON.parse(content);
    if (Array.isArray(cookies) && cookies.length) {
      await context.addCookies(cookies);
      console.log('[OK] cookies restaurados a partir do backup.');
      return true;
    } else {
      console.log('[LOG] Backup de cookies vazio ou inválido.');
    }
  } catch (e) {
    console.log('[LOG] Nenhum backup de cookies encontrado.');
  }
  return false;
}

// --- regra de URL conforme solicitado ---
function evaluateLoginByUrl(currentUrl) {
  const normalized = currentUrl.split('?')[0]; // remove query params para comparar
  if (normalized.startsWith(LOGIN_URL)) return { logged: false, reason: 'url-is-login' };
  if (normalized === HOME_URL || normalized === HOME_URL_ALT) return { logged: true, reason: 'url-is-home' };
  if (currentUrl.startsWith(HOME_URL + '/?') || currentUrl === HOME_URL + '/') return { logged: true, reason: 'url-is-home-variant' };
  return { logged: false, reason: 'url-ambiguous' };
}

// --- main ---
(async () => {
  console.log('[INICIO] iniciando Playwright com perfil persistente em', USER_DATA_DIR);
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // adicione proxy aqui se necessário:
    // proxy: { server: 'http://usuario:senha@proxy:porta' }
  });

  try {
    const page = await context.newPage();
    console.log('[LOG] nova página criada.');

    // cabeçalhos coerentes
    await page.setExtraHTTPHeaders({ 'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8' });

    // tenta restaurar cookies do backup (opcional)
    await loadCookies(context);

    // navega para a pagina de login (Facebook pode redirecionar direto pro home se já logado)
    console.log('[NAV] indo para', LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // checa a URL atual
    let currentUrl = page.url();
    console.log('[STATE] URL atual após goto:', currentUrl);
    let rule = evaluateLoginByUrl(currentUrl);
    console.log('[CHECK] Resultado da regra por URL:', rule);

    if (rule.logged) {
      console.log('[OK] Sessão considerada LOGADA pela regra. URL:', currentUrl);
      await saveCookies(context);
      await context.close();
      console.log('[FIM] contexto fechado. Saindo.');
      return;
    }

    console.log('[INFO] Não logado segundo regra (ou ambíguo). Iremos tentar efetuar login.');

    // selecionar campos conhecidos do Facebook
    const emailSel = 'input#email';
    const passSel = 'input#pass';
    const loginBtnSel = 'button[name="login"], button[type="submit"]';

    // esperar por campos (timeout curto)
    console.log('[WAIT] aguardando campos de email e senha aparecerem...');
    try {
      await page.waitForSelector(emailSel, { timeout: 10000 });
      await page.waitForSelector(passSel, { timeout: 10000 });
      console.log('[OK] campos email e senha encontrados.');
    } catch (err) {
      console.warn('[WARN] campos #email/#pass não encontrados automaticamente:', err.message);
      // tentar encontrar alternativas
      const altEmail = await page.$('input[type="email"], input[name="email"]');
      const altPass = await page.$('input[type="password"], input[name="pass"], input[name="password"]');
      if (altEmail && altPass) {
        console.log('[OK] campos alternativos encontrados. Usando handles diretos.');
        // preencher via handles
        await altEmail.click();
        await page.type(await altEmail.evaluate(node=>node.getAttribute('id') ? `#${node.getAttribute('id')}` : 'input[type="email"]'), EMAIL, { delay: 80 });
        await altPass.click();
        await page.type(await altPass.evaluate(node=>node.getAttribute('id') ? `#${node.getAttribute('id')}` : 'input[type="password"]'), PASSWORD, { delay: 80 });
      } else {
        console.error('[ERRO] Não foi possível localizar campos de login. Screenshot salva.');
        await page.screenshot({ path: 'fb-login-not-found.png' });
        await context.close();
        return;
      }
    }

    // Preencher email e senha
    console.log('[ACTION] preenchendo email...');
    await page.focus(emailSel);
    await page.fill(emailSel, '');
    await humanType(page, emailSel, EMAIL);

    console.log('[ACTION] preenchendo senha...');
    await page.focus(passSel);
    await page.fill(passSel, '');
    await humanType(page, passSel, PASSWORD);

    // achar botão de login
    console.log('[ACTION] procurando botão de login...');
    const btn = await page.$(loginBtnSel);
    if (btn) {
      console.log('[ACTION] botão de login encontrado. Iremos clicar (humanizado).');
      await humanMoveAndClick(page, btn);
    } else {
      console.log('[ACTION] botão não encontrado, farei Enter no campo de senha.');
      await page.keyboard.press('Enter');
    }

    // esperar navegação ou mudança de URL
    console.log('[WAIT] aguardando possível navegação pós-login...');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log('[OK] navegação detectada.');
    } catch (e) {
      console.log('[INFO] espera por navegação expirou (pode ser SPA). Iremos checar URL atual.');
    }

    // checar URL depois do login
    currentUrl = page.url();
    console.log('[STATE] URL após tentativa de login:', currentUrl);
    rule = evaluateLoginByUrl(currentUrl);
    console.log('[CHECK] Resultado da regra por URL (após login):', rule);

    if (rule.logged) {
      console.log('[SUCESSO] Login bem-sucedido detectado pela regra.', rule);
      await saveCookies(context);
    } else {
      console.warn('[FALHA] A regra não detectou login. Possíveis causas: MFA, captcha, bloqueio, ou login falhou.');
      await page.screenshot({ path: 'fb-login-maybe-failed.png' });
    }

    console.log('[FINALIZANDO] fechando contexto...');
    await context.close();
    console.log('[FIM] script finalizado.');
  } catch (err) {
    console.error('[ERRO] exceção não tratada ->', err);
    try { await context.close(); } catch {}
    process.exit(1);
  }
})();
