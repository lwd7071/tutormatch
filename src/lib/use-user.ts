"use client";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase-client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (value) => {
      setUser(value);
      setLoading(false);
    });
  }, []);
  return {
    user,
    loading,
    login: () =>
      auth
        ? signInWithPopup(auth, googleProvider)
        : Promise.reject(new Error("Firebase chưa được cấu hình.")),
    logout: () => (auth ? signOut(auth) : Promise.resolve()),
  };
}

export async function api(user: User, action: Record<string, unknown>) {
  let orderSlot = "";
  if (action.action === "createOrder" && !action.idempotencyKey) {
    orderSlot = `orderAttempt:${action.packageId}:${action.renewalOf || ""}`;
    const saved = JSON.parse(sessionStorage.getItem(orderSlot) || "null") as {
      key: string;
      at: number;
    } | null;
    const attempt =
      saved?.key && Date.now() - saved.at < 30 * 60_000
        ? saved
        : { key: crypto.randomUUID(), at: Date.now() };
    sessionStorage.setItem(orderSlot, JSON.stringify(attempt));
    action = { ...action, idempotencyKey: attempt.key };
  }
  const response = await fetch("/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(action),
  });
  const result = await responseData(response, "Thao tác chưa thành công.");
  if (orderSlot && result.status && result.status !== "pending_payment")
    sessionStorage.removeItem(orderSlot);
  return result;
}

export async function privateData(user: User) {
  const response = await fetch("/api/data?scope=private", {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    cache: "no-store",
  });
  return responseData(response, "Không tải được dữ liệu.");
}

export async function pageList(
  user: User,
  resource: string,
  page = 1,
  view: "queue" | "all" = "queue",
) {
  const query = new URLSearchParams({ resource, view, page: String(page) });
  const response = await fetch(`/api/list?${query}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    cache: "no-store",
  });
  return responseData(response, "Không tải được trang dữ liệu.");
}

export async function chatPage(user: User, threadId: string, page = 1) {
  const query = new URLSearchParams({ threadId, page: String(page) });
  const response = await fetch(`/api/chat?${query}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    cache: "no-store",
  });
  return responseData(response, "Không tải được tin nhắn.");
}

export async function responseData<T = any>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || fallback);
  return body.data as T;
}
