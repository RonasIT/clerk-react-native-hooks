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

- `signUp` — [SignUp](https://clerk.com/docs/expo/reference/objects/sign-in-future)
- `signIn` — [SignIn](https://clerk.com/docs/expo/reference/objects/sign-in-future)
- `signOut` — signs out the current user

### `useAuthWithIdentifier`

Hook, that provides functionality to handle user sign-up and sign-in processes using an identifier such as an email, phone number, or username. It supports both OTP (One Time Password) and password-based authentication methods.

Parameters:

- `method`: type of identifier (`'emailAddress'`, `'phoneNumber'`, `'username'`)
- `verifyBy`: `'otp'` or `'password'`

Returned object:

- `startSignUp`, `startSignIn`, `isLoading`
- For email/phone + OTP: `verifyCode`, `isVerifying` (`verifyCode` requires `code`, `isSignUp`, optional `tokenTemplate`)

**Example:**

```ts
import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useAuthWithIdentifier } from '@ronas-it/clerk-react-native-hooks';

export const AuthWithIdentifierComponent = () => {
  const [identifier, setIdentifier] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const { startSignUp, verifyCode, isLoading, isVerifying } = useAuthWithIdentifier('emailAddress', 'otp');

  const handleSignUp = async () => {
    await startSignUp({ identifier });
  };

  const handleVerifyCode = async () => {
    const result = await verifyCode({ code: verificationCode, isSignUp: true });
    console.log(result.sessionToken);
  };

  return (
    <View>
      <TextInput
        placeholder="Enter your email"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Enter verification code"
        value={verificationCode}
        onChangeText={setVerificationCode}
      />
      <Button onPress={handleSignUp} title="Sign Up" disabled={isLoading || isVerifying} />
      <Button onPress={handleVerifyCode} title="Verify code" disabled={isLoading || isVerifying} />
    </View>
  );
};
```

### `useAuthWithSSO`

Hook for [SSO](https://clerk.com/docs/references/expo/use-sso) flows.

- `startSSOFlow` — `strategy`, `redirectUrl`, optional `tokenTemplate`
- `isLoading`

### `useAuthWithTicket`

Ticket-based auth (token from Backend API).

- `startAuthorization` — `ticket`, optional `tokenTemplate`
- `isLoading`

### `useGetSessionToken`

- `getSessionToken` — optional [token template](https://clerk.com/docs/backend-requests/jwt-templates)

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
