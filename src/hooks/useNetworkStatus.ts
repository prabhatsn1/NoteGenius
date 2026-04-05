import { useEffect, useRef, useState } from "react";

const CHECK_URL = "https://connectivitycheck.gstatic.com/generate_204";
const INTERVAL_MS = 10_000;

export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const res = await fetch(CHECK_URL, { method: "HEAD" });
      setOnline(res.status === 204 || res.ok);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    void check();
    timerRef.current = setInterval(check, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return online;
}
