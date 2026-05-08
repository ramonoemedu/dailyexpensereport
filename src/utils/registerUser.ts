export async function registerUser({
  fullName,
  username,
  userId,
  email,
  password,
}: {
  fullName: string;
  username: string;
  userId: string;
  email: string;
  password: string;
}) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, username, userId, email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Registration failed.');
  }

  // Auto sign in after register
  const loginRes = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(loginData?.error || 'Login after registration failed.');
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', loginData.token);
  }

  return { uid: data.uid, familyId: null };
}
