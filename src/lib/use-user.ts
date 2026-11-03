"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "./firebase-client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, value => { setUser(value); setLoading(false); });
  }, []);
  return { user, loading, login: () => auth ? signInWithPopup(auth, googleProvider) : Promise.reject(new Error("Firebase chưa được cấu hình.")), logout: () => auth ? signOut(auth) : Promise.resolve() };
}

export async function api(user: User, action: Record<string, unknown>) {
  const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(action) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Thao tác chưa thành công.");
  return data;
}

export async function privateData(user: User) {
  const response = await fetch("/api/data?scope=private", { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không tải được dữ liệu.");
  return data;
}
