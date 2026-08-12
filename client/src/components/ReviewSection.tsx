import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Star, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  title: string;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewSectionProps {
  productId: number;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  
  const { data: reviews = [], isLoading: reviewsLoading } = trpc.reviews.getByProductId.useQuery({ productId });
  const { data: avgRating = 0 } = trpc.reviews.getAverageRating.useQuery({ productId });
  
  const createReviewMutation = trpc.reviews.create.useMutation();
  const utils = trpc.useUtils();

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error(language === 'zh' ? '請輸入評論標題' : 'Please enter a review title');
      return;
    }

    createReviewMutation.mutate(
      {
        productId,
        rating,
        title,
        comment: comment || undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setComment('');
          setRating(5);
          utils.reviews.getByProductId.invalidate({ productId });
          utils.reviews.getAverageRating.invalidate({ productId });
          toast.success(language === 'zh' ? '評論已提交' : 'Review submitted successfully');
        },
        onError: () => {
          toast.error(language === 'zh' ? '提交評論失敗' : 'Failed to submit review');
        },
      }
    );
  };

  const renderStars = (value: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${
          i < value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">
        {language === 'zh' ? '用戶評價' : language === 'en' ? 'Customer Reviews' : 'カスタマーレビュー'}
      </h2>

      {/* Average Rating */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-1">
            {renderStars(Math.round(avgRating as number))}
          </div>
          <span className="text-2xl font-bold">
            {(avgRating as number).toFixed(1)}
          </span>
          <span className="text-gray-600">
            ({reviews.length} {language === 'zh' ? '評論' : language === 'en' ? 'reviews' : 'レビュー'})
          </span>
        </div>
      </div>

      {/* Add Review Form */}
      {user ? (
        <Card className="p-6 mb-8 bg-teal-50">
          <h3 className="text-lg font-semibold mb-4">
            {language === 'zh' ? '分享您的評價' : language === 'en' ? 'Share Your Review' : 'レビューを共有'}
          </h3>
          
          <form onSubmit={handleSubmitReview} className="space-y-4">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'zh' ? '評分' : language === 'en' ? 'Rating' : '評価'}
              </label>
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1)}
                    onMouseEnter={() => setHoverRating(i + 1)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        i < (hoverRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'zh' ? '評論標題' : language === 'en' ? 'Review Title' : 'レビュータイトル'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'zh' ? '簡要描述您的體驗' : 'Briefly describe your experience'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'zh' ? '詳細評論（可選）' : language === 'en' ? 'Detailed Review (Optional)' : '詳細レビュー（オプション）'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={language === 'zh' ? '分享您的詳細想法...' : 'Share your detailed thoughts...'}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <Button
              type="submit"
              disabled={createReviewMutation.isPending}
              className="w-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {language === 'zh' ? '提交評價' : language === 'en' ? 'Submit Review' : 'レビューを送信'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-6 mb-8 text-center bg-gray-50">
          <p className="text-gray-600 mb-4">
            {language === 'zh' ? '請登入以提交評價' : language === 'en' ? 'Please sign in to submit a review' : 'レビューを送信するにはサインインしてください'}
          </p>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviewsLoading ? (
          <p className="text-center text-gray-600">
            {language === 'zh' ? '加載評價中...' : 'Loading reviews...'}
          </p>
        ) : reviews.length === 0 ? (
          <p className="text-center text-gray-600">
            {language === 'zh' ? '暫無評價' : language === 'en' ? 'No reviews yet' : 'まだレビューがありません'}
          </p>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex gap-1 mb-2">
                    {renderStars(review.rating)}
                  </div>
                  <h4 className="font-semibold text-lg">{review.title}</h4>
                </div>
              </div>
              {review.comment && (
                <p className="text-gray-700 mb-2">{review.comment}</p>
              )}
              <p className="text-sm text-gray-500">
                {new Date(review.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
