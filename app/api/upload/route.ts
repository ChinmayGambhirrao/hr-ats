import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { parseResumeBuffer } from "@/lib/parseResume";
import { calculateATSScore } from "@/lib/scoring";

export const runtime = "nodejs";

/** Allow semantic scoring + large PDFs on Vercel Pro; Hobby still caps at ~10s. */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const formData = await req.formData();
    const file = formData.get("resume") as File;
    const jobDescriptionId = formData.get("jobDescriptionId") as string;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    if (!jobDescriptionId) {
      return NextResponse.json({ error: "Job description required" }, { status: 400 });
    }
    
    // Get job description
    const jobDesc = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId }
    });
    
    if (!jobDesc) {
      return NextResponse.json({ error: "Job description not found" }, { status: 404 });
    }
    
    // Parse resume
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extractedText = await parseResumeBuffer(buffer, file.name);
    
    // Calculate score
    const { score, matchedKeywords, missingKeywords, keywordScore, semanticScore } = 
      await calculateATSScore(extractedText, jobDesc.description);
    
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "Server storage is not configured. Set BLOB_READ_WRITE_TOKEN on Vercel." },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, buffer, {
      access: 'private',
      token: blobToken
    });
    
    // Save to database
    const resume = await prisma.resume.create({
      data: {
        fileName: file.name,
        fileUrl: blob.url,
        extractedText,
        userId: session.user.id,
        scores: {
          create: {
            jobDescriptionId,
            score,
            matchedKeywords,
            missingKeywords
          }
        }
      },
      include: {
        scores: true
      }
    });
    
    return NextResponse.json({ 
      resume, 
      score, 
      matchedKeywords, 
      missingKeywords,
      keywordScore,
      semanticScore
    });
    
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}