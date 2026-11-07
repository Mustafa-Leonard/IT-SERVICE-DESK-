import { z } from 'zod'

const apiHealthSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ok'),
  checkedAt: z.string().datetime(),
})

export type ApiHealth = z.infer<typeof apiHealthSchema>

export async function fetchApiHealth(): Promise<ApiHealth> {
  const response = await fetch('/api/v1/health', {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`The API health check failed (HTTP ${response.status}).`)
  }

  return apiHealthSchema.parse(await response.json())
}
