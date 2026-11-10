import { cn } from "cn"
import { UsersIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getGroup, getUser, initials } from "@/lib/data/users"

export type UserChipSize = "xs" | "sm" | "md" | "lg"

const sizeClasses: Record<
  UserChipSize,
  { avatar: string; name: string; sub: string; gap: string }
> = {
  xs: {
    avatar: "size-5 text-[9px]",
    name: "text-xs",
    sub: "text-[11px]",
    gap: "gap-1.5",
  },
  sm: {
    avatar: "size-6 text-[10px]",
    name: "text-sm",
    sub: "text-xs",
    gap: "gap-2",
  },
  md: {
    avatar: "size-8 text-xs",
    name: "text-sm",
    sub: "text-xs",
    gap: "gap-2.5",
  },
  lg: {
    avatar: "size-10 text-sm",
    name: "text-base",
    sub: "text-sm",
    gap: "gap-3",
  },
}

/** Deterministic hue (0-359) from a string so a person always gets the same avatar color. */
export function hueFromString(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++)
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h % 360
}

/** Gradient style for an initials avatar; white text stays ≥ 4.5:1 on these lightnesses. */
export function avatarGradient(seed: string): React.CSSProperties {
  const hue = hueFromString(seed)
  return {
    backgroundImage: `linear-gradient(135deg, oklch(0.6 0.13 ${hue}) 0%, oklch(0.46 0.15 ${(hue + 36) % 360}) 100%)`,
    color: "oklch(0.99 0 0)",
  }
}

export function UserChip({
  userId,
  size = "sm",
  showTitle = false,
  className,
  fallback = "Unassigned",
  hideName = false,
  secondary,
  presence,
  showVip = false,
}: {
  userId?: string
  size?: UserChipSize
  showTitle?: boolean
  className?: string
  fallback?: string
  /** Avatar only; the full name goes into the `title` attribute. */
  hideName?: boolean
  /** Custom second line (overrides `showTitle`). */
  secondary?: React.ReactNode
  /** Presence dot on the avatar. */
  presence?: "online" | "away" | "offline"
  /** Show a small VIP tag after the name for flagged users. */
  showVip?: boolean
}) {
  const user = getUser(userId)
  if (!user) {
    return (
      <span className={cn("text-muted-foreground italic", className)}>
        {fallback}
      </span>
    )
  }
  const s = sizeClasses[size]
  const sub = secondary ?? (showTitle ? user.title : undefined)
  return (
    <span
      className={cn("inline-flex min-w-0 items-center", s.gap, className)}
      title={
        hideName
          ? `${user.name}${user.title ? ` · ${user.title}` : ""}`
          : undefined
      }
    >
      <span className="relative shrink-0">
        <Avatar className={cn(s.avatar, "shrink-0")}>
          {user.avatar && <AvatarImage src={user.avatar} alt="" />}
          <AvatarFallback
            className="font-semibold tracking-wide"
            style={avatarGradient(user.id || user.name)}
          >
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        {presence && (
          <span
            aria-label={presence}
            className={cn(
              "absolute -right-px -bottom-px block rounded-full ring-2 ring-card",
              size === "xs" ? "size-1.5" : size === "lg" ? "size-3" : "size-2",
              presence === "online"
                ? "bg-success"
                : presence === "away"
                  ? "bg-warning"
                  : "bg-muted-foreground/50"
            )}
          />
        )}
      </span>
      {!hideName && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn("truncate", s.name)}>
            {user.name}
            {showVip && user.vip && (
              <span className="ml-1.5 inline-flex h-4 items-center rounded-sm bg-warning/15 px-1 align-middle text-[10px] font-semibold tracking-wide text-warning-text">
                VIP
              </span>
            )}
          </span>
          {sub && (
            <span className={cn("truncate text-muted-foreground", s.sub)}>
              {sub}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

export function GroupChip({
  groupId,
  className,
  icon = false,
}: {
  groupId?: string
  className?: string
  icon?: boolean
}) {
  const group = getGroup(groupId)
  if (!group)
    return <span className={cn("text-muted-foreground", className)}>—</span>
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm",
        className
      )}
      title={group.description}
    >
      {icon && (
        <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{group.name}</span>
    </span>
  )
}
