"use client";
import { useState } from "react";
import { type WeeklySlot } from "@/lib/discovery";

const days = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minute = (value: string) => {
  const [hour, min] = value.split(":").map(Number);
  return hour * 60 + min;
};

export function AvailabilityEditor({
  profile,
  run,
  busy,
}: {
  profile: Record<string, any>;
  run: (action: Record<string, unknown>, success?: string) => void;
  busy: boolean;
}) {
  const [slots, setSlots] = useState<WeeklySlot[]>(profile.weeklySlots || []);
  const [exceptions, setExceptions] = useState<string[]>(
    profile.exceptions || [],
  );
  const [day, setDay] = useState(1),
    [start, setStart] = useState("18:00"),
    [end, setEnd] = useState("20:00"),
    [date, setDate] = useState("");
  if (profile.status !== "approved") return null;
  return (
    <section className="panel">
      <h2>Lịch rảnh để học viên tìm và chọn học thử</h2>
      <p className="help-text">
        Giờ Việt Nam. Mỗi buổi học thử dài 60 phút; ngày bận sẽ không hiện giờ
        đặt.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Ngày trong tuần</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {days.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Bắt đầu</span>
          <input
            type="time"
            step="1800"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Kết thúc</span>
          <input
            type="time"
            step="1800"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-outline"
          disabled={slots.length >= 28 || minute(end) - minute(start) < 60}
          onClick={() =>
            setSlots((current) => [
              ...current,
              { day, start: minute(start), end: minute(end) },
            ])
          }
        >
          Thêm khung giờ
        </button>
      </div>
      <div className="choice-list">
        {slots.map((slot, i) => (
          <div className="choice-row" key={`${slot.day}-${slot.start}-${i}`}>
            <span>
              {days[slot.day]} · {clock(slot.start)}–{clock(slot.end)}
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setSlots((current) => current.filter((_, index) => index !== i))
              }
            >
              Xóa
            </button>
          </div>
        ))}
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Ngày bận ngoại lệ</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-outline"
          disabled={
            !date || exceptions.includes(date) || exceptions.length >= 60
          }
          onClick={() => {
            setExceptions((current) => [...current, date].sort());
            setDate("");
          }}
        >
          Đóng ngày này
        </button>
      </div>
      <div className="choice-list">
        {exceptions.map((value) => (
          <div className="choice-row" key={value}>
            <span>{value}</span>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setExceptions((current) =>
                  current.filter((item) => item !== value),
                )
              }
            >
              Bỏ
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            run(
              { action: "saveAvailability", weeklySlots: slots, exceptions },
              "Đã cập nhật lịch rảnh.",
            )
          }
        >
          Lưu lịch rảnh
        </button>
      </div>
    </section>
  );
}
