import test from "node:test";
import assert from "node:assert/strict";
import { publicPhotoTransforms, sizedTutorPhotoUrl } from "../src/lib/photo.ts";

test("ảnh công khai dùng kích cỡ cố định và giữ version URL", () => {
  assert.deepEqual(
    [publicPhotoTransforms.card.width, publicPhotoTransforms.card.height],
    [800, 440],
  );
  assert.deepEqual(
    [publicPhotoTransforms.profile.width, publicPhotoTransforms.profile.height],
    [480, 480],
  );
  assert.equal(
    sizedTutorPhotoUrl("/api/media/tutor/photo?v=123", "card"),
    "/api/media/tutor/photo?v=123&size=card",
  );
  assert.equal(
    sizedTutorPhotoUrl("/api/media/tutor/photo", "profile"),
    "/api/media/tutor/photo?size=profile",
  );
  assert.equal(
    sizedTutorPhotoUrl("https://example.com/photo.jpg", "card"),
    "https://example.com/photo.jpg",
  );
  assert.equal(Object.hasOwn(publicPhotoTransforms, "toString"), false);
});
