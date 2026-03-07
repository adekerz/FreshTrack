import { z } from 'zod'

export const TimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
})

export const SummaryQuerySchema = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
})

export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    }
  }
  return { isValid: true, data: result.data }
}
