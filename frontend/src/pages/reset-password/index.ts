//src/pages/reset-password/index.ts
import { resetPassword } from "../../auth/authService.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-password-form") as HTMLFormElement | null;
  if (!form) return;

  // --- Type DOM Elements ---
  const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
  const confirmPasswordInput = form.querySelector<HTMLInputElement>('input[name="confirm-password"]');
  const messageElement = document.getElementById("form-message");
  const submitButton = document.getElementById("reset-submit-btn") as HTMLButtonElement | null;
  const loginLink = document.getElementById("login-link");
  const validatorElement = document.getElementById("reset-validator");

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  function checkPasswordValidity(
    passwordInput: HTMLInputElement,
    validatorElement: HTMLElement,
    submitBtn: HTMLButtonElement
  ): void {
    const password = passwordInput.value;
    const requirements = {
      length: validatorElement.querySelector<HTMLLIElement>(".validator-length"),
      uppercase: validatorElement.querySelector<HTMLLIElement>(".validator-uppercase"),
      lowercase: validatorElement.querySelector<HTMLLIElement>(".validator-lowercase"),
      number: validatorElement.querySelector<HTMLLIElement>(".validator-number"),
      special: validatorElement.querySelector<HTMLLIElement>(".validator-special"),
    };

    const isLengthValid = password.length >= 8;
    const isUppercaseValid = /[A-Z]/.test(password);
    const isLowercaseValid = /[a-z]/.test(password);
    const isNumberValid = /[0-9]/.test(password);
    const isSpecialValid = /[!@#$%^&*()]/.test(password);

    requirements.length?.classList.toggle("valid", isLengthValid);
    requirements.uppercase?.classList.toggle("valid", isUppercaseValid);
    requirements.lowercase?.classList.toggle("valid", isLowercaseValid);
    requirements.number?.classList.toggle("valid", isNumberValid);
    requirements.special?.classList.toggle("valid", isSpecialValid);

    const allValid = isLengthValid && isUppercaseValid && isLowercaseValid && isNumberValid && isSpecialValid;
    submitBtn.disabled = !allValid;
  }

  // --- Add Event Listeners with Null Safety ---
  if (passwordInput && validatorElement && submitButton) {
    passwordInput.addEventListener("input", () => {
      checkPasswordValidity(passwordInput, validatorElement, submitButton);
    });
  }

  form.addEventListener("submit", async (e: Event) => {
    e.preventDefault();
    const password = passwordInput?.value ?? "";
    const confirmPassword = confirmPasswordInput?.value ?? "";

    if (!token) {
      if (messageElement) {
        messageElement.textContent = "Error: No reset token found. Please request a new link.";
        messageElement.className = "form-message error";
      }
      return;
    }

    if (submitButton?.disabled) {
      if (messageElement) {
        messageElement.textContent = "Please ensure your password meets all requirements.";
        messageElement.className = "form-message error";
      }
      return;
    }

    if (password !== confirmPassword) {
      if (messageElement) {
        messageElement.textContent = "Passwords do not match. Please try again.";
        messageElement.className = "form-message error";
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    const data = await resetPassword(token, password);
    if (data?.success) {
      if (messageElement) {
        messageElement.textContent = "Password has been reset successfully!";
        messageElement.className = "form-message success";
      }
      if (submitButton) submitButton.style.display = "none";
      if (passwordInput) passwordInput.style.display = "none";
      if (confirmPasswordInput) confirmPasswordInput.style.display = "none";
      if (validatorElement) validatorElement.style.display = "none";
      if (loginLink) loginLink.style.display = "block";
    } else {
      if (messageElement) {
        messageElement.textContent = data?.message || "An unknown error occurred.";
        messageElement.className = "form-message error";
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save New Password";
      }
    }
  });
});