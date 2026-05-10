"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  if (!session) return null;
  
  const isActive = (path: string) => pathname === path;
  
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            <Link 
              href="/dashboard" 
              className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                isActive("/dashboard") 
                  ? "text-blue-600 border-b-2 border-blue-600" 
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              Dashboard
            </Link>
            <Link 
              href="/shortlist" 
              className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                isActive("/shortlist") 
                  ? "text-blue-600 border-b-2 border-blue-600" 
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              Shortlist
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{session.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}