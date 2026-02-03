import express from 'express';
import cors from 'cors';
import conciliacaoRoutes from './src/api/routes/conciliacao.routes';
import { cleanOldFiles } from '@/scripts/cleanup';
import fs from 'fs';
import pino from 'pino';
const logger = pino();

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// API Routes
app.use('/api/conciliacao', conciliacaoRoutes);

const PORT = process.env.API_PORT || 9001;
const HOST = '0.0.0.0';
const server = app.listen(Number(PORT), HOST, () => {
  logger.info({ host: HOST, port: PORT }, 'Servidor iniciado');
});

server.timeout = 600000; 
server.headersTimeout = 610000;
server.keepAliveTimeout = 605000;

const TRINTA_MINUTOS = 30 * 60 * 1000;
setInterval(() => {
  cleanOldFiles();
}, TRINTA_MINUTOS);