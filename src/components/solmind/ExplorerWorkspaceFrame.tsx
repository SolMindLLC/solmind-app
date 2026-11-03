"use client";

import type { ReactNode } from "react";

import { EXPLORER_WORKSPACE_FRAMES, type ExplorerWorkspacePage } from "@/lib/solmind/explorerWorkspaceFrame";

import { WorkspaceFrame } from "./WorkspaceFrame";

// The Explorer workspace frame for one signed-in Explorer page: the
// role-neutral WorkspaceFrame.tsx with the Explorer menu data, the page's
// section current. A server page passes only the page name, so nothing but
// plain values crosses into this client boundary. Presentation only: each
// page keeps its own reads, commands and authorization.
type ExplorerWorkspaceFrameProps = Readonly<{
  page: ExplorerWorkspacePage;
  skipTargetId?: string;
  linksDisabled?: boolean;
  children: ReactNode;
}>;

export function ExplorerWorkspaceFrame({ page, skipTargetId, linksDisabled, children }: ExplorerWorkspaceFrameProps) {
  return (
    <WorkspaceFrame frame={EXPLORER_WORKSPACE_FRAMES[page]} linksDisabled={linksDisabled} skipTargetId={skipTargetId}>
      {children}
    </WorkspaceFrame>
  );
}
