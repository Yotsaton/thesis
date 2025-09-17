import request from 'supertest';
import express, { Express } from 'express';
import db from '../src/database/db-promise';
import bcrypt from 'bcrypt';

// --- ส่วนสำคัญ: Mocking nodemailer ---
// บอกให้ Jest สกัดกั้นโมดูล nodemailer ทั้งหมด
jest.mock('nodemailer');
// --- จบส่วน Mocking ---


describe('OTP Endpoints', () => {
    let app: Express;
    // ประกาศตัวแปรสำหรับเก็บฟังก์ชันที่จะทดสอบ
    let otpsending: any;
    let verifyOTP: any;

    const testEmail = 'test@example.com';
    const sendMailMock = jest.fn();

    // beforeEach จะรันก่อนทุกๆ เทสต์
    beforeEach(async () => {
        // 1. รีเซ็ตโมดูลทั้งหมด เพื่อให้แน่ใจว่าเราจะได้ instance ใหม่ทุกครั้ง
        jest.resetModules();

        // 2. Import nodemailer "หลังจาก" reset เพื่อให้ได้ mock instance ใหม่
        const nodemailer = require('nodemailer');

        // 3. กำหนดค่าการทำงานของ mock "ก่อน" ที่จะ import โมดูลที่ใช้งานมัน
        (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: sendMailMock,
        });

        // 4. Import โมดูลที่จะทดสอบ "หลังจาก" ตั้งค่า mock เสร็จแล้ว
        // และกำหนดค่าให้กับตัวแปรที่ประกาศไว้ด้านบน
        const otpModule = require('../src/user/otp');
        otpsending = otpModule.otpsending;
        verifyOTP = otpModule.verifyOTP;

        // 5. สร้างแอป Express ใหม่สำหรับแต่ละเทสต์
        app = express();
        app.use(express.json());
        app.post('/api/v1/otp/send', otpsending);
        app.post('/api/v1/otp/verify', verifyOTP);
        
        // 6. ล้างข้อมูลใน DB และเคลียร์ mock
        await db.none('TRUNCATE TABLE otps RESTART IDENTITY');
        sendMailMock.mockClear();
    });

    // ปิด connection หลังเทสต์ทั้งหมดจบ
    afterAll(() => {
        db.$pool.end();
    });

    // --- เทสต์สำหรับ /api/v1/otp/send ---
    describe('POST /api/v1/otp/send', () => {
        it('should send an OTP email and save the hash to the database', async () => {
            const response = await request(app)
                .post('/api/v1/otp/send')
                .send({ email: testEmail });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('OTP ถูกส่งไปยังอีเมลของคุณแล้ว');
            expect(sendMailMock).toHaveBeenCalledTimes(1);
            
            const otpData = await db.oneOrNone('SELECT otp_hash FROM otps WHERE email = $1', [testEmail]);
            expect(otpData).not.toBeNull();
        });

        it('should return 400 if email is not provided', async () => {
            const response = await request(app)
                .post('/api/v1/otp/send')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('กรุณาระบุอีเมล');
        });
    });

    // --- เทสต์สำหรับ /api/v1/otp/verify ---
    describe('POST /api/v1/otp/verify', () => {
        it('should verify the OTP successfully', async () => {
            const otp = '123456';
            const hashedOtp = await bcrypt.hash(otp, 10);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            await db.none('INSERT INTO otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)', [testEmail, hashedOtp, expiresAt]);

            const response = await request(app)
                .post('/api/v1/otp/verify')
                .send({ email: testEmail, otp: otp });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('ยืนยันตัวตนสำเร็จ!');
            
            const otpData = await db.oneOrNone('SELECT * FROM otps WHERE email = $1', [testEmail]);
            expect(otpData).toBeNull();
        });

        it('should return 400 for an incorrect OTP', async () => {
            const correctOtp = '123456';
            const hashedOtp = await bcrypt.hash(correctOtp, 10);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            await db.none('INSERT INTO otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)', [testEmail, hashedOtp, expiresAt]);

            const response = await request(app)
                .post('/api/v1/otp/verify')
                .send({ email: testEmail, otp: '654321' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('รหัส OTP ไม่ถูกต้อง');
        });

        it('should return 400 for an expired OTP', async () => {
            const otp = '111222';
            const hashedOtp = await bcrypt.hash(otp, 10);
            const expiredTime = new Date(Date.now() - 1000);
            await db.none('INSERT INTO otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)', [testEmail, hashedOtp, expiredTime]);

            const response = await request(app)
                .post('/api/v1/otp/verify')
                .send({ email: testEmail, otp: otp });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('OTP หมดอายุแล้ว กรุณาขอรหัสใหม่');
        });
    });
});
