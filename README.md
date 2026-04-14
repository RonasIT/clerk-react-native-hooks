# @ronas-it/clerk-react-native-hooks

Hooks and helpers for user authentication with [Clerk Expo SDK](https://clerk.com/docs/references/expo/overview).

## Install

```sh
npm install @ronas-it/clerk-react-native-hooks @clerk/clerk-expo @clerk/types expo-web-browser expo-auth-session
```

`react`, `react-native`, and your Clerk/Expo versions should match what `@clerk/clerk-expo` expects for your Expo SDK.

## API

### `useClerkResources`

Hook, that provides access to essential Clerk methods and objects.

Returned object:

- `signUp` — [SignUp](https://clerk.com/docs/references/javascript/sign-up)
- `signIn` — [SignIn](https://clerk.com/docs/references/javascript/sign-in)
- `setActive` — sets the active session
- `signOut` — signs out the current user

### `useAuthWithIdentifier`

Hook, that provides functionality to handle user sign-up and sign-in processes using an identifier such as an email, phone number, or username. It supports both OTP (One Time Password) and password-based authentication methods.

Parameters:

- `method`: type of identifier (`'emailAddress'`, `'phoneNumber'`, `'username'`)
- `verifyBy`: `'otp'` or `'password'`

Returned object:

- `startSignUp`, `startSignIn`, `startAuthorization`, `isLoading`
- For email/phone + OTP: `verifyCode`, `isVerifying` (`verifyCode` requires `code`, `isSignUp`, optional `tokenTemplate`)
- `startAuthorization` (email/phone + OTP): on success, includes `isSignUp` — `true` if the flow started as a new sign-up, `false` if the identifier already existed and sign-in was used instead

### Examples

#### Passwordless sign-up and sign-in

```ts
const { startSignUp, startSignIn, verifyCode } = useAuthWithIdentifier('emailAddress', 'otp');
// useAuthWithIdentifier('phoneNumber', 'otp') for SMS

await startSignUp({ identifier }); // new user
await verifyCode({ code, isSignUp: true, tokenTemplate });

await startSignIn({ identifier }); // existing user
await verifyCode({ code, isSignUp: false, tokenTemplate });
```

#### Password-based sign-up and sign-in

**SignUp** can collect a password and profile data; the address is still confirmed with a one-time code on the next step (`'otp'`). **SignIn** sign in with email (or phone) and password in one step (`'password'`);

```ts
// Sign-up: password + profile, then email OTP on another screen
const { startSignUp, isLoading } = useAuthWithIdentifier('emailAddress', 'otp');

const onSignUp = async (values: { emailAddress: string; password: string; firstName: string; lastName: string }) => {
  const { isSuccess, error } = await startSignUp({
    identifier: values.emailAddress,
    password: values.password,
    firstName: values.firstName,
    lastName: values.lastName,
  });

  if (isSuccess) {
    // Navigate to the screen where the user enters the email OTP
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

```ts
// Sign-in: email and password from the form
const { startSignIn, isLoading } = useAuthWithIdentifier('emailAddress', 'password');

const onSignIn = async (values: { emailAddress: string; password: string }) => {
  const { isSuccess, error } = await startSignIn({
    identifier: values.emailAddress,
    password: values.password,
    tokenTemplate: 'your_jwt_template',
  });

  if (isSuccess) {
    // e.g. navigate to your main screen, or call onAuthSuccess / a callback from props
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

#### Single entry: one email field, then OTP (sign-in or sign-up)

Use this when **sign-in** and **sign-up** share the same entry point with a single identifier (email or phone). Call `startAuthorization`: it attempts sign-up first; if Clerk reports that the identifier already exists, it runs sign-in instead. On success, read `isSignUp` and pass it to the code screen so `verifyCode` (or `useOtpVerification`) knows whether to complete sign-up or sign-in.

```ts
// First screen — single identifier
const { startAuthorization, isLoading } = useAuthWithIdentifier('emailAddress', 'otp');

const onContinue = async (email: string) => {
  const { error, isSignUp, isSuccess } = await startAuthorization({ identifier: email.trim() });

  if (isSuccess) {
    // Navigate to OTP screen with email and isSignUp: !!isSignUp
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

```ts
// OTP screen — same isSignUp flag from startAuthorization
const { verifyCode, isVerifying } = useAuthWithIdentifier('emailAddress', 'otp');

const onVerify = async (code: string, isSignUp: boolean) => {
  const { sessionToken, error, isSuccess } = await verifyCode({ code, isSignUp, tokenTemplate: 'your_jwt_template' });

  if (isSuccess) {
    // e.g. navigate to your main stack, or call onSuccess callback
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

Alternatively, on the code screen you can use `useOtpVerification` for `verifyCode` / `sendOtpCode` as long as you pass the same `isSignUp` into those calls.

### `useAuthWithSSO`

Hook for [SSO](https://clerk.com/docs/references/expo/use-sso) flows.

- `startSSOFlow` — `strategy`, `redirectUrl`, optional `tokenTemplate`
- `isLoading`

#### Example

```ts
import * as AuthSession from 'expo-auth-session';

const { startSSOFlow, isLoading } = useAuthWithSSO();

const onGooglePress = async () => {
  const { isSuccess, sessionToken, error, signIn, signUp } = await startSSOFlow({
    strategy: 'oauth_google',
    redirectUrl: AuthSession.makeRedirectUri({ path: navigationConfig.auth.signUp })
    tokenTemplate: 'your_jwt_template', // optional
  });

  if (isSuccess) {
    // e.g. navigate to your main stack, or call onSuccess callback
  }

   if(error) {
    showToast(error?.longMessage)
  }
};
```

Use another [`OAuthStrategy`](https://clerk.com/docs/references/javascript/types/oauth#oauth-provider-strategy-values) (for example `oauth_github`) the same way.

### `useAuthWithTicket`

Ticket-based auth: your **backend** obtains a sign-in token from Clerk ([Backend API / SDK](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token)) and exposes it to the app.

- `startAuthorization` — `ticket`, optional `tokenTemplate`
- `isLoading`

#### Example

```ts
const { startAuthorization, isLoading } = useAuthWithTicket();

const signInWithBackendTicket = async () => {
  const { ticket } = await yourApi.issueClerkSignInToken(); // server calls Clerk, returns the token to the client

  const { error, isSuccess } = await startAuthorization({
    ticket,
    tokenTemplate: 'your_jwt_template', // optional
  });

  if (isSuccess) {
    // e.g. navigate to your main stack, or call onSuccess callback
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

### `useAddIdentifier`

Add email or phone identifiers and verify with codes.

- `createIdentifier`, `verifyCode`, `isCreating`, `isVerifying`

### `useUpdateIdentifier`

Update primary email or phone: add and verify new identifier, then set primary and remove old.

- `createIdentifier`, `verifyCode`, `isCreating`, `isVerifying`, `isUpdating`

### `useOtpVerification`

Lower-level OTP send/verify for sign-in and sign-up.

- `sendOtpCode`, `verifyCode`, `isVerifying`

### `useResetPassword`

Password reset via email or phone OTP.

- `startResetPassword`, `verifyCode`, `resetPassword`, `isCodeSending`, `isResetting`, `isVerifying`

### `useChangePassword`

Update the signed-in user's password (`currentPassword`, `newPassword`).

- `updatePassword`, `isPasswordUpdating`

### `useGetSessionToken`

- `getSessionToken` — optional [token template](https://clerk.com/docs/backend-requests/jwt-templates)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
