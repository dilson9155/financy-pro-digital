"use client";

import { createContext, useContext } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
}

export interface SessionMembership {
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface SessionCompany {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
}

export interface SessionValue {
  user: SessionUser;
  company: SessionCompany;
  companyId: string;
  permissions: string[];
  memberships: SessionMembership[];
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionValue;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve ser usado dentro de SessionProvider");
  return ctx;
}

export function useCan() {
  const { permissions, user } = useSession();
  const set = new Set(permissions);
  return (permission: string) => user.isSuperAdmin || set.has(permission);
}
