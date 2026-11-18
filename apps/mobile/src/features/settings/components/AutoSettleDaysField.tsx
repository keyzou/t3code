import { useGT } from "gt-react-native";
import {
  MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS,
  MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS,
} from "@t3tools/contracts";
import type { ComponentProps } from "react";
import { NumberField } from "../../../components/ui/NumberField";

export type AutoSettleDaysFieldProps = Pick<
  ComponentProps<typeof NumberField>,
  "value" | "onValueChange" | "disabled"
> &
  Partial<Pick<ComponentProps<typeof NumberField>, "min" | "max" | "label">>;

export function AutoSettleDaysField(props: AutoSettleDaysFieldProps) {
  const gt = useGT();
  return (
    <NumberField
      min={MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      max={MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      label={gt("Days before auto-settle")}
      {...props}
      formatValue={(value) =>
        gt("{count, plural, one {{count} day} other {{count} days}}", { count: value })
      }
    />
  );
}
