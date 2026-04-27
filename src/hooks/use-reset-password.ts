import { useSignIn } from '@clerk/expo';
import { useState } from 'react';
import { OtpMethod, UseResetPasswordReturn } from '../types';

/**
 * Hook that provides methods to handle password reset functionality through email or phone-based OTP.
 *
 * @param {Object} params - Parameters for the hook
 * @param {OtpMethod} params.method - The method to use for OTP (emailAddress or phoneNumber)
 *
 * @returns {UseResetPasswordReturn} Object containing:
 * - `startResetPassword` - A function to initiate the password reset process by sending a verification code to the user's email or phone number
 * - `resetPassword` - A function to reset the user's password and setting a new password
 * - `verifyCode` - A function to verify a code sent to the identifier, completing the verification process
 * - `isCodeSending` - A boolean indicating if the verification code is being sent
 * - `isResetting` - A boolean indicating if the password is being reset
 * - `isVerifying` - A boolean indicating whether a verification code is currently being processed
 */
export function useResetPassword({ method }: { method: OtpMethod }): UseResetPasswordReturn {
  const { signIn } = useSignIn();

  const [isCodeSending, setIsCodeSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isEmailMethod = method === 'emailAddress';

  const startResetPassword: UseResetPasswordReturn['startResetPassword'] = async ({ identifier }) => {
    setIsCodeSending(true);

    try {
      const { error } = await signIn.create({
        identifier,
      });

      if (error) {
        return { isSuccess: false, signIn, error };
      }

      const { error: sendCodeError } =
        await signIn[isEmailMethod ? 'resetPasswordEmailCode' : 'resetPasswordPhoneCode'].sendCode();

      if (sendCodeError) {
        return { isSuccess: false, signIn, error: sendCodeError };
      }

      return { isSuccess: true, signIn };
    } catch (error) {
      return { isSuccess: false, signIn, error };
    } finally {
      setIsCodeSending(false);
    }
  };

  const verifyCode: UseResetPasswordReturn['verifyCode'] = async ({ code }) => {
    setIsVerifying(true);

    try {
      const { error: verifyCodeError } = await signIn?.[
        isEmailMethod ? 'resetPasswordEmailCode' : 'resetPasswordPhoneCode'
      ].verifyCode({ code });

      if (verifyCodeError) {
        return { isSuccess: false, signIn, error: verifyCodeError };
      }

      return { isSuccess: true, signIn };
    } catch (error) {
      return { isSuccess: false, signIn, error };
    } finally {
      setIsVerifying(false);
    }
  };

  const resetPassword: UseResetPasswordReturn['resetPassword'] = async ({ password, tokenTemplate }) => {
    setIsResetting(true);

    let sessionToken: string | null = null;

    try {
      const { error: resetPasswordError } = await signIn[
        isEmailMethod ? 'resetPasswordEmailCode' : 'resetPasswordPhoneCode'
      ].submitPassword({
        password,
      });

      if (resetPasswordError) {
        return { isSuccess: false, signIn, error: resetPasswordError };
      }

      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize({
          navigate: async ({ session }) => {
            sessionToken = await session.getToken({ template: tokenTemplate });
          },
        });

        if (finalizeError) {
          return { isSuccess: false, signIn, error: finalizeError };
        }

        if (sessionToken) {
          return { isSuccess: true, signIn, sessionToken };
        }

        return { isSuccess: false, signIn, error: null };
      }

      return { isSuccess: false, signIn, error: null };
    } catch (error) {
      return { isSuccess: false, signIn, error };
    } finally {
      setIsResetting(false);
    }
  };

  return {
    startResetPassword,
    verifyCode,
    resetPassword,
    isCodeSending,
    isVerifying,
    isResetting,
  };
}
