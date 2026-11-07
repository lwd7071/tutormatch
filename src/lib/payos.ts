import crypto from "node:crypto";

const base = process.env.PAYOS_BASE_URL || "https://api-merchant.payos.vn";
const key = process.env.PAYOS_CHECKSUM_KEY || "";

export function paymentEnabled() {
  return (
    process.env.APP_PAYMENT_PROVIDER === "payos" &&
    Boolean(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && key)
  );
}

function signature(data: string) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}
function timeoutMs(value: string | undefined, fallback: number) {
  const match = /^(\d+)s$/.exec(value || "");
  return match ? Number(match[1]) * 1000 : fallback;
}

export async function createPaymentLink(input: {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  if (!paymentEnabled()) throw new Error("Thanh toán payOS chưa được bật.");
  const body = {
    ...input,
    signature: signature(
      `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`,
    ),
  };
  const controller = new AbortController();
  let timeout = setTimeout(
    () => controller.abort(),
    timeoutMs(process.env.PAYOS_CONNECT_TIMEOUT, 3000),
  );
  try {
    const response = await fetch(`${base}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": process.env.PAYOS_CLIENT_ID!,
        "x-api-key": process.env.PAYOS_API_KEY!,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    timeout = setTimeout(
      () => controller.abort(),
      timeoutMs(process.env.PAYOS_READ_TIMEOUT, 10000),
    );
    const result = await response.json();
    if (!response.ok || result.code !== "00" || !result.data?.checkoutUrl)
      throw new Error("Không tạo được liên kết thanh toán.");
    return {
      checkoutUrl: result.data.checkoutUrl as string,
      paymentLinkId: result.data.paymentLinkId as string,
      qrCode: result.data.qrCode as string | undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPaymentLink(
  orderCode: number,
): Promise<{
  status: string;
  amount: number;
  amountPaid: number;
  checkoutUrl?: string;
  paymentLinkId?: string;
  qrCode?: string;
} | null> {
  if (!paymentEnabled()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs(process.env.PAYOS_READ_TIMEOUT, 10000),
  );
  try {
    const response = await fetch(`${base}/v2/payment-requests/${orderCode}`, {
      headers: {
        "x-client-id": process.env.PAYOS_CLIENT_ID!,
        "x-api-key": process.env.PAYOS_API_KEY!,
      },
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    const result = await response.json();
    if (
      !response.ok ||
      result.code !== "00" ||
      Number(result.data?.orderCode) !== orderCode
    )
      throw new Error("Không tra được trạng thái thanh toán.");
    return {
      status: result.data.status,
      amount: Number(result.data.amount),
      amountPaid: Number(result.data.amountPaid),
      checkoutUrl: result.data.checkoutUrl,
      paymentLinkId: result.data.id || result.data.paymentLinkId,
      qrCode: result.data.qrCode,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyWebhook(payload: {
  data?: Record<string, unknown>;
  signature?: string;
}) {
  if (!key || !payload.data || typeof payload.signature !== "string")
    return false;
  const data = Object.keys(payload.data)
    .sort()
    .filter((k) => payload.data![k] !== undefined)
    .map((k) => {
      const value = payload.data![k];
      if (value == null || value === "undefined" || value === "null")
        return `${k}=`;
      if (Array.isArray(value))
        return `${k}=${JSON.stringify(value.map((item) => (item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)))}`;
      return `${k}=${value}`;
    })
    .join("&");
  const expected = signature(data);
  const supplied = payload.signature.toLowerCase();
  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
