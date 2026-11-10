import { currentUser, groups, roles, users, type Role } from "@/lib/data/users"
import { createListStore } from "@/lib/store"
import type { Group, User } from "@/lib/types"

export type UserStatus = "Active" | "Pending" | "Deactivated"

/**
 * Directory row as the admin page sees it. `status`, `roleOverride` and
 * `extraGroupIds` are session state layered over the seeded `User`; the
 * derived helpers below fall back to the seed rules when they are unset.
 */
export interface AdminUser extends User {
  status?: UserStatus
  roleOverride?: Role[]
  extraGroupIds?: string[]
}

/** Shared by the users table, the stat row, the tab counts and the invite sheet. */
export const usersStore = createListStore<AdminUser>(users, (u) => u.id)

/** Shared by the groups grid, the tab counts and the "New group" sheet. */
export const groupsStore = createListStore<Group>(groups, (g) => g.id)

export function statusOf(u: AdminUser): UserStatus {
  if (u.status) return u.status
  return u.title.startsWith("New Hire") ? "Pending" : "Active"
}

/** Roles are not stored on the seeded user; derive them from department and ownership. */
export function rolesOf(u: AdminUser): Role[] {
  if (u.roleOverride) return u.roleOverride
  if (u.id === currentUser.id) return ["admin", "itil"]
  if (u.department === "IT") return ["itil"]
  if (u.department === "People") return ["approver"]
  if (u.department === "Finance") return ["finance_viewer"]
  return ["readonly"]
}

export function groupCountOf(u: AdminUser, list: Group[] = groupsStore.get()) {
  const managed = list.filter((g) => g.manager === u.id).length
  const base = managed || (u.department === "IT" ? 1 : 0)
  return base + (u.extraGroupIds?.length ?? 0)
}

export const userStatuses: UserStatus[] = ["Active", "Pending", "Deactivated"]

export { roles }
