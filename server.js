const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const shortid = require('shortid');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
const NGROK_URL = process.env.NGROK_URL || 'https://generadorlinkemergencia.ngrok.io';
const SECRET_KEY = process.env.SECRET_KEY || '3hiLgUr5y+vrMYiVTbeFIvyubmhzRli0gveP//FQTMM=';

const linkMap = new Map();

// Middleware para servir archivos estáticos
app.use('/r', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Middleware para verificar y servir archivos HTML
app.use((req, res, next) => {
    const fileRequested = req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
    const filePath = path.join(__dirname, 'public', `${fileRequested}.html`);
    fs.access(filePath, fs.constants.F_OK, err => {
        if (err) {
            console.error(`File not found at ${filePath}, moving to next middleware.`);
            next();
        } else {
            console.log(`Serving file from path: ${filePath}`);
            res.sendFile(filePath);
        }
    });
});

// Ruta para generar enlaces dinámicos
app.get('/generate-link', (req, res) => {
    const sessionId = uuidv4();
    const token = jwt.sign({ sessionId }, SECRET_KEY, { expiresIn: '1h' });
    const shortId = shortid.generate();
    const link = `${NGROK_URL}/r/${shortId}`;
    linkMap.set(shortId, { sessionId, token, expiresAt: Date.now() + 3600000 });
    console.log(`Link generated with ID: ${shortId} and session: ${sessionId}`);
    res.json({ link });
});

// Ruta para manejar el acceso a los enlaces cortos
app.get('/r/:shortId', (req, res) => {
    const { shortId } = req.params;
    const data = linkMap.get(shortId);
    if (!data || Date.now() > data.expiresAt) {
        console.error(`Access denied or link expired for shortId: ${shortId}`);
        linkMap.delete(shortId);
        res.status(403).send('Access denied. Link expired or invalid.');
    } else {
        console.log(`Accessing link with ID: ${shortId}`);
        jwt.verify(data.token, SECRET_KEY, (err, decoded) => {
            if (err) {
                console.error(`JWT verification failed for session: ${data.sessionId}, error: ${err.message}`);
                res.status(403).send('Access denied. Invalid or expired token.');
            } else {
                res.sendFile(path.join(__dirname, 'public', 'index.html'));
            }
        });
    }
});

// Ruta para la página del operador
app.get('/operator', (req, res) => {
    console.log('Operator page accessed.');
    res.sendFile(path.join(__dirname, 'public', 'operator.html'));
});

// Middleware para manejar errores 404
app.use((req, res) => {
    console.error(`404 Error for path: ${req.url}`);
    res.status(404).send('Page not found');
});

// Manejo de conexiones WebSocket con Socket.IO
io.on('connection', (socket) => {
    console.log(`New socket connection: ${socket.id}`);
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
