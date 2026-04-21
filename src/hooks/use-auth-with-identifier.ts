import { useState } from 'react';
import {
  AuthIdentifierVerifyBy,
  AuthorizationFinishedReturn,
  IdentifierMethodFor,
  StartAuthParams,
  StartSignInWithIdentifierReturn,
  StartSignUpParams,
  StartSignUpWithIdentifierReturn,
  UseAuthWithIdentifierReturn,
} from '../types';
import { useClerkResources } from './use-clerk-resources';
import { useOtpVerification } from './use-otp-verification';

/**
 * Hook that provides functionality to handle user sign-up and sign-in processes using an identifier such as an email, phone number, or username. It supports both OTP (One Time Password) and password-based authentication methods.
 *
 * @template {AuthIdentifierVerifyBy} TVerifyBy - The verification method type
 * @template {IdentifierMethodFor<TVerifyBy>} TMethod - The identifier method type
 * @param {TMethod} method - Specifies the type of identifier used for authentication (e.g., 'emailAddress', 'phoneNumber', 'username')
 * @param {TVerifyBy} verifyBy - Specifies the verification method ('otp' for one-time passwords or 'password')
 *
 * @returns {UseAuthWithIdentifierReturn<TVerifyBy, TMethod>} Object containing:
 * - `startSignUp` - Initiates a new user registration using the specified identifier and verification method
 * - `startSignIn` - Initiates authentication of an existing user using the specified identifier and verification method
 * - `startAuthorization` - Determines whether to initiate a sign-up or sign-in based on whether the user has been registered previously
 * - `verifyCode` - Verifies an OTP code if the verification method is 'otp' (only available for non-username methods)
 * - `isLoading` - Indicates whether an authentication request is in progress
 * - `isVerifying` - Indicates whether an OTP verification is in progress (only available for non-username methods)
 */
export function useAuthWithIdentifier<
  TVerifyBy extends AuthIdentifierVerifyBy,
  TMethod extends IdentifierMethodFor<TVerifyBy>,
>(method: TMethod, verifyBy: TVerifyBy): UseAuthWithIdentifierReturn<TVerifyBy, TMethod> {
  const { signUp, signIn } = useClerkResources();

  const [isLoading, setIsLoading] = useState(false);
  const strategy = method === 'emailAddress' ? 'email_code' : 'phone_code';
  const { sendOtpCode, verifyCode: verifyOtpCode, isVerifying } = useOtpVerification(strategy);

  const handleSignInWithPassword = async (
    isSignUp: boolean,
    tokenTemplate?: string,
  ): Promise<StartSignInWithIdentifierReturn<TVerifyBy> | StartSignUpWithIdentifierReturn<TMethod>> => {
    const authMethod = isSignUp ? signUp : signIn;

    let sessionToken: string | null = null;

    const { error } = await authMethod.finalize({
      navigate: async ({ session }) => {
        sessionToken = await session.getToken({ template: tokenTemplate });
      },
    });

    if (sessionToken) {
      return { sessionToken, signIn, signUp, isSuccess: true };
    }

    if (error) {
      return { error, signIn, signUp, isSuccess: false };
    }

    return { isSuccess: false, signIn, signUp, error: null };
  };

  const handleUsernameAuth: {
    (params: StartSignUpParams<TVerifyBy>, isSignUp: true): Promise<StartSignUpWithIdentifierReturn<TMethod>>;
    (params: StartAuthParams<TVerifyBy>, isSignUp: false): Promise<StartSignInWithIdentifierReturn<TVerifyBy>>;
  } = async (
    params: StartAuthParams<TVerifyBy> | StartSignUpParams<TVerifyBy>,
    isSignUp: boolean,
  ): Promise<StartSignInWithIdentifierReturn<TVerifyBy> | StartSignUpWithIdentifierReturn<TMethod>> => {
    const { identifier, password, tokenTemplate, ...restParams } = params as StartAuthParams<'password'>;
    const authMethod = isSignUp ? signUp : signIn;
    const authPayload = isSignUp
      ? { username: identifier, password, ...restParams }
      : { identifier, password, ...restParams };

    const { error } = await authMethod?.create(authPayload);

    if (authMethod?.status === 'complete') {
      return handleSignInWithPassword(isSignUp, tokenTemplate);
    }

    return {
      isSuccess: false,
      error,
      [isSignUp ? 'signUp' : 'signIn']: authMethod,
    } as StartSignInWithIdentifierReturn<TVerifyBy> | StartSignUpWithIdentifierReturn<TMethod>;
  };

  const handleEmailPhoneAuth: {
    (params: StartSignUpParams<TVerifyBy>, isSignUp: true): Promise<StartSignUpWithIdentifierReturn<TMethod>>;
    (params: StartAuthParams<TVerifyBy>, isSignUp: false): Promise<StartSignInWithIdentifierReturn<TVerifyBy>>;
  } = async (
    params: StartAuthParams<TVerifyBy> | StartSignUpParams<TVerifyBy>,
    isSignUp: boolean,
  ): Promise<StartSignInWithIdentifierReturn<TVerifyBy> | StartSignUpWithIdentifierReturn<TMethod>> => {
    const authMethod = isSignUp ? signUp : signIn;
    const identifierFieldName = isSignUp ? method : 'identifier';

    if (verifyBy === 'password') {
      try {
        const { password, tokenTemplate, identifier, ...restParams } = params as StartAuthParams<'password'>;
        await authMethod?.create({ [identifierFieldName]: identifier, password, ...restParams });

        if (authMethod?.status === 'complete') {
          return handleSignInWithPassword(isSignUp, tokenTemplate);
        } else {
          return { isSuccess: false, signIn, signUp, status: authMethod?.status, error: null };
        }
      } catch (error) {
        return { error, signIn, signUp };
      }
    } else if (verifyBy === 'otp') {
      const { identifier, ...restParams } = params;

      try {
        await authMethod?.create({ [identifierFieldName]: identifier, ...restParams });
        const { isSuccess, error } = await sendOtpCode({ isSignUp });

        return { isSuccess, error, signIn, signUp } as
          | StartSignInWithIdentifierReturn<TVerifyBy>
          | StartSignUpWithIdentifierReturn<TMethod>;
      } catch (error) {
        return { error, signIn, signUp };
      }
    }

    return {
      isSuccess: true,
      [isSignUp ? 'signUp' : 'signIn']: authMethod,
    } as StartSignInWithIdentifierReturn<TVerifyBy> | StartSignUpWithIdentifierReturn<TMethod>;
  };

  const startSignUp: UseAuthWithIdentifierReturn<TVerifyBy, TMethod>['startSignUp'] = async (params) => {
    try {
      setIsLoading(true);

      return method === 'username' ? await handleUsernameAuth(params, true) : await handleEmailPhoneAuth(params, true);
    } catch (error) {
      return { error, signUp, isSuccess: false } as StartSignUpWithIdentifierReturn<TMethod>;
    } finally {
      setIsLoading(false);
    }
  };

  const startSignIn: UseAuthWithIdentifierReturn<TVerifyBy, TMethod>['startSignIn'] = async (params) => {
    try {
      setIsLoading(true);

      return method === 'username'
        ? await handleUsernameAuth(params, false)
        : await handleEmailPhoneAuth(params, false);
    } catch (error) {
      return { error, signIn, isSuccess: false } as StartSignInWithIdentifierReturn<TVerifyBy>;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async ({
    code,
    isSignUp,
    tokenTemplate,
  }: {
    code: string;
    isSignUp: boolean;
    tokenTemplate?: string;
  }): Promise<AuthorizationFinishedReturn> => {
    setIsLoading(true);

    try {
      return await verifyOtpCode({ code, tokenTemplate, isSignUp });
    } finally {
      setIsLoading(false);
    }
  };

  if (method === 'username') {
    return {
      startSignIn,
      startSignUp,
      isLoading,
    } as UseAuthWithIdentifierReturn<TVerifyBy, TMethod>;
  } else {
    return {
      startSignIn,
      startSignUp,
      isLoading,
      verifyCode,
      isVerifying,
    } as UseAuthWithIdentifierReturn<TVerifyBy, TMethod>;
  }
}
