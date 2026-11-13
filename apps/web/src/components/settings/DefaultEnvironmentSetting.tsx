import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const PRIMARY_VALUE = "primary";

export function DefaultEnvironmentSetting() {
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
  const primaryLabel = primaryEnvironment ? `${primaryEnvironment.label} (this app)` : "Automatic";
  const chosenEnvironment = choices.find((environment) => environment.environmentId === chosen);
  const selectedLabel =
    chosen === null ? primaryLabel : (chosenEnvironment?.label ?? "Removed environment");
  const fallsBack = chosen !== null && chosenEnvironment?.connection.phase !== "connected";

  return (
    <SettingsRow
      {...searchableSetting("default-environment")}
      description={
        fallsBack
          ? `${selectedLabel} isn't connected, so ${primaryLabel} is used until it is.`
          : "Where new threads without a project start, and which environment Settings opens on. Saved on this device."
      }
      resetAction={
        chosen !== null ? (
          <SettingResetButton
            label="default environment"
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
          <SelectTrigger size="sm" className="w-full sm:w-48" aria-label="Default environment">
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
