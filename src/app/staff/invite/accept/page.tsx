"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";
import { InputField, PhoneInputField } from "@/components/auth/InputField";
import SocialButton from "@/components/auth/SocialButton";
import { Spinner } from "@/components/ui/spinner";
import {
  useAcceptStaffInvitationPasswordMutation,
  useStaffInvitationGoogleMutation,
  useStaffInvitationQuery,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { getAuthenticatedHomePath } from "@/lib/auth/routes";

const roleLabel = (role: "SUPERVISOR" | "STAFF") =>
  role === "SUPERVISOR" ? "Supervisor" : "Staff member";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture the token ONCE (lazy initial state), then scrub it from the address bar so it
  // doesn't linger in history / referrers. The query hook keeps working off the captured value.
  const [token] = useState(() => searchParams.get("token") ?? "");

  useEffect(() => {
    if (token && typeof window !== "undefined" && window.location.search.includes("token=")) {
      window.history.replaceState(null, "", "/staff/invite/accept");
    }
  }, [token]);

  const invitationQuery = useStaffInvitationQuery(token);
  const acceptPassword = useAcceptStaffInvitationPasswordMutation();
  const googleAccept = useStaffInvitationGoogleMutation();

  const [mode, setMode] = useState<"choose" | "password">("choose");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+357");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formError, setFormError] = useState("");

  const invitation = invitationQuery.data;

  // Prefill names from whatever the owner typed on the "Add staff" form. This only runs once the
  // async invitation query resolves, so it is not the derived-state anti-pattern the rule targets
  // (same disable pattern as the professional business-form prefill).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!invitation) return;
    setFirstName((current) => current || invitation.firstName || "");
    setLastName((current) => current || invitation.lastName || "");
  }, [invitation]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const invalidReason = useMemo(() => {
    if (!invitationQuery.isError) return null;
    const status = (invitationQuery.error as { response?: { status?: number } })?.response?.status;
    if (status === 410) return "expired";
    if (status === 409) return "used";
    return "invalid";
  }, [invitationQuery.isError, invitationQuery.error]);

  if (!token) {
    return (
      <DeadEnd
        title="Missing invitation link"
        message="This page needs a valid invitation link. Please open the link from your invitation email."
      />
    );
  }

  if (invitationQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  if (invalidReason || !invitation) {
    const copy =
      invalidReason === "expired"
        ? "This invitation has expired. Ask the business to send you a new one."
        : invalidReason === "used"
          ? "This invitation has already been used or was cancelled."
          : "This invitation link is invalid. Please check the link in your email.";
    return <DeadEnd title="This invitation can't be opened" message={copy} />;
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Please enter your first and last name.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("The passwords don't match.");
      return;
    }
    if (!agreeTerms) {
      setFormError("Please accept the Terms to continue.");
      return;
    }

    try {
      const result = await acceptPassword.mutateAsync({
        token,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        agreeTerms: true,
        ...(phone.trim() ? { countryCode, nationalNumber: phone.trim() } : {}),
      });
      router.replace(getAuthenticatedHomePath(result.user.role));
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  return (
    <AuthLayout showBack={false} imageSrc="/img/authImg2.png">
      <AuthCard
        title={`Join ${invitation.businessName} on Bookly`}
        subtitle={`You've been invited as a ${roleLabel(invitation.role)}. Set up your account to continue.`}
      >
        <div className="w-full max-w-[520px]">
          {/* Read-only summary */}
          <InputField
            label="Email"
            type="email"
            value={invitation.email}
            disabled
            icon={<HugeiconsIcon icon={Mail01Icon} size={20} />}
          />

          {mode === "choose" ? (
            <div className="flex flex-col gap-3 mt-6">
              <button
                type="button"
                onClick={() => setMode("password")}
                className="w-full h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
              >
                Set a password
              </button>
              <div className="flex items-center my-2">
                <div className="flex-1 border-t border-[#E8E6FF]" />
                <span className="px-3 text-xs font-semibold text-[#9E9E9E] tracking-wider">OR</span>
                <div className="flex-1 border-t border-[#E8E6FF]" />
              </div>
              <SocialButton
                provider="google"
                label={googleAccept.isPending ? "Redirecting to Google…" : "Continue With Google"}
                onClick={() => googleAccept.mutate(token)}
                disabled={googleAccept.isPending}
                aria-busy={googleAccept.isPending}
              />
              <p className="text-xs text-[#9E9E9E] mt-1 text-center">
                Use the Google account for <strong>{invitation.email}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5 mt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <InputField
                  label="First name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <InputField
                  label="Last name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              <PhoneInputField
                label="Mobile number (optional)"
                countryCode={countryCode}
                onCountryCodeChange={setCountryCode}
                placeholder="99123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <InputField
                label="Password"
                placeholder="Password"
                isPassword
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
                required
              />
              <InputField
                label="Confirm password"
                placeholder="Confirm password"
                isPassword
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={formError}
                icon={<HugeiconsIcon icon={SquareLock01Icon} size={20} />}
                required
              />

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-[#DAD6FF] text-[#240183] focus:ring-[#240183] cursor-pointer mt-0.5"
                  required
                />
                <label
                  htmlFor="agree-terms"
                  className="text-xs font-semibold text-[#1A1A1A] cursor-pointer select-none leading-relaxed"
                >
                  I agree to the Bookly{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-[#240183] underline hover:text-black transition-colors"
                  >
                    Terms &amp; Conditions
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={!agreeTerms || acceptPassword.isPending}
                className="w-full h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acceptPassword.isPending ? <Spinner className="text-white" /> : "Create account"}
              </button>

              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-sm font-semibold text-[#240183] hover:underline cursor-pointer"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

function DeadEnd({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  return (
    <AuthLayout showBack={false} imageSrc="/img/authImg2.png">
      <AuthCard title={title} subtitle={message}>
        <button
          type="button"
          onClick={() => router.replace("/professional/auth")}
          className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
        >
          Go to sign in
        </button>
      </AuthCard>
    </AuthLayout>
  );
}

export default function StaffInviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
          <Spinner className="text-[#240183]" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
