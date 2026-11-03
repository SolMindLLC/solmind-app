"use client";

import { useState, type FormEvent } from "react";

import { ADMIN_SETTING_INTEGER_MAX, type AdminSettingView } from "@/lib/solmind/adminWorkspaceContract";
import { postAdminChangeSetting, postAdminLiftPause, type AdminCommandFetch } from "@/lib/solmind/adminWorkspaceBrowserRequest";
import {
  ADMIN_LIFT_OUTCOME_SENTENCES,
  ADMIN_SETTING_OUTCOME_SENTENCES,
  ADMIN_WORKSPACE_WORDING,
} from "@/lib/solmind/adminWorkspaceWording";

import { FOCUS_RING, SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// The two Admin write controls (minimal Admin screens, decision queue
// 2026-11-03 11:56:14). Each press creates one operation id, posts once with
// fetch, shows the value-free outcome in plain words and then reloads the page
// after a short pause, so the page shows the current values from the server (no
// optimistic update, no retry, no browser storage). A control is used once per
// page load, because a setting change carries the version this page read.

export const ADMIN_COMMAND_RELOAD_DELAY_MS = 2_500;

const browser = {
  fetch: ((path, init) => globalThis.fetch(path, init)) as AdminCommandFetch,
  operationId: () => globalThis.crypto.randomUUID(),
  reloadSoon: () => { setTimeout(() => window.location.reload(), ADMIN_COMMAND_RELOAD_DELAY_MS); },
};

const STATUS_CLASS = "min-h-5 text-sm leading-5 text-amber-50";
const BUTTON = joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-60");

type Phase = "idle" | "pending" | "done";

export function AdminLiftPauseButton({ stopId, disabled }: Readonly<{ stopId: string; disabled: boolean }>) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const press = async () => {
    if (phase !== "idle") return;
    setPhase("pending");
    let sentence: string;
    try {
      sentence = ADMIN_LIFT_OUTCOME_SENTENCES[await postAdminLiftPause({ stopId, operationId: browser.operationId() }, browser.fetch)];
    } catch {
      sentence = ADMIN_LIFT_OUTCOME_SENTENCES.failed;
    }
    setMessage(`${sentence} ${ADMIN_WORKSPACE_WORDING.reloading}`);
    setPhase("done");
    browser.reloadSoon();
  };
  return (
    <div className="grid justify-items-start gap-1">
      <button className={BUTTON} disabled={disabled || phase !== "idle"} onClick={() => { void press(); }} type="button">
        {phase === "pending" ? ADMIN_WORKSPACE_WORDING.aiUse.lifting : ADMIN_WORKSPACE_WORDING.aiUse.lift}
      </button>
      <p aria-live="polite" className={STATUS_CLASS} role="status">{message}</p>
    </div>
  );
}

export function AdminSettingChangeForm({ setting, disabled }: Readonly<{ setting: AdminSettingView; disabled: boolean }>) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const inputId = `admin-setting-${setting.key}`;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase !== "idle") return;
    const raw = new FormData(event.currentTarget).get("value");
    const text = typeof raw === "string" ? raw.trim() : "";
    const value = /^-?\d{1,10}$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isSafeInteger(value)) {
      setMessage(ADMIN_WORKSPACE_WORDING.settings.wholeNumber);
      return;
    }
    // Beyond the database integer range no setting can hold the value: say so
    // here instead of posting a body the server would refuse as malformed.
    if (Math.abs(value) > ADMIN_SETTING_INTEGER_MAX) {
      setMessage(ADMIN_SETTING_OUTCOME_SENTENCES.out_of_range);
      return;
    }
    setPhase("pending");
    let sentence: string;
    try {
      sentence = ADMIN_SETTING_OUTCOME_SENTENCES[await postAdminChangeSetting({
        settingKey: setting.key, value, expectedVersion: setting.version, operationId: browser.operationId(),
      }, browser.fetch)];
    } catch {
      sentence = ADMIN_SETTING_OUTCOME_SENTENCES.failed;
    }
    setMessage(`${sentence} ${ADMIN_WORKSPACE_WORDING.reloading}`);
    setPhase("done");
    browser.reloadSoon();
  };
  const locked = disabled || phase !== "idle";
  return (
    <form className="grid gap-1.5" noValidate onSubmit={(event) => { void submit(event); }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm text-stone-300" htmlFor={inputId}>
          {ADMIN_WORKSPACE_WORDING.settings.newValue}
          <input
            className={joinClasses("w-36 rounded-xl border border-amber-200/25 bg-black/40 px-3 py-2 text-stone-50 disabled:opacity-60", FOCUS_RING)}
            defaultValue={setting.value}
            disabled={locked}
            id={inputId}
            inputMode="numeric"
            name="value"
            type="text"
          />
        </label>
        <button className={BUTTON} disabled={locked} type="submit">
          {phase === "pending" ? ADMIN_WORKSPACE_WORDING.settings.saving : ADMIN_WORKSPACE_WORDING.settings.save}
        </button>
      </div>
      <p aria-live="polite" className={STATUS_CLASS} role="status">{message}</p>
    </form>
  );
}
