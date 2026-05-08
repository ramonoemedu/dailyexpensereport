export async function signInUser({ identifier, password }: { identifier: string; password: string }) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Login failed.');
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', data.token);
  }

  return data;
}
