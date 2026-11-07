import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
    PUBLIC_APP_URL: z.string().url().optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    SMTP_HOST: optionalValue,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optionalValue,
    SMTP_PASSWORD: optionalValue,
    SMTP_FROM: optionalValue,
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('./storage'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(52_428_800).default(10_485_760),
    S3_BUCKET: optionalValue,
    S3_REGION: optionalValue,
    S3_ENDPOINT: optionalValue,
    S3_ACCESS_KEY_ID: optionalValue,
    S3_SECRET_ACCESS_KEY: optionalValue,
  })
  .superRefine((environment, context) => {
    const smtpFields = [
      environment.SMTP_HOST,
      environment.SMTP_USER,
      environment.SMTP_PASSWORD,
      environment.SMTP_FROM,
    ];
    if (smtpFields.some(Boolean) && smtpFields.some((value) => !value)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together',
      });
    }

    if (environment.STORAGE_DRIVER === 's3' && !environment.S3_BUCKET) {
      context.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: 'S3_BUCKET is required when STORAGE_DRIVER is s3',
      });
    }

    if (
      Boolean(environment.S3_ACCESS_KEY_ID) !==
      Boolean(environment.S3_SECRET_ACCESS_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['S3_ACCESS_KEY_ID'],
        message: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together',
      });
    }

    if (environment.NODE_ENV === 'production') {
      if (environment.STORAGE_DRIVER !== 's3') {
        context.addIssue({
          code: 'custom',
          path: ['STORAGE_DRIVER'],
          message: 'Production deployments must use S3-compatible storage',
        });
      }
      if (!environment.PUBLIC_APP_URL) {
        context.addIssue({
          code: 'custom',
          path: ['PUBLIC_APP_URL'],
          message: 'PUBLIC_APP_URL is required in production',
        });
      } else if (new URL(environment.PUBLIC_APP_URL).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          path: ['PUBLIC_APP_URL'],
          message: 'PUBLIC_APP_URL must use HTTPS in production',
        });
      }
      if (new URL(environment.FRONTEND_ORIGIN).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_ORIGIN'],
          message: 'FRONTEND_ORIGIN must use HTTPS in production',
        });
      }
    }
  });

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidKeys = result.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean);
    throw new Error(
      `Invalid environment configuration: ${invalidKeys.join(', ') || 'unknown setting'}`,
    );
  }

  return result.data;
}
