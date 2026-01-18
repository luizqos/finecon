import express from 'express';
import cors from 'cors';
import conciliacaoRoutes from './src/api/routes/conciliacao.routes';
import { cleanOldFiles } from '@/scripts/cleanup';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// API Routes
app.use('/api/conciliacao', conciliacaoRoutes);

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Servidor Finecon rodando na porta ${PORT}`);
});

server.timeout = 600000; 
server.headersTimeout = 610000;
server.keepAliveTimeout = 605000;

const TRINTA_MINUTOS = 30 * 60 * 1000;
setInterval(() => {
  cleanOldFiles();
}, TRINTA_MINUTOS);