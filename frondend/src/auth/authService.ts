const API_URL = 'http://localhost:3000/api/v1/auth';

async function apiRequest(endpoint, body, method = 'POST') {
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
    return { success: false, message: error.message || 'A network or server error occurred.' };
  }
}

export async function login(usernameOrEmail, password) { return apiRequest('/login', {usernameOrEmail, password }); }
export async function register(username, email, password) { return apiRequest('/register', { username, email, password }); }
export async function validateOtp(username, otp) { return apiRequest('/otp/verify', { username, otp }); }
export async function resendOtp(username) { return apiRequest('/otp/resendotp', { username }); }
export async function forgotPassword(email) { return apiRequest('/forgot-password', { email }); }
export async function resetPassword(token, password) { return apiRequest('/reset-password', { token, password }); }
