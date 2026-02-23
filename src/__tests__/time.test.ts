/**
 * NoteGenius – Time utility tests.
 */
import { formatDate, formatDuration, formatDurationLong } from "../utils/time";

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(5000)).toBe("0:05");
    expect(formatDuration(45000)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(600000)).toBe("10:00");
  });

  it("formats hours", () => {
    expect(formatDuration(3661000)).toBe("1:01:01");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("formatDurationLong", () => {
  it("formats with human-readable units", () => {
    const result = formatDurationLong(65000);
    expect(result).toContain("1");
    expect(result).toContain("min");
  });

  it("handles zero", () => {
    const result = formatDurationLong(0);
    expect(result).toContain("0");
  });
});

describe("formatDate", () => {
  it("returns a non-empty string for valid epoch", () => {
    const result = formatDate(Date.now());
    expect(result.length).toBeGreaterThan(0);
  });
});
