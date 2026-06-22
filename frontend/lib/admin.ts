import { ADMIN_ADDRESSES } from "./constants";

export function isAdminAddress(address?: string | null): boolean {
  if (!address) return false;
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}
