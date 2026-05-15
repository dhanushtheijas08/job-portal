export const JOB_SITES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "naukri", label: "Naukri" },
  { value: "official_site", label: "Company site" },
  { value: "indeed", label: "Indeed" },
  { value: "other", label: "Other" },
] as const

export type JobSite = (typeof JOB_SITES)[number]["value"]

export const JOB_STATUSES = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]["value"]

/** Matches Postgres `lead_status`; used by `job_leads.status` and `lead_attempts.lead_status`. */
export const LEAD_STATUSES = [
  { value: "not_contacted", label: "Not contacted" },
  {
    value: "connected",
    label: "Connected (LinkedIn request accepted, etc.)",
  },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "closed", label: "Closed" },
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"]

export function jobSiteLabel(value: string) {
  return (
    JOB_SITES.find((s) => s.value === value)?.label ??
    value.replaceAll("_", " ")
  )
}

export function jobStatusLabel(value: string) {
  return (
    JOB_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll("_", " ")
  )
}

export function leadStatusLabel(value: string) {
  return (
    LEAD_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll("_", " ")
  )
}

export type JobRow = {
  id: string
  user_id: string
  job_title: string
  company_name: string
  job_url: string | null
  resume_url: string | null
  site: JobSite | string
  status: JobStatus | string
  is_referred: boolean
  referred_by_name: string | null
  referred_by_profile_url: string | null
  location: string | null
  notes: string | null
  applied_at: string | null
  reminder_at: string | null
  created_at: string
  updated_at: string
}

/** `attachments` row — schema.doc (job / lead / attempt scoped). */
export type AttachmentRow = {
  id: string
  job_id: string | null
  lead_id: string | null
  attempt_id: string | null
  file_url: string
  file_name: string | null
  content_type: string | null
  uploaded_at: string
  user_id: string
}

/** `lead_attempts` row (+ nested attachments when selected). */
export type LeadAttemptRow = {
  id: string
  lead_id: string
  attempt_no: number
  message_text: string | null
  sent_at: string
  reminder_at: string | null
  response_received: boolean
  notes: string | null
  created_at: string
  user_id: string
  lead_status: LeadStatus | string
  attachments?: AttachmentRow[]
}

/** `job_leads` row (+ nested attempts when selected). */
export type JobLeadRow = {
  id: string
  job_id: string
  name: string
  role: string | null
  linkedin_url: string | null
  profile_url: string | null
  email: string | null
  status: LeadStatus | string
  created_at: string
  updated_at: string
  user_id: string
  lead_attempts?: LeadAttemptRow[]
}

/** Single job plus related rows from `/unused/schema.md`. */
export type JobDetailRow = JobRow & {
  job_leads: JobLeadRow[]
  attachments: AttachmentRow[]
}
