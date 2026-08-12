import { Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useState } from 'react';

export default function TripVideos() {
  const { data: trips } = trpc.trips.list.useQuery();
  const { data: allVideos } = trpc.tripVideos.list.useQuery();
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // Group videos by trip
  const videosByTrip = trips?.map(trip => ({
    trip,
    videos: allVideos?.filter(v => v.tripId === trip.id) || []
  })).filter(group => group.videos.length > 0);

  const handleShare = async (video: any) => {
    const shareData = {
      title: video.title,
      text: video.description || '',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('連結已複製到剪貼簿！');
    }
  };

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="text-2xl font-bold text-[#ff6b35]">
                ろかいずみ合同会社
              </a>
            </Link>
            <nav className="flex gap-6">
              <Link href="/">
                <a className="text-gray-700 hover:text-[#ff6b35]">首頁</a>
              </Link>
              <Link href="/products">
                <a className="text-gray-700 hover:text-[#ff6b35]">產品</a>
              </Link>
              <Link href="/videos">
                <a className="text-[#ff6b35] font-semibold">影片</a>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎬 日本採購影片
          </h1>
          <p className="text-lg text-gray-600">
            即時直擊日本採購現場，第一手商品資訊
          </p>
        </div>

        {videosByTrip && videosByTrip.length > 0 ? (
          <div className="space-y-12">
            {videosByTrip.map(({ trip, videos }) => (
              <section key={trip.id} className="bg-white rounded-xl shadow-sm p-8">
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {trip.location}
                      </h2>
                      <div className="flex items-center gap-4 text-gray-600">
                        <span>📅 {trip.tripDate}</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            trip.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : trip.status === 'ongoing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {trip.status === 'completed'
                            ? '已完成'
                            : trip.status === 'ongoing'
                            ? '進行中'
                            : '預計'}
                        </span>
                      </div>
                      {trip.notes && (
                        <p className="text-gray-600 mt-2">{trip.notes}</p>
                      )}
                    </div>
                    <div className="text-gray-500 text-sm">
                      {videos.length} 個影片
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div
                        className="relative aspect-video bg-gray-200 cursor-pointer"
                        onClick={() => setSelectedVideoUrl(video.videoUrl)}
                      >
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center hover:bg-opacity-80 transition-all">
                            <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                          {new Date(video.uploadedAt).toLocaleDateString('zh-TW')}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg mb-2 text-gray-900">
                          {video.title}
                        </h3>
                        {video.description && (
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                            {video.description}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleShare(video)}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                          >
                            分享
                          </button>
                          <button
                            onClick={() => setSelectedVideoUrl(video.videoUrl)}
                            className="flex-1 bg-[#ff6b35] text-white px-4 py-2 rounded-lg hover:bg-[#ff5722] transition-colors text-sm font-semibold"
                          >
                            觀看
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              暫無影片
            </h3>
            <p className="text-gray-600">
              影片即將上傳，敬請期待
            </p>
          </div>
        )}
      </div>

      {/* Video Modal */}
      {selectedVideoUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideoUrl(null)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedVideoUrl(null)}
              className="absolute -top-12 right-0 text-white text-4xl hover:text-gray-300"
            >
              ×
            </button>
            <video
              src={selectedVideoUrl}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
