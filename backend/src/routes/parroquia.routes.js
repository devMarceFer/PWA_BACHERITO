import { Router } from 'express';
import parroquiaController from '../controllers/parroquia.controller.js';

const router = Router();
router.get('/parroquias', parroquiaController.getParroquias);

export default router;