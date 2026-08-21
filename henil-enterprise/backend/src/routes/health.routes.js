import { Router } from 'express';
import { getHealth, getDatabaseHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health — confirms the backend is up and reachable.
router.get('/', getHealth);

// GET /api/health/db — confirms the backend can reach Supabase.
router.get('/db', getDatabaseHealth);

export default router;
