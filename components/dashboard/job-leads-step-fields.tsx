"use client"

import { CalendarIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
} from "react-hook-form"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { LEAD_STATUSES } from "@/lib/jobs/constants"
import { formatYmdFromDate, parseYmdToLocalDate } from "@/lib/jobs/dates"
import {
  attemptHasOutboundContent,
  emptyJobLeadForm,
  emptyLeadAttemptForm,
  MAX_ATTEMPTS_PER_LEAD,
  MAX_JOB_LEADS,
  type JobFormValues,
} from "@/lib/jobs/job-form-schema"
import { cn } from "@/lib/utils"

function formatCalendarLabel(value: string): string {
  const d = parseYmdToLocalDate(value)
  if (!d) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d)
}

function RequiredMark() {
  return (
    <span className="ms-0.5 text-red-500" aria-hidden>
      *
    </span>
  )
}

type JobLeadsStepFieldsProps = {
  control: Control<JobFormValues>
  attemptAttachments: (File | null)[][]
  onPatchAttemptFile: (
    leadIndex: number,
    attemptIndex: number,
    file: File | null
  ) => void
  onAfterAppendLead: () => void
  onAfterRemoveLead: (leadIndex: number) => void
  onAfterAppendAttempt: (leadIndex: number) => void
  onAfterRemoveAttempt: (leadIndex: number, attemptIndex: number) => void
}

export function JobLeadsStepFields({
  control,
  attemptAttachments,
  onPatchAttemptFile,
  onAfterAppendLead,
  onAfterRemoveLead,
  onAfterAppendAttempt,
  onAfterRemoveAttempt,
}: JobLeadsStepFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "job_leads",
  })

  const firstLeadId = fields[0]?.id

  return (
    <div className="space-y-6">
      <Accordion
        type="multiple"
        className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-xs"
        defaultValue={
          typeof firstLeadId === "string" ? [firstLeadId] : undefined
        }
      >
        {fields.map((field, leadIndex) => (
          <ContactAccordionLead
            key={field.id}
            accordionItemValue={field.id}
            leadIndex={leadIndex}
            control={control}
            canRemoveLead={fields.length > 1}
            onRemoveLead={() => {
              remove(leadIndex)
              onAfterRemoveLead(leadIndex)
            }}
            attemptFiles={attemptAttachments[leadIndex] ?? []}
            onPatchAttemptFile={onPatchAttemptFile}
            onAfterAppendAttempt={() => onAfterAppendAttempt(leadIndex)}
            onAfterRemoveAttempt={(attemptIndex) =>
              onAfterRemoveAttempt(leadIndex, attemptIndex)
            }
          />
        ))}
      </Accordion>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={fields.length >= MAX_JOB_LEADS}
        onClick={() => {
          append(emptyJobLeadForm())
          onAfterAppendLead()
        }}
      >
        <PlusIcon className="size-4" aria-hidden />
        Add contact
      </Button>
    </div>
  )
}

type ContactAccordionLeadProps = {
  accordionItemValue: string
  leadIndex: number
  control: Control<JobFormValues>
  canRemoveLead: boolean
  onRemoveLead: () => void
  attemptFiles: (File | null)[]
  onPatchAttemptFile: (
    leadIndex: number,
    attemptIndex: number,
    file: File | null
  ) => void
  onAfterAppendAttempt: () => void
  onAfterRemoveAttempt: (attemptIndex: number) => void
}

function ContactAccordionLead({
  accordionItemValue,
  leadIndex,
  control,
  canRemoveLead,
  onRemoveLead,
  attemptFiles,
  onPatchAttemptFile,
  onAfterAppendAttempt,
  onAfterRemoveAttempt,
}: ContactAccordionLeadProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `job_leads.${leadIndex}.attempts`,
  })

  const attemptsWatch = useWatch({
    control,
    name: `job_leads.${leadIndex}.attempts`,
  })

  const contactNameLive = useWatch({
    control,
    name: `job_leads.${leadIndex}.contact_name`,
  })

  const leadNameRequired =
    attemptsWatch?.some(
      (att, i) =>
        (att && attemptHasOutboundContent(att)) || Boolean(attemptFiles[i])
    ) ?? false

  const namePreview = contactNameLive?.trim()
    ? contactNameLive.trim().length > 72
      ? `${contactNameLive.trim().slice(0, 69)}…`
      : contactNameLive.trim()
    : null

  return (
    <AccordionItem
      value={accordionItemValue}
      className="px-3 last:border-b-0 sm:px-4"
    >
      <div className="flex items-start">
        <AccordionTrigger className="min-w-0 flex-1 items-start py-4 hover:no-underline">
          <span className="flex min-w-0 flex-col gap-1 text-start">
            <span className="truncate">Contact {leadIndex + 1}</span>
            <span className="max-w-[min(100vw-8rem,32rem)] truncate text-sm font-normal text-muted-foreground">
              {namePreview ??
                `Add a name • ${fields.length} outreach attempt${fields.length === 1 ? "" : "s"}`}
            </span>
          </span>
        </AccordionTrigger>
        {canRemoveLead ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-5 size-9 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove contact"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={onRemoveLead}
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
      </div>

      <AccordionContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 md:items-start">
          <Controller
            name={`job_leads.${leadIndex}.contact_name`}
            control={control}
            render={({ field, fieldState }) => (
              <Field className="min-w-0" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`lead-name-${leadIndex}`}>
                  Name
                  {leadNameRequired ? <RequiredMark /> : null}
                </FieldLabel>
                <FieldContent>
                  <Input
                    id={`lead-name-${leadIndex}`}
                    placeholder="Hiring manager or recruiter"
                    required={leadNameRequired}
                    aria-required={leadNameRequired}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name={`job_leads.${leadIndex}.role`}
            control={control}
            render={({ field, fieldState }) => (
              <Field className="min-w-0" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`lead-role-${leadIndex}`}>Role</FieldLabel>
                <FieldContent>
                  <Input
                    id={`lead-role-${leadIndex}`}
                    placeholder="Engineering manager"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name={`job_leads.${leadIndex}.linkedin_url`}
            control={control}
            render={({ field, fieldState }) => (
              <Field
                className="min-w-0 md:col-span-2"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={`lead-li-${leadIndex}`}>
                  LinkedIn
                </FieldLabel>
                <FieldContent>
                  <Input
                    id={`lead-li-${leadIndex}`}
                    type="url"
                    inputMode="url"
                    placeholder="https://linkedin.com/in/…"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </div>

        <Separator className="my-5" />

        <p className="mb-3 text-sm font-medium text-foreground">
          Outreach attempts
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          Expand each attempt to edit message, follow-up, status, and
          attachment.
        </p>

        <Accordion
          type="multiple"
          className="w-full overflow-hidden rounded-lg border border-border/90 bg-muted/15"
          defaultValue={
            typeof fields[0]?.id === "string" ? [fields[0].id] : undefined
          }
        >
          {fields.map((afield, attemptIndex) => (
            <AttemptLeadAccordionItem
              key={afield.id}
              accordionItemValue={afield.id}
              leadIndex={leadIndex}
              attemptIndex={attemptIndex}
              attemptNumberTotal={fields.length}
              control={control}
              file={attemptFiles[attemptIndex] ?? null}
              onFileChange={(file) =>
                onPatchAttemptFile(leadIndex, attemptIndex, file)
              }
              canRemoveAttempt={fields.length > 1}
              onRemoveAttempt={() => {
                remove(attemptIndex)
                onAfterRemoveAttempt(attemptIndex)
              }}
            />
          ))}
        </Accordion>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 gap-1.5"
          disabled={fields.length >= MAX_ATTEMPTS_PER_LEAD}
          onClick={() => {
            append(emptyLeadAttemptForm())
            onAfterAppendAttempt()
          }}
        >
          <PlusIcon className="size-4" aria-hidden />
          Add attempt
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}

type AttemptLeadAccordionItemProps = {
  accordionItemValue: string
  leadIndex: number
  attemptIndex: number
  control: Control<JobFormValues>
  attemptNumberTotal: number
  file: File | null
  onFileChange: (file: File | null) => void
  canRemoveAttempt: boolean
  onRemoveAttempt: () => void
}

function AttemptLeadAccordionItem({
  accordionItemValue,
  leadIndex,
  attemptIndex,
  control,
  attemptNumberTotal,
  file,
  onFileChange,
  canRemoveAttempt,
  onRemoveAttempt,
}: AttemptLeadAccordionItemProps) {
  const leadStatus = useWatch({
    control,
    name: `job_leads.${leadIndex}.attempts.${attemptIndex}.lead_status`,
  })
  const statusLabel =
    LEAD_STATUSES.find((s) => s.value === leadStatus)?.label ?? "Status"

  return (
    <AccordionItem
      value={accordionItemValue}
      className="border-border/40 px-2 last:border-b-0 sm:px-3"
    >
      <div className="flex items-start gap-px">
        <AccordionTrigger className="min-w-0 flex-1 items-start py-3 hover:no-underline [&_svg]:mr-0">
          <span className="flex min-w-0 flex-col gap-0.5 text-start">
            <span className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Attempt {attemptIndex + 1}
              {attemptNumberTotal > 1 ? ` · ${attemptNumberTotal} total` : ""}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {statusLabel}
            </span>
          </span>
        </AccordionTrigger>
        {canRemoveAttempt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4.5 h-8 shrink-0 gap-1 text-xs text-muted-foreground hover:text-destructive"
            aria-label={`Remove attempt ${attemptIndex + 1}`}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={onRemoveAttempt}
          >
            <Trash2Icon className="size-3.5 shrink-0" aria-hidden />
          </Button>
        ) : null}
      </div>
      <AccordionContent className="px-2 sm:px-3">
        <AttemptFormFields
          leadIndex={leadIndex}
          attemptIndex={attemptIndex}
          control={control}
          file={file}
          onFileChange={onFileChange}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

type AttemptFormFieldsProps = {
  leadIndex: number
  attemptIndex: number
  control: Control<JobFormValues>
  file: File | null
  onFileChange: (file: File | null) => void
}

function AttemptFormFields({
  leadIndex,
  attemptIndex,
  control,
  file,
  onFileChange,
}: AttemptFormFieldsProps) {
  const base = `job_leads.${leadIndex}.attempts.${attemptIndex}` as const
  const [reminderOpen, setReminderOpen] = useState(false)

  return (
    <div className="grid gap-x-6 gap-y-5 pb-2 md:grid-cols-2 md:items-start">
      <Controller
        name={`${base}.message_text`}
        control={control}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 md:col-span-2"
            data-invalid={fieldState.invalid}
          >
            <FieldLabel htmlFor={`${base}-msg`}>Message</FieldLabel>
            <FieldContent>
              <Textarea
                id={`${base}-msg`}
                rows={3}
                placeholder="What you sent or plan to send…"
                className="min-h-[88px] resize-y"
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        name={`${base}.notes`}
        control={control}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 md:col-span-2"
            data-invalid={fieldState.invalid}
          >
            <FieldLabel htmlFor={`${base}-notes`}>Attempt notes</FieldLabel>
            <FieldContent>
              <Textarea
                id={`${base}-notes`}
                rows={3}
                placeholder="Private notes (saved on this attempt)…"
                className="min-h-[88px] resize-y"
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        name={`${base}.reminder_at`}
        control={control}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 md:items-start md:justify-self-start"
            data-invalid={fieldState.invalid}
          >
            <FieldLabel htmlFor={`${base}-rem`}>Attempt follow-up</FieldLabel>
            <FieldContent>
              <Popover open={reminderOpen} onOpenChange={setReminderOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={`${base}-rem`}
                    type="button"
                    variant="outline"
                    aria-invalid={fieldState.invalid}
                    className={cn(
                      "h-9 w-full max-w-[min(100%,20rem)] justify-start gap-2 font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon
                      className="size-4 shrink-0 opacity-70"
                      aria-hidden
                    />
                    {field.value ? (
                      formatCalendarLabel(field.value ?? "")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseYmdToLocalDate(field.value ?? "")}
                    onSelect={(d) => {
                      field.onChange(d ? formatYmdFromDate(d) : "")
                      setReminderOpen(false)
                    }}
                    defaultMonth={
                      parseYmdToLocalDate(field.value ?? "") ?? new Date()
                    }
                  />
                </PopoverContent>
              </Popover>
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        name={`${base}.lead_status`}
        control={control}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 md:items-start"
            data-invalid={fieldState.invalid}
          >
            <FieldLabel>Outreach status</FieldLabel>
            <FieldContent>
              <Select
                required
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  className="w-full max-w-[min(100%,20rem)]"
                  aria-invalid={fieldState.invalid}
                  aria-required
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Field className="min-w-0 md:col-span-2">
        <FieldLabel htmlFor={`${base}-file`}>Attachment</FieldLabel>
        <FieldContent className="space-y-2">
          <Input
            id={`${base}-file`}
            type="file"
            className="h-10 cursor-pointer pb-1 text-muted-foreground file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
            onChange={(e) => {
              onFileChange(e.target.files?.[0] ?? null)
            }}
          />
          {file ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onFileChange(null)}
              >
                Remove file
              </Button>
            </div>
          ) : null}
        </FieldContent>
      </Field>
    </div>
  )
}
