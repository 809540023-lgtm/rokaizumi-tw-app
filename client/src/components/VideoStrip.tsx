interface VideoItem {
  id?: number | string;
  title?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
}

interface VideoStripProps {
  videos?: VideoItem[];
}

export function VideoStrip({ videos = [] }: VideoStripProps) {
  if (!videos || videos.length === 0) return null;
  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-6">採購實況影片</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {videos.map((v, i) => (
          <a
            key={v.id ?? i}
            href={v.videoUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 w-64 rounded-xl overflow-hidden bg-white shadow-sm"
          >
            {v.thumbnailUrl ? (
              <img src={v.thumbnailUrl} alt={v.title || ""} className="w-full h-36 object-cover" />
            ) : (
              <div className="w-full h-36 bg-gray-200" />
            )}
            <div className="p-3 text-sm font-medium truncate">{v.title || "影片"}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

export default VideoStrip;
