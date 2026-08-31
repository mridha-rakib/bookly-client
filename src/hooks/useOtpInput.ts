"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Shared OTP-input behaviour for the split-box verification screens
 * (`/customer/verify`, `/professional/verify`). It owns only the input UX —
 * per-box state, focus movement, paste / autofill distribution — and leaves the
 * markup, styling and submit/API logic entirely to the page.
 *
 * Supported behaviour:
 *  - single-digit typing with auto-advance
 *  - Backspace clears the current box, then steps back
 *  - pasting a code (into any box) strips non-digits, keeps the first `length`,
 *    and spreads them across every box from the first
 *  - multi-character `change` values (mobile SMS autofill) are treated the same
 *    way as a paste
 */
export type UseOtpInputResult = {
  /** Per-box values, always `length` entries. */
  values: string[];
  /** All boxes joined — `value.length === length` means "complete". */
  value: string;
  /** Index of the box that should render its active/focus styling. */
  activeBox: number;
  setActiveBox: (index: number) => void;
  /** `ref` callback for box `index`. */
  registerRef: (index: number) => (el: HTMLInputElement | null) => void;
  handleChange: (value: string, index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  /** Clear every box and return focus to the first. */
  reset: () => void;
};

export function useOtpInput(length = 4): UseOtpInputResult {
  const [values, setValues] = useState<string[]>(() => Array.from({ length }, () => ""));
  const [activeBox, setActiveBox] = useState<number>(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const registerRef = (index: number) => (el: HTMLInputElement | null) => {
    inputsRef.current[index] = el;
  };

  /**
   * Spread a raw string (pasted code, mobile SMS autofill, or a multi-char change
   * event) across the boxes: strip non-digits, keep the first `length`, fill from
   * `startIndex`, then move focus to the first still-empty box (or the last one).
   * Returns false when there was nothing to distribute so callers can fall back
   * to single-character handling.
   */
  const distributeDigits = (raw: string, startIndex = 0): boolean => {
    const digits = raw.replace(/\D/g, "").slice(0, length - startIndex);
    if (!digits) return false;

    const newValues = [...values];
    for (let i = 0; i < digits.length; i += 1) {
      newValues[startIndex + i] = digits[i];
    }
    setValues(newValues);

    const nextEmpty = newValues.findIndex((d) => d === "");
    const focusIndex = nextEmpty === -1 ? length - 1 : nextEmpty;
    inputsRef.current[focusIndex]?.focus();
    setActiveBox(focusIndex);
    return true;
  };

  const handleChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;

    // Multi-character value (paste landing as input, or mobile autofill) — treat
    // it as the whole code and spread it from the first box.
    if (value.length > 1) {
      distributeDigits(value, 0);
      return;
    }

    const newValues = [...values];
    newValues[index] = value.substring(value.length - 1);
    setValues(newValues);

    if (value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
      setActiveBox(index + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!values[index] && index > 0) {
        const newValues = [...values];
        newValues[index - 1] = "";
        setValues(newValues);
        inputsRef.current[index - 1]?.focus();
        setActiveBox(index - 1);
      } else {
        const newValues = [...values];
        newValues[index] = "";
        setValues(newValues);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // A pasted code always fills from the first box, whichever box received it.
    const pasted = e.clipboardData.getData("text");
    if (distributeDigits(pasted, 0)) {
      e.preventDefault();
    }
  };

  const reset = () => {
    setValues(Array.from({ length }, () => ""));
    setActiveBox(0);
    inputsRef.current[0]?.focus();
  };

  return {
    values,
    value: values.join(""),
    activeBox,
    setActiveBox,
    registerRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    reset,
  };
}
