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
  return (
    <NumberField
      min={MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      max={MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      label="Days before auto-settle"
      {...props}
      formatValue={(value) => `${value} ${value === 1 ? "day" : "days"}`}
    />
  );
}
