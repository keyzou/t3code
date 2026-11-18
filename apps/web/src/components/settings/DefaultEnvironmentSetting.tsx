import { useGT } from "gt-react";

import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

const PRIMARY_VALUE = "primary";

export function DefaultEnvironmentSetting() {
  const gt = useGT();
  const setting = useSearchableSetting();
  const chosen = useClientSettings((settings) => settings.defaultEnvironmentId);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const choices = environments.filter(
    (environment) => environment.environmentId !== primaryEnvironmentId,
  );
  if (choices.length === 0 && chosen === null) return null;

  const primaryEnvironment = environments.find(
    (environment) => environment.environmentId === primaryEnvironmentId,
  );
  const primaryLabel = primaryEnvironment
    ? gt("{environment} (this app)", { environment: primaryEnvironment.label })
    : gt("Automatic");
  const chosenEnvironment = choices.find((environment) => environment.environmentId === chosen);
  const selectedLabel =
    chosen === null ? primaryLabel : (chosenEnvironment?.label ?? gt("Removed environment"));
  const fallsBack = chosen !== null && chosenEnvironment?.connection.phase !== "connected";

  return (
    <SettingsRow
      {...setting("default-environment")}
      description={
        fallsBack
          ? gt("{selected} isn't connected, so {fallback} is used until it is.", {
              selected: selectedLabel,
              fallback: primaryLabel,
            })
          : gt(
              "Where new threads without a project start, and which environment Settings opens on. Saved on this device.",
            )
      }
      resetAction={
        chosen !== null ? (
          <SettingResetButton
            ariaLabel={gt("Reset default environment to default")}
            onClick={() => void updateClientSettings({ defaultEnvironmentId: null })}
          />
        ) : null
      }
      control={
        <Select
          value={chosen ?? PRIMARY_VALUE}
          onValueChange={(value) => {
            const next = choices.find((environment) => environment.environmentId === value);
            void updateClientSettings({ defaultEnvironmentId: next?.environmentId ?? null });
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-48"
            aria-label={gt("Default environment")}
          >
            <SelectValue>{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            <SelectItem hideIndicator value={PRIMARY_VALUE}>
              {primaryLabel}
            </SelectItem>
            {choices.map((environment) => (
              <SelectItem
                hideIndicator
                key={environment.environmentId}
                value={environment.environmentId}
              >
                {environment.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
