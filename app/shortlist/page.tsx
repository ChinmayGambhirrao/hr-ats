"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ShortlistItem {
  id: string;
  notes: string;
  createdAt: string;
  resume: {
    fileName: string;
    scores: Array<{ score: number }>;
  };
}

export default function ShortlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShortlist = async () => {
    try {
      const res = await fetch("/api/shortlist");
      const data = await res.json();
      setShortlist(data);
    } catch (error) {
      console.error("Failed to fetch shortlist:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const timerId = setTimeout(() => {
        void fetchShortlist();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Shortlisted Candidates
        </h1>
        
        {shortlist.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No candidates shortlisted yet</p>
            <p className="text-gray-400 mt-2">
              Upload resumes and add high-scoring candidates to your shortlist
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {shortlist.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.resume.fileName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Added on {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    {item.notes && (
                      <p className="text-sm text-gray-700 mt-2">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {item.resume.scores[0]?.score || "N/A"}/100
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}