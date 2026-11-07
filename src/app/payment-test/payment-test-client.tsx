"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Header } from "@/components/Header";
import { useUser } from "@/lib/use-user";

type Test = {
  orderCode: number;
  amount: number;
  status: string;
  checkoutUrl: string | null;
  qrCode: string | null;
  reference: string | null;
};
const labels: Record<string, string> = {
  pending: "Chờ chuyển khoản",
  paid: "Đã nhận",
  cancelled: "Đã hủy",
  needs_check: "Cần kiểm tra",
};

export default function PaymentTestClient() {
  const { user, loading, login } = useUser();
  const [record, setRecord] = useState<Test | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function request(method: "GET" | "POST", body?: object) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payment-test", {
        method,
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "Không tải được giao dịch thử.",
        );
      setRecord(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user) void request("GET");
  }, [user]);
  useEffect(() => {
    if (!user || !record?.qrCode || record.status !== "pending") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/payment-test", {
          method: "POST",
          headers: {
            authorization: `Bearer ${await user.getIdToken()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "reconcile",
            orderCode: record.orderCode,
          }),
        });
        const result = await response.json();
        if (response.ok && result.data) setRecord(result.data);
      } catch {
        /* Keep showing the pending state; the user can still check manually. */
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [user, record?.orderCode, record?.qrCode, record?.status]);
  useEffect(() => {
    let cancelled = false;
    if (!record?.qrCode) {
      setQrImage("");
      return;
    }
    QRCode.toDataURL(record.qrCode, { width: 288, margin: 2 })
      .then((value) => {
        if (!cancelled) setQrImage(value);
      })
      .catch(() =>
        setError(
          "Không vẽ được mã QR. Bạn có thể mở trang thanh toán bên dưới.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [record?.qrCode]);
  return (
    <>
      <Header />
      <main className="wrap" style={{ maxWidth: 700, paddingBlock: 48 }}>
        <section className="panel">
          <h1>Kiểm thử thanh toán payOS</h1>
          <p>
            Giao dịch thật trên staging, cố định <strong>2.000đ</strong>. Chỉ
            admin được tạo. Giao dịch này không tạo đơn học hay thu nhập gia sư.
          </p>
          {loading ? (
            <p>Đang kiểm tra đăng nhập...</p>
          ) : !user ? (
            <button className="button" onClick={() => void login()}>
              Đăng nhập Google
            </button>
          ) : (
            <>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              {record && (
                <div>
                  <p>
                    Trạng thái:{" "}
                    <strong>{labels[record.status] || record.status}</strong>
                  </p>
                  <p>
                    Mã giao dịch: <strong>{record.orderCode}</strong>
                  </p>
                  {record.reference && (
                    <p>Tham chiếu payOS: {record.reference}</p>
                  )}
                  {qrImage && record.status === "pending" && (
                    <img
                      src={qrImage}
                      width={288}
                      height={288}
                      alt="Mã QR chuyển khoản 2.000 đồng"
                    />
                  )}
                  {record.checkoutUrl && (
                    <p>
                      <a
                        href={record.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mở trang thanh toán payOS
                      </a>
                    </p>
                  )}
                </div>
              )}
              <div className="item-actions">
                <button
                  className="button"
                  disabled={
                    busy || (record?.status === "pending" && !!record.qrCode)
                  }
                  onClick={() =>
                    void request("POST", {
                      idempotencyKey: crypto.randomUUID(),
                    })
                  }
                >
                  Tạo QR 2.000đ
                </button>
                {record && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() =>
                      void request("POST", {
                        action: "reconcile",
                        orderCode: record.orderCode,
                      })
                    }
                  >
                    Kiểm tra lại
                  </button>
                )}
              </div>
              <p className="help-text">
                Chỉ xác nhận đã nhận tiền khi trang và payOS cùng báo đã thanh
                toán; đối chiếu tài khoản nhận thủ công. Chuyển đúng 2.000đ.
              </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}
