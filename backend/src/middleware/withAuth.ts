// src/middleware/withAuth.ts
import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "./type.api";

export const withAuth = (handler: (req: AuthenticatedRequest, res: Parameters<RequestHandler>[1]) => ReturnType<RequestHandler>): RequestHandler => {
  return (req, res, next) => {
    if (!(req as AuthenticatedRequest).auth) {
      return res.status(401).json({ error: "unauthorized" });
    }
    
    return Promise.resolve(handler(req as AuthenticatedRequest, res)).catch(next);
  };
};
