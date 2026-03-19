import { z } from 'zod'

const VerifyDownloadSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
  login: z.string().optional(),
})

function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      data: null,
    }
  }
  return { isValid: true, errors: [], data: result.data }
}

export { VerifyDownloadSchema, validate }
