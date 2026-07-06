import { renderHook, act, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "../auth";

const listeners: ((u: unknown) => void)[] = [];
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();

jest.mock("../firebase", () => ({ auth: {}, storage: {} }));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    listeners.push(cb);
    cb(null); // start signed-out
    return () => {};
  },
  signInWithEmailAndPassword: (_a: unknown, e: string, p: string) => mockSignIn(e, p),
  createUserWithEmailAndPassword: (_a: unknown, e: string, p: string) => mockSignUp(e, p),
  signOut: () => mockSignOut(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  listeners.length = 0;
  jest.clearAllMocks();
});

it("starts signed-out then reflects an auth state change", async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.initializing).toBe(false));
  expect(result.current.user).toBeNull();

  await act(() => listeners[0]({ uid: "u1", email: "a@b.com" }));
  expect(result.current.user).toEqual({ uid: "u1", email: "a@b.com" });
});

it("delegates signIn/signUp/signOut to firebase", async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.initializing).toBe(false));
  await act(async () => {
    await result.current.signIn("a@b.com", "pw");
  });
  expect(mockSignIn).toHaveBeenCalledWith("a@b.com", "pw");
  await act(async () => {
    await result.current.signOut();
  });
  expect(mockSignOut).toHaveBeenCalled();
});
