import { createPortal } from "react-dom";

export default function DemoDialog({
  open,
  onClose,
  videoId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  videoId: string;
  title: string;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[960px] rounded-2xl border border-white/10 bg-black shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg md:text-xl font-semibold text-teal-400">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
          >
            Close
          </button>
        </div>

        {/* 16:9 player */}
        <div className="relative w-full bg-black">
          <div className="relative pt-[56.25%]">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&color=white`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}