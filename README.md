# @ronas-it/clerk-react-native-hooks

Hooks and helpers for user authentication with [Clerk Expo SDK](https://clerk.com/docs/references/expo/overview).

## Install

```sh
npm install @ronas-it/clerk-react-native-hooks @clerk/clerk-expo @clerk/types expo-web-browser expo-auth-session
```

`react`, `react-native`, and your Clerk/Expo versions should match what `@clerk/clerk-expo` expects for your Expo SDK.

## API

### `useClerkResources`

Returns core Clerk resources used by the higher-level hooks.

Returns:

- `signUp` — [SignUp](https://clerk.com/docs/references/javascript/sign-up)
- `signIn` — [SignIn](https://clerk.com/docs/references/javascript/sign-in)
- `setActive` — sets the active session
- `signOut` — signs out the current user

### `useAuthWithIdentifier`

Sign up or sign in with an identifier (`emailAddress`, `phoneNumber`, or `username`) using either OTP or password.

Parameters:

- `method` — `'emailAddress'`, `'phoneNumber'`, or `'username'`
- `verifyBy` — `'otp'` or `'password'`

Returns:

- `startSignUp`, `startSignIn`, `startAuthorization`, `isLoading`
- For email/phone + OTP: `verifyCode`, `isVerifying`
- `verifyCode` expects `{ code, isSignUp, tokenTemplate? }`
- `startAuthorization` resolves with `isSignUp`: `true` if the flow continues as sign-up, `false` if the identifier already existed and Clerk switched to sign-in

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

**Sign-up** can collect a password and profile data; the address is still confirmed with a one-time code on the next step (`'otp'`). **Sign-in** uses email (or phone) and password in one step (`'password'`).

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
    // go to the email OTP step
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
    // handle success
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

#### Single entry: one email/phone field, then OTP (sign-in or sign-up)

Use this when **sign-in** and **sign-up** share one identifier field (email or phone). `startAuthorization` tries sign-up first; if Clerk reports that the identifier already exists, it falls back to sign-in. Pass `isSignUp` to the code screen so `verifyCode` (or `useOtpVerification`) knows which flow to finish.

```ts
// First screen — single identifier
const { startAuthorization, isLoading } = useAuthWithIdentifier('emailAddress', 'otp');

const onContinue = async (email: string) => {
  const { error, isSignUp, isSuccess } = await startAuthorization({ identifier: email.trim() });

  if (isSuccess) {
    // go to OTP step with email and isSignUp: !!isSignUp
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
    // handle success
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
  const { isSuccess, error } = await startSSOFlow({
    strategy: 'oauth_google',
    redirectUrl: AuthSession.makeRedirectUri({ path: navigationConfig.auth.signUp }),
    tokenTemplate: 'your_jwt_template', // optional
  });

  if (isSuccess) {
    // handle success
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

Use another [`OAuthStrategy`](https://clerk.com/docs/references/javascript/types/oauth#oauth-provider-strategy-values) (for example `oauth_github`) the same way.

### `useAuthWithTicket`

Ticket-based auth: your **backend** obtains a sign-in token from Clerk ([Backend API / SDK](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token)) and returns it to the app.

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
    // handle success
  }

  if (error) {
    showToast(error?.longMessage);
  }
};
```

### `useAddIdentifier`

Link an extra **email** or **phone** to the **signed-in** user. `createIdentifier` attaches the value (or resumes verification if it already exists) and sends a one-time code; `verifyCode` confirms with the **same** `identifier` string.

- `type` — `'email'` or `'phone'`
- `createIdentifier` — `{ identifier }`
- `verifyCode` — `{ code, identifier }`
- `isCreating`, `isVerifying`

#### Example

Typically two steps (two screens or one wizard): save the address, then enter the code.

```ts
// Step 1 — register identifier and trigger email code / SMS
const { createIdentifier, isCreating } = useAddIdentifier('email');

const onSaveEmail = async (email: string) => {
  const { isSuccess, error } = await createIdentifier({ identifier: email });

  if (isSuccess) {
    // go to verification; keep `email` for step 2
  }
};
```

```ts
// Step 2 — same `identifier` as in createIdentifier
const { verifyCode, isVerifying } = useAddIdentifier('email');

const onSubmitCode = async (code: string, email: string) => {
  const { isSuccess, error } = await verifyCode({ code, identifier: email });

  if (isSuccess) {
    // handle success
  }
};
```

### `useUpdateIdentifier`

For a **signed-in** user who is **changing** their primary email or phone: `createIdentifier` adds the new address and sends a verification code; after `verifyCode` succeeds, that identifier becomes **primary** and the previous primary is **removed**.

- `type` — `'email'` or `'phone'`
- `createIdentifier` — `{ identifier }`
- `verifyCode` — `{ code, identifier }`
- `isCreating`, `isVerifying`, `isUpdating` (`isUpdating` covers the primary swap + cleanup)

#### Example

Pattern: user submits a **new** email (or phone), then enters the OTP. Loading on the code step should account for `isVerifying || isUpdating`.

```ts
// Step 1 — send code to the new address
const { createIdentifier, isCreating } = useUpdateIdentifier('email');

const onSaveNewEmail = async (newEmail: string) => {
  const { isSuccess, error } = await createIdentifier({ identifier: newEmail });

  if (isSuccess) {
    // go to verification; keep `newEmail` for step 2
  }
};
```

```ts
// Step 2 — same `identifier` as in createIdentifier
const { verifyCode, isVerifying, isUpdating } = useUpdateIdentifier('email');

const onSubmitCode = async (code: string, newEmail: string) => {
  const { isSuccess, error } = await verifyCode({ code, identifier: newEmail.trim() });

  if (isSuccess) {
    // handle success
  }
};
```

### `useOtpVerification`

Lower-level OTP send/verify for sign-in and sign-up.
**`sendOtpCode`** asks Clerk to deliver a code (first send or resend) for **`email_code`** or **`phone_code`**. **`verifyCode`** submits the code, activates the session, and optionally returns a JWT. Use the same **`isSignUp`** on every call (`true` for sign-up, `false` for sign-in).

- `sendOtpCode` — `{ strategy: 'email_code' | 'phone_code', isSignUp, isSecondFactor? }`
- `verifyCode` — `{ code, strategy, isSignUp, tokenTemplate?, isSecondFactor? }`
- `isVerifying` — true while `verifyCode` is running

#### Example

```ts
const { verifyCode, isVerifying, sendOtpCode } = useOtpVerification();

const sendOrResendCode = () => {
  sendOtpCode({ strategy: 'email_code', isSignUp: true });
};

const onSubmitCode = async (code: string) => {
  const { isSuccess, error, sessionToken } = await verifyCode({
    code,
    strategy: 'email_code',
    isSignUp: true,
    tokenTemplate: 'your_jwt_template', // optional
  });

  if (isSuccess) {
    // handle success
  }
};
```

For SMS, use `strategy: 'phone_code'`. For sign-in OTP, set `isSignUp: false` in both calls.

### `useResetPassword`

Password reset via email or phone OTP for the forgot-password flow.

Use the same **`method`** (`'emailAddress'` or `'phoneNumber'`) on `useResetPassword` for each step.

1. **`startResetPassword({ identifier })`** — sends the reset code (`isCodeSending`); repeat to resend.
2. **`verifyCode({ code })`** — verifies the code (`isVerifying`).
3. **`resetPassword({ password, tokenTemplate? })`** — applies the new password and finishes sign-in (`isResetting`).

#### Example

```ts
// 1 — request code
const { startResetPassword, isCodeSending } = useResetPassword({ method: 'emailAddress' });

const onRequestCode = async (email: string) => {
  const { isSuccess, error } = await startResetPassword({ identifier: email });
  // if isSuccess → go to code step; keep `email` for resend
};
```

```ts
// 2 — submit code (and optional resend)
const { verifyCode, isVerifying, startResetPassword } = useResetPassword({ method: 'emailAddress' });

const onSubmitCode = async (code: string, email: string) => {
  const { isSuccess, error } = await verifyCode({ code });
  // if isSuccess → go to new-password step
};

const sendOrResendCode = (email: string) => {
  startResetPassword({ identifier: email });
};
```

```ts
// 3 — new password
const { resetPassword, isResetting } = useResetPassword({ method: 'emailAddress' });

const onSetNewPassword = async (password: string) => {
  const { isSuccess, sessionToken, error } = await resetPassword({
    password,
    tokenTemplate: 'your_jwt_template', // optional
  });
  // if isSuccess → handle success
};
```

For SMS, use `{ method: 'phoneNumber' }` and pass the phone number as `identifier`.

### `useUpdatePassword`

Change password for the **signed-in** user using the **current** password and a **new** password, not the forgot-password / OTP flow.

- `updatePassword` — `{ currentPassword, newPassword }` → `{ isSuccess, error? }`
- `isPasswordUpdating`

#### Example

```ts
const { updatePassword, isPasswordUpdating } = useUpdatePassword();

const onSubmit = async (values: { currentPassword: string; newPassword: string }) => {
  const { isSuccess, error } = await updatePassword({
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
  });

  if (isSuccess) {
    // handle success
  }
};
```

### `useGetSessionToken`

Helper hook when you need to **read the session token** outside the higher-level flows.

- `getSessionToken` — `{ tokenTemplate? }` → `{ isSuccess, sessionToken?, error? }`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
