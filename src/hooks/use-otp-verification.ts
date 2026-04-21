import { useState } from 'react';
import { OtpStrategy, UseOtpVerificationReturn } from '../types';
import { useClerkResources } from './use-clerk-resources';
import type { SignInFutureResource, SignUpFutureResource } from '@clerk/expo/types';

/**
 * Hook that provides functionality for managing OTP (One Time Password) verification in user authentication workflows, supporting both sign-up and sign-in processes.
 *
 * @returns {UseOtpVerificationReturn} Object containing:
 * - `sendOtpCode` - `sendOtpCode` - Sends an OTP code to the user's identifier (email or phone number) based on the specified strategy; resolves to `{ isSuccess, signIn?, signUp?, error? }`
 * - `verifyCode` - Verifies the OTP code provided by the user, completing the authentication process
 * - `isVerifying` - A boolean indicating whether a verification attempt is currently in progress
 */
export function useOtpVerification(strategy: OtpStrategy): UseOtpVerificationReturn {
  const { signUp, signIn } = useClerkResources();
  const [isVerifying, setIsVerifying] = useState(false);

  const isEmailStrategy = strategy === 'email_code';

  type HandleFinalizeReturn = {
    error: Awaited<ReturnType<SignUpFutureResource['finalize']>>['error'];
    sessionToken: string | null;
  };

  const handleFinalize = async (
    resourceFinalize: SignUpFutureResource['finalize'] | SignInFutureResource['finalize'],
    tokenTemplate: string | undefined,
  ): Promise<HandleFinalizeReturn> => {
    let sessionToken: string | null = null;
    const { error } = await resourceFinalize({
      navigate: async ({ session }) => {
        sessionToken = await session.getToken({ template: tokenTemplate });
      },
    });

    return { error, sessionToken };
  };

  type SecondFactorSendResult = Awaited<ReturnType<SignInFutureResource['mfa']['sendEmailCode']>>;

  async function sendSecondFactorOtpCode(): Promise<SecondFactorSendResult | { error: Error }> {
    const secondFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === strategy);

    if (!secondFactor) {
      throw new Error(`No second factor found for strategy: ${strategy}`);
    }

    return isEmailStrategy ? signIn.mfa.sendEmailCode() : signIn.mfa.sendPhoneCode();
  }

  const sendOtpCode: UseOtpVerificationReturn['sendOtpCode'] = async ({ isSignUp, isSecondFactor }) => {
    try {
      if (isSignUp) {
        const { error } = await signUp.verifications[isEmailStrategy ? 'sendEmailCode' : 'sendPhoneCode']();

        if (error) {
          return { isSuccess: false, error, signIn, signUp };
        }
      } else if (isSecondFactor) {
        const { error } = await sendSecondFactorOtpCode();

        if (error) {
          return { isSuccess: false, error, signIn, signUp };
        }
      } else {
        const { error } = await signIn?.[isEmailStrategy ? 'emailCode' : 'phoneCode']?.sendCode();

        if (error) {
          return { isSuccess: false, error, signIn, signUp };
        }
      }

      return { isSuccess: true, signIn, signUp };
    } catch (error) {
      return { isSuccess: false, error, signIn, signUp };
    }
  };

  const verifyCode: UseOtpVerificationReturn['verifyCode'] = async ({
    code,
    tokenTemplate,
    isSignUp,
    isSecondFactor,
  }) => {
    try {
      setIsVerifying(true);

      const verifyPromise = isSignUp
        ? signUp.verifications[isEmailStrategy ? 'verifyEmailCode' : 'verifyPhoneCode']({ code })
        : isSecondFactor
          ? signIn.mfa[isEmailStrategy ? 'verifyEmailCode' : 'verifyPhoneCode']({ code })
          : signIn[isEmailStrategy ? 'emailCode' : 'phoneCode'].verifyCode({ code });

      const { error: verifyError } = await verifyPromise;

      if (verifyError) {
        return {
          signIn,
          signUp,
          error: verifyError,
          isSuccess: false,
        };
      }

      if (isSignUp) {
        if (signUp.status === 'complete') {
          const { error, sessionToken } = await handleFinalize(signUp.finalize, tokenTemplate);

          if (error) {
            return {
              signIn,
              signUp,
              error,
              isSuccess: false,
            };
          }

          if (sessionToken) {
            return {
              sessionToken,
              signIn,
              signUp,
              isSuccess: true,
            };
          }
        }
      } else if (signIn.status === 'complete') {
        const { error, sessionToken } = await handleFinalize(signIn.finalize, tokenTemplate);

        if (error) {
          return {
            signIn,
            signUp,
            error,
            isSuccess: false,
          };
        }

        if (sessionToken) {
          return { sessionToken, signIn, signUp, isSuccess: true };
        }

        return { signIn, signUp, isSuccess: false };
      }

      return {
        signIn,
        signUp,
        isSuccess: false,
      };
    } catch (error) {
      return {
        signIn,
        signUp,
        error,
        isSuccess: false,
      };
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    sendOtpCode,
    verifyCode,
    isVerifying,
  };
}
