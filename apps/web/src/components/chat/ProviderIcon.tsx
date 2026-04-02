import type { ProviderKind } from "@t3tools/contracts";
import { memo } from "react";
import { PROVIDER_ICON_BY_PROVIDER } from "./ProviderModelPicker";

export const ProviderIcon = memo(function ProviderIcon(props: {
  provider: ProviderKind;
  className?: string;
}) {
  const IconComponent = PROVIDER_ICON_BY_PROVIDER[props.provider];
  if (!IconComponent) return null;
  return <IconComponent className={props.className} />;
});
