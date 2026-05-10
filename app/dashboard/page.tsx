"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  title: string;
  description: string;
}

interface UploadResult {
  resume: { id: string };
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordScore: number;
  semanticScore: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [creatingJob, setCreatingJob] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const timerId = setTimeout(() => {
        void fetchJobs();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [session, status, router]);

  const createJob = async () => {
    if (!jobTitle || !jobDesc) {
      alert("Please fill in both title and description");
      return;
    }
    
    setCreatingJob(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: jobTitle, description: jobDesc })
      });
      
      if (res.ok) {
        const newJob = await res.json();
        setJobs([newJob, ...jobs]);
        setJobTitle("");
        setJobDesc("");
        alert("Job created successfully!");
      } else {
        alert("Failed to create job");
      }
    } catch {
      alert("Error creating job");
    } finally {
      setCreatingJob(false);
    }
  };

  const uploadResume = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }
    
    if (!selectedJob) {
      alert("Please select a job description");
      return;
    }
    
    setUploading(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescriptionId", selectedJob);
    
    try {
      const res = await fetch("/api/upload", { 
        method: "POST", 
        body: formData 
      });

      const raw = await res.text();
      let data: UploadResult & { error?: string };
      try {
        data = raw ? (JSON.parse(raw) as UploadResult & { error?: string }) : ({} as UploadResult);
      } catch {
        alert(
          `Upload failed (${res.status}). The server did not return JSON — often a timeout or gateway error. First line: ${raw.slice(0, 120)}`
        );
        return;
      }
      
      if (res.ok) {
        setResult(data);
        
        // Ask to shortlist if score is high
        if (data.score >= 75) {
          const shortlist = confirm(`Score: ${data.score}/100\n\nWould you like to shortlist this candidate?`);
          if (shortlist) {
            await fetch("/api/shortlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                resumeId: data.resume.id, 
                jobId: selectedJob,
                notes: `ATS Score: ${data.score} - Auto-shortlisted`
              })
            });
            alert("Added to shortlist!");
          }
        }
      } else {
        alert(data.error || "Upload failed");
      }
    } catch {
      alert("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  const addToShortlist = async () => {
    if (!result) return;
    
    try {
      const res = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resumeId: result.resume.id, 
          jobId: selectedJob,
          notes: `ATS Score: ${result.score}`
        })
      });
      
      if (res.ok) {
        alert("Added to shortlist!");
      } else {
        alert("Failed to add to shortlist");
      }
    } catch {
      alert("Error adding to shortlist");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          HR ATS Dashboard
        </h1>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Job Description */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Job Description
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select existing job
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                  >
                    <option value="">Select a job...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Or create new job
                  </h3>
                  
                  <input
                    type="text"
                    placeholder="Job Title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 text-black placeholder:text-gray-500 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                  
                  <textarea
                    placeholder="Paste job description here..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 text-black placeholder:text-gray-500 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                  />
                  
                  <button
                    onClick={createJob}
                    disabled={creatingJob}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    {creatingJob ? "Creating..." : "Create Job"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Resume Upload */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Resume
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select resume file (PDF or DOCX)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                
                <button
                  onClick={uploadResume}
                  disabled={!file || !selectedJob || uploading}
                  className="w-full bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {uploading ? "Processing..." : "Upload & Calculate Score"}
                </button>
              </div>
            </div>
            
            {/* Results Section */}
            {result && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ATS Analysis Results
                </h3>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-blue-600 mb-2">
                      {result.score}/100
                    </div>
                    <div className="text-sm text-gray-500">
                      Overall ATS Score
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-semibold text-green-600">
                        {result.keywordScore}
                      </div>
                      <div className="text-xs text-gray-600">Keyword Match</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-2xl font-semibold text-purple-600">
                        {result.semanticScore}
                      </div>
                      <div className="text-xs text-gray-600">Semantic Match</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-green-600 mb-2">
                      ✅ Matched Keywords ({result.matchedKeywords?.length || 0})
                    </div>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                      {result.matchedKeywords?.join(", ") || "None"}
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-red-600 mb-2">
                      ❌ Missing Keywords ({result.missingKeywords?.length || 0})
                    </div>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                      {result.missingKeywords?.join(", ") || "None"}
                    </div>
                  </div>
                  
                  {result.score >= 75 && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                      🎉 Excellent match! This candidate is highly recommended.
                    </div>
                  )}
                  
                  {result.score >= 50 && result.score < 75 && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                      ⚠️ Good match, but could be improved.
                    </div>
                  )}
                  
                  {result.score < 50 && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      ❌ Low match score. Consider other candidates.
                    </div>
                  )}
                  
                  <button
                    onClick={addToShortlist}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Add to Shortlist
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Recent Jobs List */}
        {jobs.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your Job Descriptions
            </h3>
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100">
                  <div className="font-medium text-gray-900">{job.title}</div>
                  <div className="text-sm text-gray-600 truncate">{job.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}