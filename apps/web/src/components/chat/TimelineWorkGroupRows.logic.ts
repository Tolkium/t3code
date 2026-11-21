import { toServerClock } from "@t3tools/client-runtime/clock";
import type { EnvironmentId } from "@t3tools/contracts";
import { formatDuration } from "@t3tools/shared/orchestrationTimingCopy";
import { msg } from "gt-react";
import { m } from "~/i18n/messages";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";

export function formatWorkingTimerNow(startIso: string, environmentId: EnvironmentId): string {
  const startedAtMs = Date.parse(startIso);
  if (!Number.isFinite(startedAtMs)) {
    return m(msg("{seconds}s", { seconds: 0 }));
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((toServerClock(environmentId, Date.now()) - startedAtMs) / 1000),
  );
  if (elapsedSeconds < 60) {
    return m(msg("{seconds}s", { seconds: elapsedSeconds }));
  }

  return formatDuration(elapsedSeconds * 1_000, m);
}

/**
 * Picks the command row whose live output should appear inline under the active live work row:
 * the active command itself, or the most recent command while the model is thinking about its output.
 */
export function resolveLiveCommandPreviewEntry(
  row: Pick<
    Extract<MessagesTimelineRow, { kind: "work-live" }>,
    "entry" | "groupedEntries" | "expanded"
  >,
) {
  if (row.expanded) return undefined;
  if (row.entry.projectedItem?.item.type === "command_execution") {
    return row.entry;
  }
  if (row.entry.itemType === "reasoning") {
    const lastNonReasoning = row.groupedEntries.findLast((entry) => entry.itemType !== "reasoning");
    if (lastNonReasoning?.projectedItem?.item.type === "command_execution") {
      return lastNonReasoning;
    }
  }
  return undefined;
}

/**
 * Picks which command row inside an expanded work group should open automatically:
 * the latest running command, or otherwise the latest command in the group.
 */
export function resolveAutoExpandedCommandEntryId(
  entries: ReadonlyArray<Extract<MessagesTimelineRow, { kind: "work" }>["groupedEntries"][number]>,
): string | undefined {
  const running = entries.findLast(
    (entry) =>
      entry.projectedItem?.item.type === "command_execution" &&
      entry.toolLifecycleStatus === "inProgress",
  );
  if (running) return running.id;
  return entries.findLast((entry) => entry.projectedItem?.item.type === "command_execution")?.id;
}
