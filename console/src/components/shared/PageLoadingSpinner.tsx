/**
 * Shared spinner for lazy route chunks and permission gates.
 */
export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
    </div>
  );
}
