import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExplorerEarlyTestNoticeRecheckContext, useExplorerEarlyTestNoticeRecheck } from "../explorerEarlyTestNoticeRecheck";

afterEach(() => vi.unstubAllGlobals());

it("a feature refusal outside the on boundary has no notice event or request", () => {
  const dispatchEvent = vi.fn();
  const fetch = vi.fn();
  vi.stubGlobal("window", { dispatchEvent });
  vi.stubGlobal("fetch", fetch);
  let recheck = () => undefined as void;
  function Feature() { recheck = useExplorerEarlyTestNoticeRecheck(); return <p>Existing app</p>; }
  expect(renderToStaticMarkup(<Feature />)).toBe("<p>Existing app</p>");
  recheck();
  expect(dispatchEvent).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("only an on-boundary provider supplies the feature refusal recheck", () => {
  const notify = vi.fn();
  let recheck = () => undefined as void;
  function Feature() { recheck = useExplorerEarlyTestNoticeRecheck(); return null; }
  renderToStaticMarkup(<ExplorerEarlyTestNoticeRecheckContext value={notify}><Feature /></ExplorerEarlyTestNoticeRecheckContext>);
  recheck();
  expect(notify).toHaveBeenCalledOnce();
});
