const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest(endpoint: string, body: any, method: 'POST' | 'PATCH' | 'DELETE' | 'GET' = 'POST') {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || 'An HTTP error occurred');
    }
    return await response.json();
  } catch (error) {
    console.error(`API request error to ${endpoint}:`, error);
    const errorMessage = (error instanceof Error) ? error.message : 'A network or server error occurred.';
    return { success: false, message: errorMessage };
  }
}

export async function login(usernameOrEmail: string, password: string) { return apiRequest('/auth/login', {usernameOrEmail, password }); }
export async function register(username: string, email: string, password: string) { return apiRequest('/auth/register', { username, email, password }); }
export async function validateOtp(username: string, otp: string) { return apiRequest('/auth/otp/verify', { username, otp }); }
export async function resendOtp(username: string) { return apiRequest('/auth/otp/resendotp', { username }); }
export async function forgotPassword(email: string) { return apiRequest('/auth/forgot-password', { email }); }
export async function resetPassword(token: string, password: string) { return apiRequest('/auth/reset-password', { token, password }); }
