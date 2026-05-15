"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  removeResumeObjectsFromStorage,
  resumeObjectPath,
  uploadResumeFile,
} from "@/lib/supabase/upload-resume"
import {
  emptyToNull,
  type ResumeEntry,
  type UserSettingsFormValues,
} from "@/lib/users/profile-schema"

export type UpdateUserProfileInput = {
  values: UserSettingsFormValues
  resumeFiles: (File | null)[]
  removedStorageUrls: string[]
  userId: string
  user_name: string
  email: string
}

async function buildResumesForDb(
  values: UserSettingsFormValues,
  resumeFiles: (File | null)[],
  userId: string
): Promise<{ resumes: ResumeEntry[]; replacedStorageUrls: string[] }> {
  const prepared: ResumeEntry[] = []
  const replacedStorageUrls: string[] = []

  for (let i = 0; i < values.resumes.length; i++) {
    const r = values.resumes[i]!
    const file = resumeFiles[i] ?? null
    const name = r.name.trim()
    const existingUrl = r.url.trim()
    if (!name && !existingUrl && !file) continue
    if (!name) {
      throw new Error(`Resume row ${i + 1}: add a display name.`)
    }

    let url = existingUrl
    if (file) {
      if (url) replacedStorageUrls.push(url)
      const path = resumeObjectPath(userId, r.id, file)
      const { publicUrl } = await uploadResumeFile({ file, objectPath: path })
      url = publicUrl
    } else if (!url) {
      throw new Error(`“${name}”: choose a file to upload, or remove the row.`)
    }

    prepared.push({
      id: r.id,
      name,
      url,
      last_used_at: r.last_used_at?.trim() ? r.last_used_at : null,
    })
  }

  return { resumes: prepared, replacedStorageUrls }
}

export function useUpdateUserProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      values,
      resumeFiles,
      removedStorageUrls,
      userId,
      user_name,
      email,
    }: UpdateUserProfileInput) => {
      const { resumes, replacedStorageUrls } = await buildResumesForDb(
        values,
        resumeFiles,
        userId
      )

      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from("users").upsert(
        {
          id: userId,
          user_name,
          email,
          linkedin_url: emptyToNull(values.linkedin_url),
          github_url: emptyToNull(values.github_url),
          portfolio_url: emptyToNull(values.portfolio_url),
          resumes,
        },
        { onConflict: "id" }
      )

      if (error) throw error

      const urlsToRemove = [
        ...new Set([...removedStorageUrls, ...replacedStorageUrls]),
      ]
      if (urlsToRemove.length) {
        await removeResumeObjectsFromStorage(urlsToRemove)
      }
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["user-profile", vars.userId],
      })
    },
  })
}
