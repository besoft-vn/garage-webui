import { useEffect } from "react";
import { Modal } from "react-daisyui";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Button from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import FormControl from "@/components/ui/form-control";
import { useDisclosure } from "@/hooks/useDisclosure";
import { LifecycleRule } from "../../types";
import { lifecycleRuleSchema, LifecycleRuleSchema } from "../schema";

const MB = 1024 ** 2;

type Props = {
  disclosure: ReturnType<typeof useDisclosure<number>>;
  rule?: LifecycleRule | null;
  isPending?: boolean;
  disabled?: boolean;
  onSubmit: (rule: LifecycleRule) => void;
};

const toFormValues = (rule?: LifecycleRule | null): LifecycleRuleSchema => ({
  id: rule?.id || "",
  enabled: rule?.enabled ?? true,
  prefix: rule?.prefix || "",
  minSize:
    rule?.objectSizeGreaterThan != null
      ? rule.objectSizeGreaterThan / MB
      : null,
  maxSize:
    rule?.objectSizeLessThan != null ? rule.objectSizeLessThan / MB : null,
  expirationType: rule?.expirationDate
    ? "date"
    : rule?.expirationDays != null || !rule
    ? "days"
    : "none",
  expirationDays: rule?.expirationDays ?? (rule ? null : 30),
  expirationDate: rule?.expirationDate || "",
  abortEnabled: rule?.abortIncompleteUploadsDays != null,
  abortDays: rule?.abortIncompleteUploadsDays ?? 7,
});

const LifecycleRuleDialog = ({
  disclosure,
  rule,
  isPending,
  disabled,
  onSubmit,
}: Props) => {
  const { dialogRef, isOpen, onOpen, onClose } = disclosure;
  const form = useForm<LifecycleRuleSchema>({
    resolver: zodResolver(lifecycleRuleSchema),
  });
  const expirationType = useWatch({
    control: form.control,
    name: "expirationType",
  });
  const abortEnabled = useWatch({ control: form.control, name: "abortEnabled" });

  useEffect(() => {
    if (isOpen) {
      form.reset(toFormValues(rule));
    }
  }, [isOpen, rule]);

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      id: values.id.trim(),
      enabled: values.enabled,
      prefix: values.prefix,
      objectSizeGreaterThan:
        values.minSize != null ? Math.round(values.minSize * MB) : null,
      objectSizeLessThan:
        values.maxSize != null ? Math.round(values.maxSize * MB) : null,
      expirationDays:
        values.expirationType === "days" ? values.expirationDays : null,
      expirationDate:
        values.expirationType === "date" ? values.expirationDate : null,
      abortIncompleteUploadsDays: values.abortEnabled ? values.abortDays : null,
    });
  });

  return (
    <>
      <Button
        icon={Plus}
        color="primary"
        disabled={disabled}
        onClick={() => onOpen(null)}
      >
        Add Rule
      </Button>

      <Modal ref={dialogRef} backdrop open={isOpen} className="max-w-2xl">
        <Modal.Header className="mb-1">
          {rule ? "Edit Lifecycle Rule" : "Add Lifecycle Rule"}
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <InputField
                form={form}
                name="id"
                title="Rule Name"
                placeholder="e.g. expire-logs"
              />
              <ToggleField form={form} name="enabled" label="Enabled" />
            </div>

            <p className="font-medium mt-4">Filter</p>
            <InputField
              form={form}
              name="prefix"
              title="Prefix"
              placeholder="Leave empty to apply to all objects"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                form={form}
                name="minSize"
                title="Min Object Size (MB)"
                type="number"
                step="any"
                placeholder="Optional"
              />
              <InputField
                form={form}
                name="maxSize"
                title="Max Object Size (MB)"
                type="number"
                step="any"
                placeholder="Optional"
              />
            </div>

            <p className="font-medium mt-4">Actions</p>
            <FormControl
              form={form}
              name="expirationType"
              title="Expire Objects"
              render={(field) => (
                <select
                  className="select select-bordered"
                  {...field}
                  value={String(field.value ?? "none")}
                >
                  <option value="none">Never</option>
                  <option value="days">After a number of days</option>
                  <option value="date">On a specific date</option>
                </select>
              )}
            />
            {expirationType === "days" && (
              <InputField
                form={form}
                name="expirationDays"
                title="Days After Object Creation"
                type="number"
                min={1}
              />
            )}
            {expirationType === "date" && (
              <InputField
                form={form}
                name="expirationDate"
                title="Expiration Date (UTC)"
                type="date"
              />
            )}

            <ToggleField
              form={form}
              name="abortEnabled"
              className="mt-2"
              label="Abort incomplete multipart uploads"
            />
            {abortEnabled && (
              <InputField
                form={form}
                name="abortDays"
                title="Days After Upload Initiation"
                type="number"
                min={1}
              />
            )}

            <button type="submit" className="hidden" />
          </form>
        </Modal.Body>

        <Modal.Actions>
          <Button onClick={onClose}>Cancel</Button>
          <Button color="primary" disabled={isPending} onClick={handleSubmit}>
            Save
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default LifecycleRuleDialog;
