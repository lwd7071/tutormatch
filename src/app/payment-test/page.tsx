import { notFound } from "next/navigation";
import { paymentTestEnabled } from "@/lib/payment-test";
import PaymentTestClient from "./payment-test-client";

export const dynamic = "force-dynamic";

export default function PaymentTestPage() {
  if (!paymentTestEnabled()) notFound();
  return <PaymentTestClient />;
}
