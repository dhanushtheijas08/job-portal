import type { VariantProps } from "class-variance-authority"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { jobStatusLabel } from "@/lib/jobs/constants"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function variantForStatus(status: string): BadgeVariant {
  switch (status) {
    case "offer":
    case "accepted":
      return "default"
    case "interview":
    case "screening":
      return "secondary"
    case "rejected":
    case "withdrawn":
      return "destructive"
    default:
      return "outline"
  }
}

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={variantForStatus(status)}>{jobStatusLabel(status)}</Badge>
  )
}
