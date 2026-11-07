export interface AuthPrincipal {
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}
