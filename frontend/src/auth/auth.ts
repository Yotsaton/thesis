//src/auth/auth.ts
import { login, register, validateOtp, resendOtp, forgotPassword } from './authService.js';

// --- Helper Functions ---
let countdownInterval: number;

function startOtpTimer(duration: number, timerElement: HTMLElement | null, resendBtn: HTMLButtonElement | null): void {
  let timer = duration;
  if (resendBtn) resendBtn.disabled = true;
  clearInterval(countdownInterval);
  countdownInterval = window.setInterval(() => {
    const minutes = String(Math.floor(timer / 60)).padStart(2, '0');
    const seconds = String(timer % 60).padStart(2, '0');
    if (timerElement) timerElement.textContent = `${minutes}:${seconds}`;
    if (--timer < 0) {
      clearInterval(countdownInterval);
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend One-Time Password';
      }
    }
  }, 1000);
}

function startResendCooldown(resendBtn: HTMLButtonElement | null): void {
  const RESEND_DELAY = 60;
  let delay = RESEND_DELAY;
  if (resendBtn) resendBtn.disabled = true;
  const cooldownInterval = window.setInterval(() => {
    if (resendBtn) resendBtn.textContent = `Resend in ${delay}s`;
    delay--;
    if (delay < 0) {
      clearInterval(cooldownInterval);
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend One-Time Password';
      }
    }
  }, 1000);
}

function handleOtpInputNavigation(otpInputs: NodeListOf<HTMLInputElement>): void {
  otpInputs.forEach((input: HTMLInputElement, index: number) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1]?.focus();
      }
    });
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
        otpInputs[index - 1]?.focus();
      }
    });
  });
}

function checkPasswordValidity(
  passwordInput: HTMLInputElement,
  validatorElement: HTMLElement,
  submitBtn: HTMLButtonElement
): void {
    const password = passwordInput.value;
    const requirements = {
        length: validatorElement.querySelector<HTMLElement>(".validator-length"),
        uppercase: validatorElement.querySelector<HTMLElement>(".validator-uppercase"),
        lowercase: validatorElement.querySelector<HTMLElement>(".validator-lowercase"),
        number: validatorElement.querySelector<HTMLElement>(".validator-number"),
        special: validatorElement.querySelector<HTMLElement>(".validator-special"),
    };

    const isLengthValid = password.length >= 8;
    const isUppercaseValid = /[A-Z]/.test(password);
    const isLowercaseValid = /[a-z]/.test(password);
    const isNumberValid = /[0-9]/.test(password);
    const isSpecialValid = /[!@#$%^&*()]/.test(password);

    requirements.length?.classList.toggle('valid', isLengthValid);
    requirements.uppercase?.classList.toggle('valid', isUppercaseValid);
    requirements.lowercase?.classList.toggle('valid', isLowercaseValid);
    requirements.number?.classList.toggle('valid', isNumberValid);
    requirements.special?.classList.toggle('valid', isSpecialValid);

    const allValid = isLengthValid && isUppercaseValid && isLowercaseValid && isNumberValid && isSpecialValid;
    submitBtn.disabled = !allValid;
}

// --- Main UI Initializer Function ---
export function initializeAuthUI(): void {
    const container = document.querySelector<HTMLDivElement>('.container');
    const registerBtn = document.querySelector<HTMLButtonElement>('.register-btn');
    const loginBtn = document.querySelector<HTMLButtonElement>('.login-btn');
    const otpInputs = document.querySelectorAll<HTMLInputElement>('.otp-input');
    const resendBtn = document.querySelector<HTMLButtonElement>('.resend-btn');
    const timerElement = document.getElementById('timer');
    const userEmailOtp = document.querySelector<HTMLParagraphElement>('.user-email-otp');
    const loginForm = document.querySelector<HTMLFormElement>('.form-box.login form');
    const registerForm = document.querySelector<HTMLFormElement>('.form-box.register form');
    const registerPasswordInput = document.getElementById('register-password') as HTMLInputElement | null;
    const registerValidator = document.getElementById('register-validator');
    const registerSubmitBtn = registerForm?.querySelector<HTMLButtonElement>('.sent-otp-btn');
    const validateBtn = document.querySelector<HTMLButtonElement>('.validate-btn');
    const forgotPasswordForm = document.getElementById('forgot-password-form') as HTMLFormElement | null;
    const backToLoginBtns = document.querySelectorAll<HTMLButtonElement>('.back-to-login-btn');
    const OTP_TIMER_DURATION = 300;

    function resetContainerState(): void {
        container?.classList.remove('active', 'active-otp', 'active-forgot', 'active-success');
    }

    registerBtn?.addEventListener('click', () => { resetContainerState(); container?.classList.add('active'); });
    loginBtn?.addEventListener('click', () => { resetContainerState(); });
    
    document.querySelectorAll('.forgot-link a, .forgot-link-btn').forEach(el => {
        el.addEventListener('click', (e) => { e.preventDefault(); resetContainerState(); container?.classList.add('active-forgot'); });
    });

    backToLoginBtns.forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); resetContainerState(); });
    });

    forgotPasswordForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        const formData = new FormData(forgotPasswordForm);
        const email = String(formData.get('email'));
        const data = await forgotPassword(email);
        if (data?.success) { resetContainerState(); container?.classList.add('active-success'); }
        else { alert(data?.message || 'An error occurred.'); }
    });

    loginForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();

        // 🔽 1. ค้นหาปุ่ม submit ที่อยู่ในฟอร์มนี้ 🔽
        const submitButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitButton) {
            // 🔽 2. ให้ Feedback ทันทีที่กดปุ่ม 🔽
            submitButton.disabled = true;
            submitButton.textContent = 'Logging In...';
        }

        const formData = new FormData(loginForm);
        const identifier = String(formData.get('email'));
        const password = String(formData.get('password'));
        const data = await login(identifier, password);

        if (data?.success) {
            window.location.href = '/my-plans.html';
        } else { 
            alert(data?.message || 'An error occurred during login.'); 
            
            // 🔽 3. คืนสถานะปุ่มกลับมาเหมือนเดิมหากเกิด Error 🔽
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            }
        }
    });

    registerForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();

        // 🔽 1. ค้นหาปุ่ม 'Send OTP' ที่อยู่ในฟอร์มนี้ 🔽
        const submitButton = registerForm.querySelector<HTMLButtonElement>('.sent-otp-btn');
        if (submitButton) {
            // 🔽 2. ให้ Feedback ทันทีที่กดปุ่ม 🔽
            submitButton.disabled = true;
            submitButton.textContent = 'Sending OTP...';
        }

        const formData = new FormData(registerForm);
        const username = String(formData.get('username'));
        const email = String(formData.get('email'));
        const password = String(formData.get('password'));
        const data = await register(username, email, password);

        if (data?.success) {
            if (userEmailOtp) userEmailOtp.textContent = email;
            resetContainerState();
            container?.classList.add('active-otp');
            startOtpTimer(OTP_TIMER_DURATION, timerElement, resendBtn);
            setTimeout(() => { otpInputs[0]?.focus(); }, 600);
            // ไม่ต้องคืนค่าปุ่ม เพราะหน้าจอเปลี่ยนไปแล้ว
        } else {
            alert(data?.message || 'An error occurred during registration.');
            
            // 🔽 3. คืนสถานะปุ่มกลับมาเหมือนเดิมหากเกิด Error 🔽
            if (submitButton) {
                // ปุ่ม register เดิมจะถูกปิดการใช้งานตาม validation อยู่แล้ว
                // เราแค่เปลี่ยนข้อความกลับ
                submitButton.textContent = 'Send OTP';
                // เราอาจจะไม่แก้ disabled กลับเป็น false ทันที
                // เพื่อให้ผู้ใช้แก้ข้อมูลแล้ว validation ทำงานอีกครั้ง
            }
        }
    });

    validateBtn?.addEventListener('click', async () => {
        const otpCode = Array.from(otpInputs).map(i => i.value).join('');
        const email = userEmailOtp?.textContent;
        if (otpCode.length !== 6) {
            alert('Please enter a 6-digit OTP.');
            return;
        }
        if (!email) {
            alert('Could not find user email. Please try again.');
            return;
        }
        const data = await validateOtp(email, otpCode);
        if (data?.success) {
            alert('Account verified successfully! Please log in.');
            resetContainerState();
        } else {
            alert(data?.message || 'Invalid OTP. Please try again.');
        }
    });

    resendBtn?.addEventListener('click', async () => {
        const email = userEmailOtp?.textContent;
        if (!email) {
            alert('Could not find user email. Please try again.');
            return;
        }
        const data = await resendOtp(email);
        if (data?.success) {
            alert('New OTP sent!');
            startOtpTimer(OTP_TIMER_DURATION, timerElement, resendBtn);
            startResendCooldown(resendBtn);
        } else {
            alert(data?.message || 'An error occurred while resending OTP.');
        }
    });

    if (registerPasswordInput && registerValidator && registerSubmitBtn) {
        registerPasswordInput.addEventListener('input', () => {
            checkPasswordValidity(registerPasswordInput, registerValidator, registerSubmitBtn);
        });
    }
    
    handleOtpInputNavigation(otpInputs);
}
