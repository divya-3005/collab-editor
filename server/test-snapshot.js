import express from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import documentsRouter from './src/routes/documents.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/documents', documentsRouter);

const prisma = new PrismaClient();

async function run() {
  // Test if it works
  console.log('Testing snapshot route...');
}
run();
