import test from "node:test";
import assert from "node:assert/strict";
process.env.PAYOS_CHECKSUM_KEY =
  "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
const { verifyWebhook } = await import("../src/lib/payos.ts");

test("xác thực dữ liệu mẫu chính thức của payOS và từ chối dữ liệu bị sửa", () => {
  const data = {
    orderCode: 123,
    amount: 3000,
    description: "VQRIO123",
    accountNumber: "12345678",
    reference: "TF230204212323",
    transactionDateTime: "2023-02-04 18:25:00",
    currency: "VND",
    paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
    code: "00",
    desc: "Thành công",
    counterAccountBankId: "",
    counterAccountBankName: "",
    counterAccountName: "",
    counterAccountNumber: "",
    virtualAccountName: "",
    virtualAccountNumber: "",
  };
  const signature =
    "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03";
  assert.equal(verifyWebhook({ data, signature }), true);
  assert.equal(
    verifyWebhook({ data: { ...data, amount: 1 }, signature }),
    false,
  );
  assert.equal(verifyWebhook({ data, signature: "invalid" }), false);
});
