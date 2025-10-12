// src/activity/types/types.api.ts

import { z } from "zod";

export const QuerySchema = z.object({
  username: z.string().min(1).optional(),
  ip: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.coerce.number().int().optional(),
  asc: z.coerce.number().int().optional(), // 1 = ASC, 0/omit = DESC
});