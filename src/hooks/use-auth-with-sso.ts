import { useSSO } from '@clerk/expo';
import { useState } from 'react';
import { StartSSOArgs, UseAuthWithSSOReturn } from '../types';

/**
 * Hook that provides functionality to handle SSO authentication flows.
 *
 * @returns {UseAuthWithSSOReturn} Object containing:
 * - `startSSOFlow` - A function to initiate an SSO flow. It takes a strategy, redirectUrl, and optional tokenTemplate as parameters, starting the SSO authentication and returning session information or errors upon completion
 * - `isLoading` - A boolean indicating whether an SSO process is currently ongoing
 */
export function useAuthWithSSO(): UseAuthWithSSOReturn {
  const { startSSOFlow: clerkStartSSOFlow } = useSSO();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const startSSOFlow: UseAuthWithSSOReturn['startSSOFlow'] = async ({
    strategy,
    redirectUrl,
    tokenTemplate,
  }: StartSSOArgs) => {
    try {
      setIsLoading(true);

      let sessionToken: string | null = null;

      const { createdSessionId, setActive, signIn, signUp } = await clerkStartSSOFlow({
        strategy,
        redirectUrl,
      });

      if (!createdSessionId) {
        return { sessionToken: null, signIn, signUp, isSuccess: false, error: null };
      }

      await setActive?.({
        session: createdSessionId,
        navigate: async ({ session }) => {
          sessionToken = await session.getToken({ template: tokenTemplate });
        },
      });

      if (sessionToken) {
        return { sessionToken, signIn, signUp, isSuccess: true };
      }

      return {
        signIn,
        signUp,
        isSuccess: false,
      };
    } catch (error) {
      return {
        error,
        isSuccess: false,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return { startSSOFlow, isLoading };
}
