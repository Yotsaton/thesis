// src/server.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import user from "./api/auth.api";
import trip from "./api/trip.api";
import routeapi from "./api/route.api";
import processPlaces from "./api/place.api";
import recomment from "./api/recomment.api";
import activity from "./api/activityLogs.api";

import "./job/presence-cleaner";

const app = express();
const port = 3000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// กำหนดเส้นทางหลักของ API
app.get('/api/v1', (req, res) => {
    res.send('API is running...');
});

app.use("/api/v1/auth", user)
app.use("/api/v1/auth/trip", trip)
app.use("/api/v1/auth/route", routeapi)
app.use("/api/v1/place", processPlaces)
app.use("/api/v1/auth/recomment", recomment)
app.use("/api/v1/auth/activity", activity)
// app.use("/api/places",processPlaces)
 
app.listen(port, () => {
  console.log(`🚀 Backend server listening on http://localhost:${port}`);
});