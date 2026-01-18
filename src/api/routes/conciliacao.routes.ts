import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { processarConciliacao, excelProgress, gerarExcel, baixarArquivo } from '../controllers/conciliacao.controller';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});


const router = Router();
const upload = multer({ storage });

router.post('/processar', upload.fields([
  { name: 'file_jd', maxCount: 1 },
  { name: 'file_core', maxCount: 1 }
]), processarConciliacao);

router.get('/progress/:taskId', (req, res) => {
  const progress = excelProgress[req.params.taskId] || { porcentagem: 0, linhas: 0, etapa: 'Aguardando...' };
  res.json(progress);
});

router.post('/gerar-excel', upload.fields([
  { name: 'file_jd', maxCount: 1 },
  { name: 'file_core', maxCount: 1 }
]), gerarExcel);

router.get('/baixar-arquivo/:taskId', baixarArquivo);

export default router;