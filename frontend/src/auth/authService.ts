//src/auth/authService.ts

// Define a standard shape for all API responses
interface ApiResponse<T = {}> {
  success: boolean;
  message?: string;
  // Use a generic 'data' property for any potential payload
  data?: T;
  // Allow any other properties the server might send
  [key: string]: any;
}

// Define allowed HTTP methods for type safety
type HttpMethod = 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';

// Use a relative URL which is better practice for deployment
const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  method: HttpMethod = 'POST'
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // IMPORTANT: This allows cookies to be sent and received
      credentials: 'include',
    });

    // Check if the response is successful (status 200-299)
    const isSuccess = response.ok;

    // Handle responses with no content (e.g., 204)
    if (response.status === 204) {
      return { success: true };
    }

    const responseData = await response.json();

    // Combine the JSON response with our success flag
    return { ...responseData, success: isSuccess };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'A network or server error occurred.';
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: errorMessage };
  }
}

// Define parameter types for each exported function
export function login(usernameOrEmail: string, password: string): Promise<ApiResponse> {
  return apiRequest('/auth/login', { usernameOrEmail, password });
}

export function register(username: string, email: string, password: string): Promise<ApiResponse> {
  return apiRequest('/auth/register', { username, email, password });
}

export function validateOtp(username: string, otp: string): Promise<ApiResponse> {
  return apiRequest('/auth/otp/verify', { username, otp });
}

export function resendOtp(username: string): Promise<ApiResponse> {
  return apiRequest('/auth/otp/resendotp', { username });
}

export function forgotPassword(email: string): Promise<ApiResponse> {
  return apiRequest('/auth/forgot-password', { email });
}

export function resetPassword(token: string, password: string): Promise<ApiResponse> {
  return apiRequest('/auth/reset-password', { token, password });
}