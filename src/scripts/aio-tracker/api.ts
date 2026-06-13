const WORKER_URL = "https://aio-tracker.samarth-upadhyay.workers.dev";

export async function registerNode(pin: string, email: string) {
  const res = await fetch(`${WORKER_URL}/register`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, email })
  });
  if (!res.ok && res.status !== 400) throw new Error("Server error");
  return { ok: res.ok, status: res.status };
}

export async function loginNode(pin: string) {
  const res = await fetch(`${WORKER_URL}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function updateKeywords(pin: string, keywords: string[]) {
  const res = await fetch(`${WORKER_URL}/update-keywords`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, keywords })
  });
  if (!res.ok) throw new Error("Failed to save configuration");
  return true;
}

// UPDATED: Supports exact millisecond timestamps or relative days
export async function fetchResults(keyword: string, options: { days?: number | null, startDate?: number | null, endDate?: number | null }) {
  let url = `${WORKER_URL}/results?keyword=${encodeURIComponent(keyword)}`;
  
  if (options.startDate && options.endDate) {
    url += `&startDate=${options.startDate}&endDate=${options.endDate}`;
  } else if (options.days) {
    url += `&days=${options.days}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch data");
  return res.json();
}