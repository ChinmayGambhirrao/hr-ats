import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { parseResumeBuffer } from "@/lib/parseResume";
import { calculateKeywordAtsScore } from "@/lib/keywordAtsScore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret =
      process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfiguration: NEXTAUTH_SECRET is not set." },
        { status: 500 }
      );
    }

    const token = await getToken({
      req,
      secret,
      secureCookie: process.env.VERCEL === "1" || process.env.NEXTAUTH_URL?.startsWith("https://"),
    });

    const userId =
      token && typeof token.id === "string"
        ? token.id
        : token?.sub ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume") as File | null;
    const jobDescriptionId = formData.get("jobDescriptionId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!jobDescriptionId) {
      return NextResponse.json(
        { error: "Job description required" },
        { status: 400 }
      );
    }

    const jobDesc = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId },
    });

    if (!jobDesc) {
      return NextResponse.json(
        { error: "Job description not found" },
        { status: 404 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extractedText = await parseResumeBuffer(buffer, file.name);

    const { score, matchedKeywords, missingKeywords, keywordScore, semanticScore } =
      calculateKeywordAtsScore(extractedText, jobDesc.description);

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        {
          error:
            "Server storage is not configured. Set BLOB_READ_WRITE_TOKEN on Vercel.",
        },
        { status: 500 }
      );
    }

    const blob = await put(file.name, buffer, {
      access: "private",
      token: blobToken,
    });

    const resume = await prisma.resume.create({
      data: {
        fileName: file.name,
        fileUrl: blob.url,
        extractedText,
        userId,
        scores: {
          create: {
            jobDescriptionId,
            score,
            matchedKeywords,
            missingKeywords,
          },
        },
      },
      include: {
        scores: true,
      },
    });

    const body = {
      resume: {
        id: resume.id,
        fileName: resume.fileName,
        fileUrl: resume.fileUrl,
        userId: resume.userId,
        createdAt: resume.createdAt.toISOString(),
        scores: resume.scores.map((s) => ({
          id: s.id,
          resumeId: s.resumeId,
          jobDescriptionId: s.jobDescriptionId,
          score: s.score,
          matchedKeywords: s.matchedKeywords,
          missingKeywords: s.missingKeywords,
          createdAt: s.createdAt.toISOString(),
        })),
      },
      score,
      matchedKeywords,
      missingKeywords,
      keywordScore,
      semanticScore,
    };

    return NextResponse.json(body);
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
