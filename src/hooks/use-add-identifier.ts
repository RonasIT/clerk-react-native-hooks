import { isClerkAPIResponseError, useUser } from '@clerk/clerk-expo';
import { EmailAddressResource, PhoneNumberResource } from '@clerk/types';
import { useState } from 'react';
import { IdentifierType, UseAddIdentifierReturn } from '../types';

/**
 * Hook that provides functionality to add new email or phone number identifiers to a user's account and verify them using verification codes.
 *
 * @param {IdentifierType} type - Specifies the type of identifier (e.g., 'phone', 'email')
 *
 * @returns {UseAddIdentifierReturn} Object containing:
 * - `createIdentifier` - A function to add a new email or phone number identifier to the user's account and prepare it for verification
 * - `verifyCode` - A function to verify a code sent to the identifier, completing the verification process
 * - `isCreating` - A boolean indicating whether an identifier is currently being added
 * - `isVerifying` - A boolean indicating whether a verification code is currently being processed
 */
export function useAddIdentifier(type: IdentifierType): UseAddIdentifierReturn {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isEmail = type === 'email';

  const createIdentifier: UseAddIdentifierReturn['createIdentifier'] = async ({ identifier }) => {
    if (!user) {
      return { isSuccess: false, user };
    }

    setIsCreating(true);

    try {
      let resource = getIdentifierResource(identifier);

      // If the resource already exists, re-creating it will cause an error,
      // so skip the creation step and go to the send verification code flow.
      if (!resource) {
        resource = isEmail
          ? await user.createEmailAddress({ email: identifier })
          : await user.createPhoneNumber({ phoneNumber: identifier });

        await user.reload();
      }
      await prepareVerification({ isEmail, identifier });

      return { isSuccess: true, user };
    } catch (e) {
      if (isClerkAPIResponseError(e)) {
        return { error: e, user, isSuccess: false };
      }

      return { isSuccess: false, user };
    } finally {
      setIsCreating(false);
    }
  };

  const verifyCode: UseAddIdentifierReturn['verifyCode'] = async ({ code, identifier }) => {
    if (!user) {
      return { isSuccess: false, user };
    }

    setIsVerifying(true);

    try {
      const resource = getIdentifierResource(identifier);

      if (!resource) {
        return { isSuccess: false, user };
      }

      const verifyAttempt = await resource?.attemptVerification({ code });

      if (verifyAttempt?.verification?.status === 'verified') {
        return { isSuccess: true, user };
      } else {
        return { isSuccess: false, verifyAttempt };
      }
    } catch (error) {
      return { error, user, isSuccess: false };
    } finally {
      setIsVerifying(false);
    }
  };

  const prepareVerification = async ({
    isEmail,
    identifier,
  }: {
    identifier: string;
    isEmail: boolean;
  }): Promise<void> => {
    const resource = getIdentifierResource(identifier);

    if (!resource) {
      throw new Error(`No resource found for identifier: ${identifier}`);
    }

    await (isEmail
      ? resource?.prepareVerification({ strategy: 'email_code' })
      : (resource as PhoneNumberResource)?.prepareVerification());
  };

  const getIdentifierResource = (identifier: string): EmailAddressResource | PhoneNumberResource | undefined => {
    return isEmail
      ? user?.emailAddresses?.find((a) => a.emailAddress === identifier)
      : user?.phoneNumbers?.find((a) => a.phoneNumber === identifier);
  };

  return { createIdentifier, verifyCode, isCreating, isVerifying };
}
