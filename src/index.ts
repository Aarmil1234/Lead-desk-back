import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authenticate } from './middleware/auth.js';
import { asyncHandler } from './lib/http.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import leadRoutes from './routes/leads.js';
import importRoutes from './routes/imports.js';
import followupRoutes from './routes/followups.js';
import userRoutes from './routes/users.js';
import callLogRoutes from './routes/callLogs.js';
import telecallerRoutes from './routes/telecallers.js';
import transferRoutes from './routes/transfers.js';

const app=express();
const allowedOrigins=(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(',').map(s=>s.trim());
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = [
  "https://leads.mind2pixel.in",
  "https://lead-desk-front-nine.vercel.app",
  "http://localhost:5173"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({limit:'3mb'}));
app.use(morgan(process.env.NODE_ENV==='production'?'combined':'dev'));
app.get('/health',(_req,res)=>res.json({status:'ok',service:'leaddesk-api',timestamp:new Date().toISOString()}));
app.use('/api',authenticate);
app.use('/api/auth',authRoutes);
app.use('/api/dashboard',dashboardRoutes);
app.use('/api/leads',leadRoutes);
app.use('/api/imports',importRoutes);
app.use('/api/follow-ups',followupRoutes);
app.use('/api/users',userRoutes);
app.use('/api/notifications',asyncHandler(async(_req,res)=>res.json({items:[]})));
app.use('/api/telecallers', authenticate, telecallerRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/transfers', transferRoutes);
app.use((_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const message=err instanceof Error?err.message:'Unexpected server error';console.error(err);res.status(500).json({error:process.env.NODE_ENV==='production'?'Unexpected server error.':message});});
const port=Number(process.env.PORT)||4000;
app.listen(port,'0.0.0.0',()=>console.log(`LeadDesk API listening on ${port}`));
