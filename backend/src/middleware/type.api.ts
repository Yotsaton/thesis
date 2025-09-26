// ./src/middleware/type.api.ts
import { type Request } from "express";

export type Accessor = {
  username: string;        // เจ้าของ token / ผู้เรียกใช้
  is_super_user?: boolean;
  is_staff_user?: boolean;
};

export type AuthenticatedRequest = Request & { auth: Accessor };