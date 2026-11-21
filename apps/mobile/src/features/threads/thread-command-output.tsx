import { T, useGT } from "gt-react-native";
import type { EnvironmentId, ThreadId, TurnItemId } from "@t3tools/contracts";
import { TERMINAL_PALETTES, terminalOutputSpans } from "@t3tools/shared/terminalOutput";
import type React from "react";
import { useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { useServerConfigs } from "../../state/entities";
import { orchestrationEnvironment } from "../../state/orchestration";
import { useEnvironmentQuery } from "../../state/query";

const FOLLOW_SLACK = 8;

export function useCommandOutputStreaming(environmentId: EnvironmentId): boolean {
  return (
    useServerConfigs().get(environmentId)?.environment.capabilities.commandOutputStreaming === true
  );
}

/** Mount only while useCommandOutputStreaming holds; unmount to stop subscriptions for collapsed rows or other threads. */
export function ThreadCommandOutput(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
  readonly themeAppearance: "light" | "dark";
}) {
  const gt = useGT();
  const { data, error } = useEnvironmentQuery(
    orchestrationEnvironment.v2.commandOutput({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, itemId: props.itemId },
    }),
  );
  const text = data?.output.text ?? "";
  if (text.length === 0) {
    const message = error
      ? gt("Couldn't load output: {error}", { error })
      : data === null
        ? gt("Loading output…")
        : data.running
          ? null
          : gt("No output.");
    return message === null ? null : (
      <Text className="pt-1.5 font-mono text-2xs leading-normal text-foreground-muted">
        {message}
      </Text>
    );
  }
  return (
    <CommandOutputScrollView
      text={text}
      truncated={data?.output.truncated ?? false}
      themeAppearance={props.themeAppearance}
      className="pt-1.5"
      scrollClassName="max-h-60"
    />
  );
}

function CommandOutputScrollView(props: {
  readonly text: string;
  readonly truncated: boolean;
  readonly themeAppearance: "light" | "dark";
  readonly className?: string;
  readonly scrollClassName: string;
}) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const followRef = useRef(true);
  const spans = useMemo(
    () => terminalOutputSpans(props.text, TERMINAL_PALETTES[props.themeAppearance]),
    [props.text, props.themeAppearance],
  );
  return (
    <View className={props.className}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        directionalLockEnabled
        showsVerticalScrollIndicator
        className={props.scrollClassName}
        contentContainerStyle={{ paddingRight: 8 }}
        scrollEventThrottle={100}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          followRef.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height <= FOLLOW_SLACK;
        }}
        onContentSizeChange={() => {
          if (followRef.current) scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {props.truncated ? (
          <Text className="pb-0.5 text-3xs text-foreground-subtle">
            <T>Earlier output not shown</T>
          </Text>
        ) : null}
        <Text selectable className="font-mono text-2xs leading-normal text-foreground-muted">
          {spans.map((span, index) =>
            span.style === null ? (
              span.text
            ) : (
              // Spans are rebuilt from scratch on every update and never reorder.
              // oxlint-disable-next-line react/no-array-index-key
              <Text key={index} style={span.style}>
                {span.text}
              </Text>
            ),
          )}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Compact inline preview of the active or latest command's live output under the live activity row.
 * Renders nothing while empty or loading so silent commands and non-streaming providers add no box.
 */
export function ThreadLiveCommandOutputPreview(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
  readonly command?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly themeAppearance: "light" | "dark";
}) {
  const gt = useGT();
  const { data } = useEnvironmentQuery(
    orchestrationEnvironment.v2.commandOutput({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, itemId: props.itemId },
    }),
  );
  const text = data?.output.text ?? "";
  if (text.length === 0) return null;

  const trimmedCommand = props.command?.trim();

  return (
    <View className="ml-7 mt-1 overflow-hidden rounded-md border border-border bg-subtle/40">
      {trimmedCommand ? (
        <View className="border-b border-border/60 px-2.5 py-1">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="font-mono text-2xs leading-normal text-foreground"
          >
            $ {trimmedCommand.replace(/\s+/g, " ")}
          </Text>
        </View>
      ) : null}
      <CommandOutputScrollView
        text={text}
        truncated={data?.output.truncated ?? false}
        themeAppearance={props.themeAppearance}
        className="px-2.5 py-1.5"
        scrollClassName="max-h-48"
      />
      {props.exitCode !== undefined && props.exitCode !== 0 ? (
        <View className="border-t border-border/60 px-2.5 py-1">
          <Text className="font-mono text-2xs text-adaptive-rose-600-400">
            {gt("exit {exitCode}", { exitCode: props.exitCode })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
