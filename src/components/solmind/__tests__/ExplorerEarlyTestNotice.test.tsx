import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ usePathname: () => "/explorer/conversation" }));
import { ExplorerEarlyTestNoticeBoundary } from "../ExplorerEarlyTestNotice";

it("hides child screen markup until browser status is checked, without claiming RSC secrecy", () => {
  const markup = renderToStaticMarkup(<ExplorerEarlyTestNoticeBoundary><button>Private app control</button></ExplorerEarlyTestNoticeBoundary>);
  expect(markup).toContain("Checking access...");
  expect(markup).not.toContain("Private app control");
  expect(markup).not.toContain("<button");
});
