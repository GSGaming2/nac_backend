import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    // This will dynamically query either your Admin or User table based on your schema
    const adminCount = await prisma.admin.count();
    
    return NextResponse.json({
      status: "online",
      databaseMode: process.env.DB_MODE,
      adminsRegistered: adminCount,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}