import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { title, description } = await req.json();
    
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }
    
    const job = await prisma.jobDescription.create({
      data: {
        title,
        description,
        userId: session.user.id
      }
    });
    
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const jobs = await prisma.jobDescription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(jobs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}