import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const { resumeId, jobId, notes } = await req.json();
    
    const shortlist = await prisma.shortlist.create({
      data: {
        userId: session.user.id,
        resumeId,
        jobId,
        notes
      },
      include: {
        resume: true
      }
    });
    
    return NextResponse.json(shortlist);
  } catch (error) {
    return NextResponse.json({ error: "Failed to add to shortlist" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const shortlist = await prisma.shortlist.findMany({
      where: { userId: session.user.id },
      include: {
        resume: {
          include: {
            scores: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(shortlist);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch shortlist" }, { status: 500 });
  }
}