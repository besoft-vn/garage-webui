import { Alert, Badge, Card, Loading, Table, Toggle } from "react-daisyui";
import { CircleXIcon, Info, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import { handleError, readableBytes } from "@/lib/utils";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useBucketContext } from "../context";
import { useLifecycleRules, useUpdateLifecycleRules } from "../hooks";
import { LifecycleRule } from "../../types";
import LifecycleRuleDialog from "./rule-dialog";

const LifecycleTab = () => {
  const { bucketName } = useBucketContext();
  const { data, error, isLoading, refetch } = useLifecycleRules(bucketName);
  const dialog = useDisclosure<number>();
  const rules = data?.rules || [];

  const updateRules = useUpdateLifecycleRules(bucketName, {
    onSuccess: () => {
      toast.success("Lifecycle rules updated!");
      dialog.onClose();
      refetch();
    },
    onError: handleError,
  });

  const onSave = (rule: LifecycleRule) => {
    const idx = dialog.data;
    const newRules =
      idx != null
        ? rules.map((r, i) => (i === idx ? rule : r))
        : [...rules, rule];
    updateRules.mutate(newRules);
  };

  const onToggle = (idx: number) => {
    updateRules.mutate(
      rules.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const onRemove = (idx: number) => {
    if (window.confirm("Are you sure you want to remove this rule?")) {
      updateRules.mutate(rules.filter((_, i) => i !== idx));
    }
  };

  return (
    <Card className="card-body">
      <div className="flex flex-row items-center gap-2">
        <Card.Title className="flex-1 truncate">
          Lifecycle Rules
          <Button
            href="https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/"
            target="_blank"
            size="sm"
            shape="circle"
            color="ghost"
          >
            <Info size={16} />
          </Button>
        </Card.Title>
        <LifecycleRuleDialog
          disclosure={dialog}
          rule={dialog.data != null ? rules[dialog.data] : null}
          isPending={updateRules.isPending}
          onSubmit={onSave}
          disabled={!bucketName || error != null}
        />
      </div>

      <p className="text-sm text-base-content/70">
        Automatically delete objects or abort incomplete multipart uploads
        after a given time. Rules are evaluated daily by Garage.
      </p>

      {!bucketName && (
        <Alert status="warning" icon={<CircleXIcon />}>
          <span>
            This bucket has no global alias. Add one to manage lifecycle rules.
          </span>
        </Alert>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loading />
        </div>
      )}

      {error != null && (
        <Alert status="error" icon={<CircleXIcon />}>
          <span>{error.message}</span>
        </Alert>
      )}

      {data && (
        <div className="overflow-x-auto">
          <Table zebra size="sm">
            <Table.Head>
              <span>#</span>
              <span>Rule</span>
              <span>Filter</span>
              <span>Actions</span>
              <span>Enabled</span>
              <span />
            </Table.Head>

            <Table.Body>
              {!rules.length ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    No lifecycle rules configured
                  </td>
                </tr>
              ) : null}

              {rules.map((rule, idx) => (
                <Table.Row key={idx}>
                  <span>{idx + 1}</span>
                  <span>{rule.id || "-"}</span>
                  <span className="flex flex-col gap-1">
                    <span>
                      Prefix:{" "}
                      <code>{rule.prefix ? rule.prefix : "(all objects)"}</code>
                    </span>
                    {rule.objectSizeGreaterThan != null && (
                      <span>
                        Size &gt; {readableBytes(rule.objectSizeGreaterThan)}
                      </span>
                    )}
                    {rule.objectSizeLessThan != null && (
                      <span>
                        Size &lt; {readableBytes(rule.objectSizeLessThan)}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-1">
                    {rule.expirationDays != null && (
                      <Badge color="neutral">
                        Expire after {rule.expirationDays} day(s)
                      </Badge>
                    )}
                    {rule.expirationDate ? (
                      <Badge color="neutral">
                        Expire on {rule.expirationDate}
                      </Badge>
                    ) : null}
                    {rule.abortIncompleteUploadsDays != null && (
                      <Badge color="neutral">
                        Abort uploads after {rule.abortIncompleteUploadsDays}{" "}
                        day(s)
                      </Badge>
                    )}
                  </span>
                  <Toggle
                    checked={rule.enabled}
                    color={rule.enabled ? "primary" : undefined}
                    disabled={updateRules.isPending}
                    onChange={() => onToggle(idx)}
                  />
                  <span className="flex flex-row gap-1 justify-end">
                    <Button icon={Pencil} onClick={() => dialog.onOpen(idx)} />
                    <Button
                      icon={Trash}
                      disabled={updateRules.isPending}
                      onClick={() => onRemove(idx)}
                    />
                  </span>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Card>
  );
};

export default LifecycleTab;
