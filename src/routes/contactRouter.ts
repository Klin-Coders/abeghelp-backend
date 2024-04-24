import express from 'express';
import { createContactMessage, getAllContactMessages, getOneContactMessage } from '@/controllers';

const router = express.Router();

// TODO: add admin guards for this route

router.post('/create', createContactMessage);
router.get('/all', getAllContactMessages);
router.get('/:id', getOneContactMessage);

export { router as contactRouter };
