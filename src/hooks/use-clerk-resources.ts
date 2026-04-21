import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { UseClerkResourcesReturn } from '../types';

/**
 * Hook that provides access to essential Clerk methods and objects.
 *
 * @returns {UseClerkResourcesReturn} Object containing Clerk resources:
 * - `signUp` - Provides access to SignUp object: https://clerk.com/docs/references/javascript/sign-up
 * - `signIn` - Provides access to SignIn object: https://clerk.com/docs/references/javascript/sign-in
 * - `setActive` - A function that sets the active session
 * - `signOut` - A function that signs out the current user
 */
export const useClerkResources = (): UseClerkResourcesReturn => {
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const { signOut } = useClerk();

  signIn.create({
    identifier: 'test@test.com',
    password: 'password',
    signUpIfMissing: true,
  });

  return { signUp, signIn, signOut };
};
