import { msg, T, useGT, useMessages } from "gt-react-native";
import { useAtomValue } from "@effect/atom-react";
import type { LiveCommandOutputMode, ToolCallVisibility } from "@t3tools/contracts/settings";
import { AsyncResult } from "effect/reactivity";
import { View } from "react-native";

import { AppText as Text } from "../../../../components/ui/AppText";
import { ListChoiceRow } from "../../../../components/ui/ListChoiceRow";
import { mobilePreferencesAtom, saveMobilePreferences } from "../../../../state/preferences";
import { useAtomCommand } from "../../../../state/use-atom-command";
import { SettingsSection } from "../../components/SettingsSection";

const TOOL_CALL_VISIBILITY_OPTIONS: ReadonlyArray<{
  readonly value: ToolCallVisibility;
  readonly label: string;
}> = [
  { value: "showAll", label: msg("Show all") },
  { value: "hideSuccessful", label: msg("Hide successful") },
  { value: "hideAll", label: msg("Hide all") },
  { value: "zen", label: msg("Zen", { $context: "tool call visibility: only final answers" }) },
];

const LIVE_COMMAND_OUTPUT_OPTIONS: ReadonlyArray<{
  readonly value: LiveCommandOutputMode;
  readonly label: string;
}> = [
  { value: "off", label: msg("Off") },
  { value: "expanded", label: msg("When expanded") },
  { value: "inline", label: msg("Inline") },
];

export function ToolCallsAppearanceSection() {
  const gt = useGT();
  const m = useMessages();
  const savePreferences = useAtomCommand(saveMobilePreferences);
  const preferences = useAtomValue(mobilePreferencesAtom);
  const selected = AsyncResult.isSuccess(preferences)
    ? (preferences.value.toolCallVisibility ?? "showAll")
    : null;
  const selectedLiveOutput = AsyncResult.isSuccess(preferences)
    ? (preferences.value.liveCommandOutputMode ?? "off")
    : null;

  return (
    <View className="gap-5">
      <View className="gap-3">
        <SettingsSection title={gt("Tool calls in chat")}>
          {TOOL_CALL_VISIBILITY_OPTIONS.map((option, index) => (
            <ListChoiceRow
              key={option.value}
              label={m(option.label)}
              selected={selected === option.value}
              separated={index > 0}
              disabled={selected === null}
              onPress={() => {
                void savePreferences({ toolCallVisibility: option.value });
              }}
            />
          ))}
        </SettingsSection>
        <Text className="px-2 text-sm text-foreground-muted">
          <T>
            Hide the commands, edits, and searches agents run. Hide successful keeps failures. Zen
            shows only final answers. Approvals, questions, and errors always show.
          </T>
        </Text>
      </View>

      <View className="gap-3">
        <SettingsSection title={gt("Live terminal output")}>
          {LIVE_COMMAND_OUTPUT_OPTIONS.map((option, index) => (
            <ListChoiceRow
              key={option.value}
              label={m(option.label)}
              selected={selectedLiveOutput === option.value}
              separated={index > 0}
              disabled={selectedLiveOutput === null}
              onPress={() => {
                void savePreferences({ liveCommandOutputMode: option.value });
              }}
            />
          ))}
        </SettingsSection>
        <Text className="px-2 text-sm text-foreground-muted">
          <T>
            Automatically open streaming output from the active or latest command for providers that
            stream terminal output. When expanded only opens it inside expanded activity; Inline
            also shows it while collapsed.
          </T>
        </Text>
      </View>
    </View>
  );
}
