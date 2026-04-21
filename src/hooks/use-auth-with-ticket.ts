import { useSignIn } from '@clerk/expo';
import { useState } from 'react';
import { UseAuthWithTicketReturn } from '../types';

/**
 * Hook that facilitates user authentication using a ticket-based strategy (ticket is a token generated from the Backend API).
 *
 * @returns {UseAuthWithTicketReturn} Object containing:
 * - `startAuthorization` - A function to initiate authentication with a ticket. It accepts an object with ticket and optional tokenTemplate parameters to kick off the authorization process and returns the session details
 * - `isLoading` - A boolean indicating whether the ticket-based authorization process is ongoing
 */
export function useAuthWithTicket(): UseAuthWithTicketReturn {
  const { signIn } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);

  const startAuthorization: UseAuthWithTicketReturn['startAuthorization'] = async ({ ticket, tokenTemplate }) => {
    setIsLoading(true);

    let sessionToken: string | null = null;

    try {
      const { error } = await signIn.create({
        strategy: 'ticket',
        ticket,
      });

      if (signIn?.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize({
          navigate: async ({ session }) => {
            sessionToken = await session.getToken({ template: tokenTemplate });
          },
        });

        if (finalizeError) {
          return { isSuccess: false, signIn, error: finalizeError };
        }

        if (sessionToken) {
          return { sessionToken, signIn, isSuccess: !!sessionToken };
        }
      }

      return { isSuccess: false, signIn, error };
    } catch (error) {
      return {
        signIn,
        error,
        isSuccess: false,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    startAuthorization,
    isLoading,
  };
}
