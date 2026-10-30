import { z } from "zod";

export const addAliasSchema = z.object({
  alias: z.string().min(1, "Alias is required"),
});

export type AddAliasSchema = z.infer<typeof addAliasSchema>;

export const websiteConfigSchema = z.object({
  websiteAccess: z.boolean(),
  websiteConfig: z
    .object({ indexDocument: z.string(), errorDocument: z.string() })
    .nullish(),
});

export type WebsiteConfigSchema = z.infer<typeof websiteConfigSchema>;

export const quotaSchema = z.object({
  enabled: z.boolean(),
  maxObjects: z.coerce.number().nullish(),
  maxSize: z.coerce.number().nullish(),
});

export type QuotaSchema = z.infer<typeof quotaSchema>;

export const allowKeysSchema = z.object({
  keys: z
    .object({
      checked: z.boolean(),
      keyId: z.string(),
      name: z.string(),
      read: z.boolean(),
      write: z.boolean(),
      owner: z.boolean(),
    })
    .array(),
});

export type AllowKeysSchema = z.infer<typeof allowKeysSchema>;

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().nullable()
);

export const lifecycleRuleSchema = z
  .object({
    id: z.string(),
    enabled: z.boolean(),
    prefix: z.string(),
    minSize: optionalNumber,
    maxSize: optionalNumber,
    expirationType: z.enum(["none", "days", "date"]),
    expirationDays: optionalNumber,
    expirationDate: z.string().nullish(),
    abortEnabled: z.boolean(),
    abortDays: optionalNumber,
  })
  .superRefine((v, ctx) => {
    if (v.expirationType === "days" && !(Number(v.expirationDays) >= 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["expirationDays"],
        message: "Must be at least 1 day",
      });
    }
    if (v.expirationType === "date" && !v.expirationDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expirationDate"],
        message: "Date is required",
      });
    }
    if (v.abortEnabled && !(Number(v.abortDays) >= 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["abortDays"],
        message: "Must be at least 1 day",
      });
    }
    if (v.expirationType === "none" && !v.abortEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["expirationType"],
        message: "At least one action is required",
      });
    }
    if (v.minSize != null && v.minSize < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["minSize"],
        message: "Must not be negative",
      });
    }
    if (v.maxSize != null && v.maxSize <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["maxSize"],
        message: "Must be greater than 0",
      });
    }
  });

export type LifecycleRuleSchema = z.infer<typeof lifecycleRuleSchema>;
