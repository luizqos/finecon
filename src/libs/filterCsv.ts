import { Request } from 'express'
import { FileFilterCallback } from 'multer';

export const csvFilter = (
  req: Request, 
  file: Express.Multer.File, 
  cb: FileFilterCallback
) => {
  const extension = file.originalname.toLowerCase().endsWith('.csv');
  const mimetype = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';

  if (extension && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos CSV são permitidos!') as any, false);
  }
};