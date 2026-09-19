import { BookListSkeleton, StatSkeleton } from "@/components/States";

export default function Loading() {
  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body">
        <div className="skeleton h-9 w-64" />
        <div className="skeleton mt-3 h-5 w-96 max-w-full" />
        <div className="mt-8">
          <StatSkeleton />
        </div>
        <div className="mt-8">
          <BookListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
