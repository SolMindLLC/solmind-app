"use client";

import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";

import {
  CODE_LENGTH,
  INITIAL_SIGN_IN_PREVIEW_STATE,
  M1_SAMPLE_CODE,
  SIGN_IN_HEADING_ID,
  SIGN_IN_SCREENS,
  signInPreviewReducer,
} from "@/lib/solmind/signInPreview";
import { SignInPreviewView } from "@/components/solmind/SignInPreviewParts";

// The one client boundary of the /login sign-in preview. It keeps a single
// in-memory state object from signInPreview.ts plus the email and code field
// drafts, and moves focus to the new heading when the screen changes. A3 and
// A3A's password field is uncontrolled: nothing here reads, keeps or passes on
// what is typed in it, so it never reaches this state or the rendered markup,
// and it is gone once the screen changes. Nothing leaves the page.

export function SignInPreview() {
  const [state, dispatch] = useReducer(signInPreviewReducer, INITIAL_SIGN_IN_PREVIEW_STATE);
  const [emailDraft, setEmailDraft] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const shownScreen = useRef(state.screen);

  useEffect(() => {
    if (shownScreen.current === state.screen) {
      return;
    }
    shownScreen.current = state.screen;
    document.getElementById(SIGN_IN_HEADING_ID)?.focus();
  }, [state.screen]);

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCodeDraft("");
    dispatch({ type: "sendCode", email: emailDraft });
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCodeDraft("");
    dispatch({ type: "submitPassword", identifier: emailDraft });
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: "explain", notice: "verify" });
  };

  return (
    <SignInPreviewView
      codeDraft={codeDraft}
      emailDraft={emailDraft}
      onChooseDifferentRole={() => {
        setEmailDraft("");
        setCodeDraft("");
        dispatch({ type: "chooseDifferentRole" });
      }}
      onChooseRole={(role) => dispatch({ type: "chooseRole", role })}
      onCodeDraftChange={(value) => setCodeDraft(value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
      onDismissNotice={() => dispatch({ type: "dismissNotice" })}
      onEmailDraftChange={setEmailDraft}
      onExplain={(notice) => dispatch({ type: "explain", notice })}
      onPasswordShownChange={(shown) => dispatch({ type: "setPasswordShown", shown })}
      onPreviewCodeScreen={(screen) => {
        // The approved M1 mockup shows a sample code in the field.
        setCodeDraft(screen === SIGN_IN_SCREENS.codeWrong ? M1_SAMPLE_CODE : "");
        dispatch({ type: "previewCodeScreen", screen });
      }}
      onPreviewRememberedChange={(remembered) => dispatch({ type: "setPreviewRemembered", remembered })}
      onRememberTickedChange={(ticked) => dispatch({ type: "setRememberTicked", ticked })}
      onRequestNewCode={() => dispatch({ type: "requestNewCode" })}
      onSubmitCode={submitCode}
      onSubmitEmail={submitEmail}
      onSubmitPassword={submitPassword}
      onUseDifferentEmail={() => {
        setEmailDraft("");
        setCodeDraft("");
        dispatch({ type: "useDifferentEmail" });
      }}
      state={state}
    />
  );
}
