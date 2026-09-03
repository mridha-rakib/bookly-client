"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AuthCard from "@/components/auth/AuthCard";
import AuthLayout from "@/components/auth/AuthLayout";
import { PhoneInputField } from "@/components/auth/InputField";
import PhoneVerificationStep2 from "@/components/auth/PhoneVerificationStep2";
import RequireCustomer from "@/components/auth/RequireCustomer";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  useCurrentUserQuery,
  useRequestPhoneChangeMutation,
  useVerifyPhoneChangeMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";

/**
 * Post-signup completion for a new Google Customer. Google gives us a verified email, a name and
 * a Terms agreement (captured on the "Continue with Google" button) but no phone — and every
 * Bookly Customer needs a verified phone. This screen collects it by REUSING the existing
 * authenticated phone-change endpoints (`requestPhoneChange` / `verifyPhoneChange`), which the
 * backend made password-optional for accounts without a `PASSWORD` provider. No new API, no
 * duplicate OTP UI — `PhoneVerificationStep2` is the same component the email signup uses.
 *
 * Anyone who already has `phoneVerifiedAt` (i.e. every password Customer) is bounced straight to
 * the customer home, so this page is a no-op for them.
 */
function CompleteProfileContent() {
  const router = useRouter();
  const meQuery = useCurrentUserQuery();
  const requestPhoneChange = useRequestPhoneChangeMutation();
  const verifyPhoneChange = useVerifyPhoneChangeMutation();

  const [step, setStep] = useState<1 | 2>(1);
  const [countryCode, setCountryCode] = useState("+357");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const alreadyComplete = Boolean(meQuery.data?.user.phoneVerifiedAt);

  useEffect(() => {
    if (alreadyComplete) {
      router.replace("/");
    }
  }, [alreadyComplete, router]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 4) {
      setError("Please enter a valid mobile number.");
      return;
    }
    setError("");
    try {
      await requestPhoneChange.mutateAsync({ countryCode, nationalNumber: phone });
      setStep(2);
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const handleVerify = async (code: string) => {
    try {
      await verifyPhoneChange.mutateAsync(code);
      router.replace("/");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  };

  const handleResend = async () => {
    try {
      await requestPhoneChange.mutateAsync({ countryCode, nationalNumber: phone });
      toast.success("Verification code sent.");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  };

  if (meQuery.isLoading || alreadyComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  return (
    <AuthLayout showBack={step === 2} onBack={() => setStep(1)} imageSrc="/img/authImg.png">
      {step === 1 ? (
        <AuthCard
          title="Add your phone number"
          subtitle="We use it to confirm your bookings and send appointment reminders. Just one more step."
        >
          <form onSubmit={handleRequest} className="flex flex-col gap-5 w-full">
            <PhoneInputField
              label="Mobile number"
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              placeholder="123456666"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={error}
              required
            />
            <button
              type="submit"
              disabled={requestPhoneChange.isPending}
              className="w-full max-w-[520px] h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestPhoneChange.isPending ? <Spinner className="text-white" /> : "Send code"}
            </button>
          </form>
        </AuthCard>
      ) : (
        <PhoneVerificationStep2
          countryCode={countryCode}
          mobileNumber={phone}
          onVerify={handleVerify}
          onResend={handleResend}
          onBack={() => setStep(1)}
          isVerifying={verifyPhoneChange.isPending}
          isResending={requestPhoneChange.isPending}
        />
      )}
    </AuthLayout>
  );
}

export default function CompleteProfilePage() {
  return (
    <RequireCustomer>
      <CompleteProfileContent />
    </RequireCustomer>
  );
}
