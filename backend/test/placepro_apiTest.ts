// src/routes/__tests__/placeRoutes.test.ts

import request from 'supertest';
import express from 'express';
import placeRoutes from '../src/api/place.api'; // import router ของเรา
import { processPlaces } from '../src/place/place_service'; // import มาเพื่อ mock
import { Place, ResolveInput } from '../src/place/types/types';

// --- Mocking Setup ---
// บอก Jest ให้แทนที่โมดูล 'placeService' ทั้งหมดด้วย mock version
jest.mock('../src/place/place_service');

// สร้าง Type-safe mock function
const mockedProcessPlaces = processPlaces as jest.Mock;

// --- Express App Setup for Testing ---
// สร้างแอปจำลองขึ้นมาเพื่อใช้ในการเทสโดยเฉพาะ
const app = express();
app.use(express.json());
app.use('/api/places', placeRoutes);


// --- เริ่ม Test Suite ---
describe('POST /api/places/process', () => {

  // ตั้งค่า Maps_API_KEY ก่อนเริ่มเทส
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules() // ล้าง cache ของ module
    process.env = { ...OLD_ENV, Maps_API_KEY: 'test-api-key' }; // ตั้งค่า key
  });

  afterAll(() => {
    process.env = OLD_ENV; // คืนค่า env เดิมหลังเทสเสร็จ
  });


  // === Test Case 1: Happy Path (200 OK) ===
  it('should return 200 and an array of places for a valid request', async () => {
    // 1. Arrange: กำหนดค่าที่จะให้ mock function คืนกลับมา
    const mockRequestBody: ResolveInput[] = [
      { place_id_by_ggm: 'ggm-id-1', location: { type: 'Point', coordinates: [100, 13] } }
    ];
    const mockServiceResult: Place[] = [
      { place_id: 'uuid-1', name_place: 'Test Place 1', /* ... other fields ... */ } as Place
    ];
    mockedProcessPlaces.mockResolvedValue(mockServiceResult);

    // 2. Act: ส่ง request ไปยัง API
    const response = await request(app)
      .post('/api/places/process')
      .send(mockRequestBody);

    // 3. Assert: ตรวจสอบผลลัพธ์
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockServiceResult);
    // ตรวจสอบว่า mock function ถูกเรียกด้วย arguments ที่ถูกต้อง
    expect(mockedProcessPlaces).toHaveBeenCalledWith(mockRequestBody, 'test-api-key');
  });


  // === Test Case 2: Invalid Body (400 Bad Request) ===
  it('should return 400 if the request body is not a valid array', async () => {
    const invalidBodies = [
      {},                  // ไม่ใช่ array
      [],                  // array ว่าง
      'not-an-array'       // ไม่ใช่ array
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/places/process')
        .send(body);
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Request body must be a non-empty array.' });
    }
  });


  // === Test Case 3: Service Layer Error (500 Internal Server Error) ===
  it('should return 500 if the processPlaces service throws an error', async () => {
    // Arrange: กำหนดให้ mock function throw error
    const errorMessage = 'Database connection failed';
    mockedProcessPlaces.mockRejectedValue(new Error(errorMessage));

    const mockRequestBody: ResolveInput[] = [
      { place_id_by_ggm: 'ggm-id-1', location: { type: 'Point', coordinates: [100, 13] } }
    ];

    // Act
    const response = await request(app)
      .post('/api/places/process')
      .send(mockRequestBody);

    // Assert
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'An internal server error occurred.' });
  });

  
  // === Test Case 4: Missing API Key on Server (500 Internal Server Error) ===
  it('should return 500 if Maps_API_KEY is not configured', async () => {
      // Arrange: ลบ environment variable
      delete process.env.Maps_API_KEY;

      const mockRequestBody: ResolveInput[] = [
        { place_id_by_ggm: 'ggm-id-1', location: { type: 'Point', coordinates: [100, 13] } }
      ];

      // Act
      const response = await request(app)
          .post('/api/places/process')
          .send(mockRequestBody);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Server configuration error.' });
  });

});