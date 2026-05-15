import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export function getResumesBucketName(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_RESUMES_BUCKET?.trim() || "resumes"
}

function safeFileSegment(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 180) || "file"
}

export function resumeObjectPath(
  userId: string,
  resumeEntryId: string,
  file: File
) {
  const safe = safeFileSegment(file.name)
  const dot = safe.lastIndexOf(".")
  const base = (dot > 0 ? safe.slice(0, dot) : safe) || "resume"
  const ext = dot > 0 ? safe.slice(dot) : ""
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  const suffix = `${buf[0].toString(36)}${buf[1].toString(36)}`
  const idSeg = /^[A-Za-z0-9]{4}$/.test(resumeEntryId)
    ? resumeEntryId
    : resumeEntryId.replace(/[^\w-]/g, "_").slice(0, 4) || "row"
  return `${userId}/${idSeg}/${base}-${suffix}${ext}`
}

export async function uploadResumeFile(args: {
  file: File
  objectPath: string
}): Promise<{ publicUrl: string; storagePath: string }> {
  const bucket = getResumesBucketName()
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(args.objectPath, args.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: args.file.type || undefined,
    })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(args.objectPath)
  return { publicUrl: data.publicUrl, storagePath: args.objectPath }
}

export function storagePathFromResumePublicUrl(
  publicUrl: string,
  bucket = getResumesBucketName()
): string | null {
  const prefix = `/object/public/${bucket}/`
  const idx = publicUrl.indexOf(prefix)
  if (idx === -1) return null
  return decodeURIComponent(publicUrl.slice(idx + prefix.length))
}

export async function removeResumeObjectsFromStorage(
  publicUrls: string[]
): Promise<void> {
  if (!publicUrls.length) return
  const bucket = getResumesBucketName()
  const supabase = getSupabaseBrowserClient()
  const paths = publicUrls
    .map((u) => storagePathFromResumePublicUrl(u, bucket))
    .filter((p): p is string => Boolean(p))
  if (!paths.length) return
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) throw error
}
