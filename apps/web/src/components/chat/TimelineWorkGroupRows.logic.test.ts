import { TurnItemId, type OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { WorkLogEntry } from "../../session-logic";
import { makeStreamingTimelineFixture } from "../../test-fixtures";
import {
  resolveAutoExpandedCommandEntryId,
  resolveLiveCommandPreviewEntry,
} from "./TimelineWorkGroupRows.logic";

function makeCommandEntry(
  id: string,
  toolLifecycleStatus: WorkLogEntry["toolLifecycleStatus"] = "inProgress",
): WorkLogEntry {
  const fixture = makeStreamingTimelineFixture();
  const source = fixture.visibleTurnItems[0]!;
  const itemId = TurnItemId.make(id);
  const projectedItem: OrchestrationV2ProjectedTurnItem = {
    position: 0,
    sourceThreadId: fixture.threadId,
    sourceItemId: itemId,
    visibility: "local",
    item: {
      ...source.item,
      id: itemId,
      threadId: fixture.threadId,
      runId: fixture.runId,
      nodeId: null,
      providerThreadId: null,
      providerTurnId: null,
      nativeItemRef: null,
      parentItemId: null,
      type: "command_execution",
      status: toolLifecycleStatus === "inProgress" ? "running" : "completed",
      input: "pnpm test",
      output: "",
    },
  };
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    label: "pnpm test",
    tone: "tool",
    itemType: "command_execution",
    toolLifecycleStatus,
    command: "pnpm test",
    projectedItem,
  };
}

function makeReasoningEntry(id: string): WorkLogEntry {
  return {
    id,
    createdAt: "2026-01-01T00:00:01.000Z",
    label: "Thinking",
    detail: "Checking test failures",
    tone: "thinking",
    itemType: "reasoning",
    toolLifecycleStatus: "inProgress",
  };
}

function makeReadEntry(id: string): WorkLogEntry {
  return {
    id,
    createdAt: "2026-01-01T00:00:02.000Z",
    label: "Read file",
    tone: "tool",
    itemType: "dynamic_tool",
    toolLifecycleStatus: "completed",
  };
}

describe("resolveLiveCommandPreviewEntry", () => {
  it("returns the active command entry when collapsed", () => {
    const cmd = makeCommandEntry("cmd-1");
    expect(
      resolveLiveCommandPreviewEntry({
        entry: cmd,
        groupedEntries: [cmd],
        expanded: false,
      }),
    ).toBe(cmd);
  });

  it("keeps the latest command visible while the agent reasons right after it", () => {
    const cmd = makeCommandEntry("cmd-1");
    const thought = makeReasoningEntry("reason-1");
    expect(
      resolveLiveCommandPreviewEntry({
        entry: thought,
        groupedEntries: [cmd, thought],
        expanded: false,
      }),
    ).toBe(cmd);
  });

  it("returns undefined when another non-command tool ran more recently", () => {
    const cmd = makeCommandEntry("cmd-1");
    const read = makeReadEntry("read-1");
    const thought = makeReasoningEntry("reason-1");
    expect(
      resolveLiveCommandPreviewEntry({
        entry: thought,
        groupedEntries: [cmd, read, thought],
        expanded: false,
      }),
    ).toBeUndefined();
    expect(
      resolveLiveCommandPreviewEntry({
        entry: read,
        groupedEntries: [cmd, read],
        expanded: false,
      }),
    ).toBeUndefined();
  });

  it("returns undefined once the work group is manually expanded", () => {
    const cmd = makeCommandEntry("cmd-1");
    expect(
      resolveLiveCommandPreviewEntry({
        entry: cmd,
        groupedEntries: [cmd],
        expanded: true,
      }),
    ).toBeUndefined();
  });
});

describe("resolveAutoExpandedCommandEntryId", () => {
  it("prefers the latest running command over later completed commands", () => {
    const running = makeCommandEntry("cmd-running", "inProgress");
    const completed = makeCommandEntry("cmd-done", "completed");
    expect(resolveAutoExpandedCommandEntryId([running, completed])).toBe("cmd-running");
  });

  it("falls back to the latest completed command when none are running", () => {
    const first = makeCommandEntry("cmd-1", "completed");
    const second = makeCommandEntry("cmd-2", "completed");
    const read = makeReadEntry("read-1");
    expect(resolveAutoExpandedCommandEntryId([first, second, read])).toBe("cmd-2");
  });

  it("returns undefined when the group has no command entries", () => {
    expect(resolveAutoExpandedCommandEntryId([makeReadEntry("read-1")])).toBeUndefined();
  });
});
