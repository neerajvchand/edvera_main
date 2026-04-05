/**
 * Shared spinner for lazy route chunks and permission gates.
 */
import { EdveraLoader } from "./EdveraLoader";

export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <EdveraLoader variant="thinking" size={40} />
    </div>
  );
}
