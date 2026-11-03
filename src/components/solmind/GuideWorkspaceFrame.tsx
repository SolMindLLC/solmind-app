"use client";

import type { ReactNode } from "react";

import { GUIDE_WORKSPACE_FRAMES, type GuideWorkspacePage } from "@/lib/solmind/guideWorkspaceFrame";

import { WorkspaceFrame } from "./WorkspaceFrame";

// The Guide workspace frame for one signed-in Guide page: the role-neutral
// WorkspaceFrame.tsx with the August Guide menu data. A server page passes
// only the page name, so nothing but plain values crosses into this client
// boundary. Presentation only: each page keeps its own reads, commands and
// authorization.
type GuideWorkspaceFrameProps = Readonly<{
  page: GuideWorkspacePage;
  skipTargetId?: string;
  linksDisabled?: boolean;
  children: ReactNode;
}>;

export function GuideWorkspaceFrame({ page, skipTargetId, linksDisabled, children }: GuideWorkspaceFrameProps) {
  return (
    <WorkspaceFrame frame={GUIDE_WORKSPACE_FRAMES[page]} linksDisabled={linksDisabled} skipTargetId={skipTargetId}>
      {children}
    </WorkspaceFrame>
  );
}
