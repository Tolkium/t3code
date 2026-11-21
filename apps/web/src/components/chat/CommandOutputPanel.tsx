import type { CommandOutputView } from "@t3tools/client-runtime/state/command-output";
import type { EnvironmentId, ThreadId, TurnItemId } from "@t3tools/contracts";
import { TERMINAL_PALETTES, terminalOutputSpans } from "@t3tools/shared/terminalOutput";
import { T, Var } from "gt-react";
import { useLayoutEffect, useRef } from "react";

import { useTheme } from "../../hooks/useTheme";
import { useServerConfigs } from "../../state/entities";
import { orchestrationEnvironment } from "../../state/orchestration";
import { useEnvironmentQuery } from "../../state/query";
import { ShellCommandBlock } from "./ShellCommandBlock";
import { useInitialOutputReady, type TurnItemSource } from "./timelineRowContext";

const FOLLOW_SLACK_PX = 8;

export function useCommandOutputStreaming(environmentId: EnvironmentId): boolean {
  return (
    useServerConfigs().get(environmentId)?.environment.capabilities.commandOutputStreaming === true
  );
}

function CommandOutputScroller(props: {
  readonly text: string;
  readonly truncated: boolean;
  readonly className: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const { resolvedTheme } = useTheme();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- pins the output scroller's scrollTop to the bottom after each commit while the user follows
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && followRef.current) element.scrollTop = element.scrollHeight;
  });

  // Parse after all hooks to preserve the text/theme compiler cache.
  const spans = terminalOutputSpans(props.text, TERMINAL_PALETTES[resolvedTheme]);
  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        followRef.current =
          element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX;
      }}
      className={props.className}
    >
      {props.truncated ? (
        <div className="italic">
          <T>Earlier output not shown</T>
        </div>
      ) : null}
      {spans.map((span, index) =>
        span.style === null ? (
          span.text
        ) : (
          // Spans never reorder and are rebuilt on each update.
          // oxlint-disable-next-line react/no-array-index-key
          <span key={index} style={span.style}>
            {span.text}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * Output of one expanded command row: streams while the command runs, then
 * shows its final output. Mount it only when `useCommandOutputStreaming` holds
 * or a `source` serves the output.
 * It subscribes only while mounted, so collapsed rows and other threads receive nothing.
 */
export function CommandOutputPanel(props: {
  readonly onInitialOutputReady?: (() => void) | undefined;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
  readonly source?: TurnItemSource["commandOutput"] | undefined;
}) {
  const input = { threadId: props.threadId, itemId: props.itemId };
  const { data, error } = useEnvironmentQuery<CommandOutputView, unknown>(
    props.source
      ? props.source(input)
      : orchestrationEnvironment.v2.commandOutput({ environmentId: props.environmentId, input }),
  );
  useInitialOutputReady(data === null && !error, props.onInitialOutputReady);
  const text = data?.output.text ?? "";

  if (text.length === 0) {
    if (error) {
      return (
        <div className="text-destructive">
          <T>
            Couldn&apos;t load output: <Var>{error}</Var>
          </T>
        </div>
      );
    }
    if (data === null) {
      return (
        <div className="text-muted-foreground italic">
          <T>Loading output…</T>
        </div>
      );
    }
    return data.running ? null : (
      <div className="text-muted-foreground italic">
        <T>No output.</T>
      </div>
    );
  }
  return (
    <CommandOutputScroller
      text={text}
      truncated={data?.output.truncated ?? false}
      className="max-h-80 overflow-auto text-muted-foreground"
    />
  );
}

/**
 * Compact inline preview of the active or latest command's live output under the live activity row.
 * Renders nothing while empty or loading so silent commands and non-streaming providers add no box.
 */
export function LiveCommandOutputPreview(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
  readonly command?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly source?: TurnItemSource["commandOutput"] | undefined;
}) {
  const input = { threadId: props.threadId, itemId: props.itemId };
  const { data } = useEnvironmentQuery<CommandOutputView, unknown>(
    props.source
      ? props.source(input)
      : orchestrationEnvironment.v2.commandOutput({ environmentId: props.environmentId, input }),
  );
  const text = data?.output.text ?? "";
  if (text.length === 0) return null;

  const trimmedCommand = props.command?.trim();

  return (
    <div
      data-live-command-output-preview=""
      className="ms-7 mt-1 overflow-hidden rounded-md border border-border/60 bg-muted/20 font-mono text-(length:--font-size-code,var(--text-2xs)) leading-relaxed select-text"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {trimmedCommand ? (
        <div className="max-h-14 overflow-hidden border-b border-border/50 px-2.5 py-1">
          <ShellCommandBlock command={trimmedCommand} />
        </div>
      ) : null}
      <CommandOutputScroller
        text={text}
        truncated={data?.output.truncated ?? false}
        className="max-h-52 overflow-auto whitespace-pre-wrap break-words px-2.5 py-1.5 text-muted-foreground"
      />
      {props.exitCode !== undefined && props.exitCode !== 0 ? (
        <div className="border-t border-border/50 px-2.5 py-1 text-destructive">
          <T>
            exit <Var>{props.exitCode}</Var>
          </T>
        </div>
      ) : null}
    </div>
  );
}
