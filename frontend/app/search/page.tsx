"use client";

import { Suspense } from "react";
import SearchResultsContent from "@/components/Search/SearchResultsContent";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-gray-100">Loading...</div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}
