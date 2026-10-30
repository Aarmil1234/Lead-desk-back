import type { Request, Response, NextFunction } from 'express';
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);
}
export function fail(res: Response, message: string, status = 400) { return res.status(status).json({ error: message }); }
export function normalizePhone(value: string) { return value.replace(/[^0-9+]/g, '').replace(/^00/, '+'); }
