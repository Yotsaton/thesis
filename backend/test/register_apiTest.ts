// /test/register_apiTest.ts
import request from 'supertest';
import express from 'express';
import authRoutes from '../src/api/auth.api'; // import router ที่เราจะทดสอบ
import db from '../src/database/db-promise'; // import db instance เพื่อจัดการข้อมูลเทสต์

// สร้าง Express app จำลองสำหรับเทสต์
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);


// describe เป็นการจัดกลุ่มเทสต์ที่เกี่ยวข้องกัน
describe('POST /api/v1/auth/register', () => {

    // ฟังก์ชันที่รัน "ก่อน" ทุกเทสต์ในไฟล์นี้จะเริ่ม
    beforeAll(async () => {
        // ล้างข้อมูลเก่าในตาราง users เพื่อให้ทุกการรันเทสต์เริ่มต้นเหมือนกัน
        await db.none('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    });

    // ฟังก์ชันที่รัน "หลัง" จากแต่ละเทสต์เสร็จสิ้น
    afterEach(async () => {
        // ล้างข้อมูลอีกครั้งเพื่อไม่ให้เทสต์แต่ละอันส่งผลกระทบต่อกัน
        await db.none('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    });

    // ฟังก์ชันที่รัน "หลัง" จากทุกเทสต์ในไฟล์นี้จบลง
    afterAll(() => {
        // ปิด connection ของ database เพื่อให้ Jest จบการทำงานได้สมบูรณ์
        db.$pool.end();
    });


    // ✅ Test Case 1: กรณีสมัครสมาชิกสำเร็จ
    it('should register a new user successfully with status 201', async () => {
        const newUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'StrongPassword123'
        };

        const response = await request(app)
            .post('/api/v1/auth/register')
            .send(newUser);

        // ตรวจสอบ Status Code
        expect(response.status).toBe(201);
        // ตรวจสอบ Response Body
        expect(response.body.message).toBe('User registered successfully');
        expect(response.body.user.user_name).toBe(newUser.username);
        expect(response.body.user.email).toBe(newUser.email);
        // ตรวจสอบว่ารหัสผ่านไม่ได้ถูกส่งกลับมา
        expect(response.body.user).not.toHaveProperty('password');
    });


    // ❌ Test Case 2: กรณี Username ซ้ำ
    it('should return 400 if username already exists', async () => {
        // 1. สร้าง user คนแรกก่อน
        const user = { username: 'duplicateuser', email: 'first@example.com', password: 'password123' };
        await request(app).post('/api/v1/auth/register').send(user);

        // 2. พยายามสร้าง user ที่มี username ซ้ำ
        const duplicateUser = { username: 'duplicateuser', email: 'second@example.com', password: 'password456' };
        const response = await request(app)
            .post('/api/v1/auth/register')
            .send(duplicateUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Username or email already exists');
    });

    // ❌ Test Case 3: กรณีไม่ได้ส่งข้อมูลที่จำเป็น (เช่น password)
    it('should return 400 if password is missing', async () => {
        const incompleteUser = {
            username: 'nouser',
            email: 'no@email.com'
            // ไม่มี password
        };

        const response = await request(app)
            .post('/api/v1/auth/register')
            .send(incompleteUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Username, email, and password are required');
    });

});