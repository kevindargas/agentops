import { cn } from "cn"

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to a paragraph. */
  as?: "p" | "span" | "div" | "h2" | "h3" | "h4" | "h5" | "label"
  /** Monospace flavour used on error, 404 and status pages. */
  mono?: boolean
  children: React.ReactNode
}

/**
 * Small uppercase label above a title or section heading ("Agent Operations",
 * "Error 404"). Replaces hand-rolled `text-[11px] uppercase tracking-...`
 * spans so every eyebrow shares one size, weight and colour.
 */
export function Eyebrow({
  as: Tag = "p",
  mono = false,
  className,
  children,
  ...props
}: EyebrowProps) {
  return (
    <Tag
      data-slot="eyebrow"
      className={cn(mono ? "eyebrow-mono" : "eyebrow", className)}
      {...props}
    >
      {children}
    </Tag>
  )
}
