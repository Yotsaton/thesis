// src/api/cProject.api.ts
import { Router } from 'express';
import { createProject } from '../trip/function/createTrip';

const router = Router();

// POST /api/v1/projects
router.post('/', createProject);

export default router;
