import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { parseResumeBuffer } from "@/lib/parseResume";
import { calculateATSScore } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session || !userId) {
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
    
    // Upload to Vercel Blob when token is configured.
    // In local/dev setups without a valid token, continue scoring and persist with a local placeholder URL.
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    let fileUrl = `local://resume/${Date.now()}-${encodeURIComponent(file.name)}`;

    if (blobToken && blobToken !== "youll-get-this-from-vercel-later") {
      try {
        const blob = await put(file.name, buffer, {
          access: "private",
          token: blobToken,
        });
        fileUrl = blob.url;
      } catch (blobError) {
        console.warn("Blob upload failed, using local placeholder URL:", blobError);
      }
    }
    
    // Save to database
    const resume = await prisma.resume.create({
      data: {
        fileName: file.name,
        fileUrl,
        extractedText,
        userId,
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
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}