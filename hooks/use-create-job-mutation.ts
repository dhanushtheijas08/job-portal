"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  attemptHasOutboundContent,
  emptyToUndefined,
  rollUpLeadAggregateStatus,
  type JobFormValues,
  type LeadAttemptFormValues,
  toJobInsertPayload,
} from "@/lib/jobs/job-form-schema"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { uploadAttachmentFile } from "@/lib/supabase/upload-job-attachment"

export type CreateJobWithFilesInput = {
  values: JobFormValues
  /** Parallel to each `job_leads[i].attempts[j]` optional file */
  attemptAttachments: (File | null)[][]
}

function safeFileSegment(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 180) || "file"
}

function attachmentObjectPath(userId: string, file: File) {
  const safe = safeFileSegment(file.name)
  const dot = safe.lastIndexOf(".")
  const base = (dot > 0 ? safe.slice(0, dot) : safe) || "file"
  const ext = dot > 0 ? safe.slice(dot) : ""
  const buf = new Uint16Array(1)
  crypto.getRandomValues(buf)
  const suffix = String(buf[0] % 10000).padStart(4, "0")
  return `${userId}/${base}-${suffix}${ext}`
}

function attemptReminderIso(reminderRaw: string | undefined): string | null {
  const r = reminderRaw?.trim()
  return r ? new Date(`${r}T12:00:00`).toISOString() : null
}

function buildAttemptPayload(
  userId: string,
  leadId: string,
  attemptNo: number,
  att: LeadAttemptFormValues
) {
  return {
    user_id: userId,
    lead_id: leadId,
    attempt_no: attemptNo,
    message_text: emptyToUndefined(att.message_text) ?? null,
    notes: emptyToUndefined(att.notes) ?? null,
    response_received: false,
    reminder_at: attemptReminderIso(att.reminder_at),
    lead_status: att.lead_status,
  }
}

export function useCreateJobMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      values,
      attemptAttachments,
    }: CreateJobWithFilesInput) => {
      if (!userId) throw new Error("You must be signed in to add a job.")

      for (let li = 0; li < attemptAttachments.length; li++) {
        const row = attemptAttachments[li]
        if (!row?.some(Boolean)) continue
        const leadName = emptyToUndefined(values.job_leads[li]?.contact_name)
        if (!leadName) {
          throw new Error(
            "Add a contact name for every row that has an outreach attachment."
          )
        }
      }

      const supabase = getSupabaseBrowserClient()
      const jobPayload = toJobInsertPayload(values, userId)

      const { data: jobRow, error: jobError } = await supabase
        .from("jobs")
        .insert(jobPayload)
        .select("id")
        .single()

      if (jobError) throw jobError
      const jobId = jobRow.id as string

      for (let li = 0; li < values.job_leads.length; li++) {
        const lead = values.job_leads[li]!
        const leadName = emptyToUndefined(lead.contact_name)
        if (!leadName) continue

        const leadFiles = attemptAttachments[li] ?? []
        type SubstantiveMeta = {
          att: LeadAttemptFormValues
          attemptUiIndex: number
        }
        const substantive: SubstantiveMeta[] = []
        lead.attempts.forEach((att, ai) => {
          const hasFile = Boolean(leadFiles[ai])
          if (!attemptHasOutboundContent(att) && !hasFile) return
          substantive.push({ att, attemptUiIndex: ai })
        })

        const aggregateStatus = rollUpLeadAggregateStatus({
          attemptsWithContent: substantive.map((s) => s.att),
        })

        const { data: leadRow, error: leadError } = await supabase
          .from("job_leads")
          .insert({
            user_id: userId,
            job_id: jobId,
            name: leadName,
            role: emptyToUndefined(lead.role) ?? null,
            linkedin_url: emptyToUndefined(lead.linkedin_url) ?? null,
            profile_url: null,
            email: null,
            status: aggregateStatus,
          })
          .select("id")
          .single()

        if (leadError) throw leadError
        const leadId = leadRow.id as string

        let attemptNo = 1
        for (const { att, attemptUiIndex } of substantive) {
          const { data: attemptRow, error: attemptErr } = await supabase
            .from("lead_attempts")
            .insert(buildAttemptPayload(userId, leadId, attemptNo++, att))
            .select("id")
            .single()

          if (attemptErr) throw attemptErr
          const attemptId = attemptRow.id as string
          const file = leadFiles[attemptUiIndex] ?? null
          if (!file) continue

          const path = attachmentObjectPath(userId, file)
          const { publicUrl } = await uploadAttachmentFile({
            file,
            objectPath: path,
          })
          const { error: attErr } = await supabase.from("attachments").insert({
            user_id: userId,
            attempt_id: attemptId,
            file_url: publicUrl,
            file_name: file.name,
            content_type: file.type || null,
          })
          if (attErr) throw attErr
        }
      }

      return { jobId }
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ["jobs", userId] })
      }
    },
  })
}
