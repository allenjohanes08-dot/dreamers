// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users, customerProfiles } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken & { dbUser?: any };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Unauthorized: Invalid token provided' });
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Sync user with DB
    let dbUser = null;
    try {
      const [foundUser] = await db.select().from(users).where(eq(users.uid, decodedToken.uid)).limit(1);
      dbUser = foundUser;

      if (!dbUser && decodedToken.email) {
        const [userByEmail] = await db.select().from(users).where(eq(users.email, decodedToken.email)).limit(1);
        if (userByEmail) {
          dbUser = userByEmail;
          if (dbUser.uid !== decodedToken.uid) {
            await (db.update(users) as any).set({ uid: decodedToken.uid }).where(eq(users.id, dbUser.id));
          }
        }
      }
    } catch (dbErr) {
      console.error('Database query error in requireAuth:', dbErr);
    }

    if (dbUser && (dbUser.verificationStatus === 'SUSPENDED' || dbUser.verificationStatus === 'REVOKED')) {
      return res.status(403).json({ error: 'Unauthorized: Your account has been suspended or revoked' });
    }
    
    req.user = { ...decodedToken, dbUser: dbUser || null };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.dbUser) {
      return res.status(401).json({ error: 'Registration required: Account has not been created yet', isNewUser: true });
    }

    const dbUser = req.user.dbUser;

    if (dbUser.verificationStatus === 'SUSPENDED' || dbUser.verificationStatus === 'REVOKED') {
      return res.status(403).json({ error: 'Forbidden: Account is suspended or access revoked' });
    }

    const userRole = dbUser.role;
    const isVerified = dbUser.verificationStatus === 'VERIFIED';

    // Admins have access to everything
    if (userRole === 'ADMIN') {
      return next();
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions for verified role' });
    }

    // For SELLER or LOGISTICS, verificationStatus must be VERIFIED
    if ((userRole === 'SELLER' || userRole === 'LOGISTICS') && !isVerified) {
      return res.status(403).json({ error: 'Forbidden: Role verification is pending approval from Admin' });
    }

    next();
  };
};
