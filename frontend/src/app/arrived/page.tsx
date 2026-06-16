// ────────────────────────────────────────────────────────────
//  app/arrived/page.tsx — 도착 및 피드백 페이지 
// ────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMobilityStore } from '../../store/useMobilityStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://blinking-item-process.ngrok-free.dev';

export default function ArrivedPage() {
  const router = useRouter();
  const { destination, resetNavigation, accessibilityMode } = useMobilityStore();
  
  const [rating, setRating] = useState(0);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 시각장애 전용 필터 플래그 판별
  const isVisuallyImpaired = accessibilityMode === 'visual';

  const issues = [
    { id: 'elv', label: '엘리베이터 고장', icon: '🛗' },
    { id: 'const', label: '공사로 통행 불가', icon: '🚧' },
    { id: 'slope', label: '경사 심한 구간', icon: '⛰️' },
    { id: 'bus', label: '저상버스 미운행', icon: '🚌' },
  ];

  // 시각장애인용 진입 시 안내 음성 재생
  useEffect(() => {
    if (isVisuallyImpaired && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const text = `목적지인 ${destination.name || '도착지'}에 도착했습니다. 오늘 경로 안내는 어떠셨나요? 좋았어요 또는 불편했어요 버튼을 선택해 주세요.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isVisuallyImpaired, destination.name]);

  const toggleIssue = (label: string) => {
    setSelectedIssues(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  // 음성으로 피드백 받기 기능 (SpeechRecognition 브라우저 API 활용 스텁)
  const handleVoiceFeedback = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // 브라우저 음성인식 지원 여부 확인
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // 가이드 음성 후 시작
    const infoUtterance = new SpeechSynthesisUtterance("신호음 소리가 나면 불편하셨던 점을 말씀해 주세요.");
    infoUtterance.lang = 'ko-KR';
    infoUtterance.onend = () => {
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    };
    window.speechSynthesis.speak(infoUtterance);

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setComment(speechToText);
      
      // 입력 완료 안내
      const confirmText = new SpeechSynthesisUtterance(`다음과 같이 입력되었습니다. ${speechToText}`);
      confirmText.lang = 'ko-KR';
      window.speechSynthesis.speak(confirmText);
    };

    recognition.onerror = () => {
      const errorText = new SpeechSynthesisUtterance("음성이 정상적으로 인식되지 않았습니다. 다시 시도해 주세요.");
      errorText.lang = 'ko-KR';
      window.speechSynthesis.speak(errorText);
    };
  }, []);

  const handleSubmitAndGoHome = async (customRating?: number, customIssues?: string[], customComment?: string) => {
    setIsSubmitting(true);

    // 인자값이 들어오면 해당 값을 우선하고 없으면 state 값 활용
    const finalRating = customRating !== undefined ? customRating : rating;
    const finalIssues = customIssues !== undefined ? customIssues : selectedIssues;
    const finalComment = customComment !== undefined ? customComment : comment;

    const feedbackPayload = {
      destinationName: destination.name || '알 수 없는 목적지',
      rating: finalRating,
      inconveniences : finalIssues,
      additionalComment : finalComment
    };

    try {
      console.log("전송할 피드백 데이터:", feedbackPayload);
      
      await fetch(`${API_BASE}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify(feedbackPayload)
      });
      
    } catch (error) {
      console.error("피드백 전송 실패:", error);
    } finally {
      setIsSubmitting(false);
      resetNavigation();
      router.push('/');
    }
  };

  if (isVisuallyImpaired) {
    return (
      <div className="flex flex-col h-[100dvh] w-full bg-[#0f172a] text-white p-6 justify-between overflow-y-auto">
        
        <header className="pt-8 mb-4" tabIndex={0}>
          <h1 className="text-3xl font-black text-yellow-400 mb-2">목적지에 도착했습니다</h1>
          <p className="text-xl text-slate-300 font-bold">{destination.name || '도착지'}</p>
        </header>

        <main className="flex-1 flex flex-col justify-center gap-5 my-4" role="main">
          <h2 className="text-2xl font-black text-white text-center mb-2" tabIndex={0}>오늘 경로는 어떠셨나요?</h2>
          
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => handleSubmitAndGoHome(5, [], "만족함")}
              disabled={isSubmitting}
              aria-label="안내가 정확했습니다. 좋았어요 버튼"
              className="w-full bg-yellow-400 text-slate-950 font-black text-2xl py-6 rounded-2xl active:scale-95 transition-all shadow-lg focus:ring-4 focus:ring-yellow-300"
            >
              👍 좋았어요 (바로 완료)
            </button>

            <button
              onClick={() => {
                setRating(2);
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                  const ut = new SpeechSynthesisUtterance("불편하셨군요. 마이크 버튼을 눌러 음성으로 알려주시거나 하단의 완료 버튼을 눌러주세요.");
                  ut.lang = 'ko-KR';
                  window.speechSynthesis.speak(ut);
                }
              }}
              aria-label="경로에 문제가 있었습니다. 불편했어요 버튼"
              className={`w-full font-black text-2xl py-6 rounded-2xl active:scale-95 transition-all shadow-lg focus:ring-4 focus:ring-yellow-400 border-4 ${
                rating === 2 ? 'bg-slate-800 border-yellow-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              👎 불편했어요
            </button>
          </div>

          <div className="mt-6 p-4 bg-slate-900/60 rounded-3xl border border-slate-800 flex flex-col items-center">
            <button
              onClick={handleVoiceFeedback}
              aria-label="불편했던 점 음성으로 기록하기 마이크 버튼"
              className="w-28 h-28 rounded-full bg-slate-800 border-4 border-yellow-400 flex items-center justify-center text-4xl hover:bg-slate-700 active:scale-90 transition-all focus:ring-4 focus:ring-yellow-400"
            >
              🎤
            </button>
            <p className="mt-3 text-lg font-bold text-slate-300 text-center">
              {comment ? `입력됨: "${comment}"` : "마이크를 눌러 불편한 점 말하기"}
            </p>
          </div>
        </main>

        <footer className="pb-safe pt-4">
          <button
            onClick={() => handleSubmitAndGoHome()}
            disabled={isSubmitting}
            className="w-full bg-yellow-400 text-slate-950 font-black text-xl py-5 rounded-2xl shadow-lg active:scale-95 transition-all focus:ring-4 focus:ring-yellow-300 flex items-center justify-center gap-2"
          >
            {isSubmitting ? "전송 중..." : "피드백 제출하고 홈으로"}
          </button>
        </footer>

      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-[#1f2937] overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full pt-16 flex flex-col items-center z-0">
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-5 shadow-inner">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-[#1f2937] text-3xl font-black">
            ✓
          </div>
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">목적지에 도착했습니다!</h1>
        <p className="text-gray-300 font-medium text-[15px]">{destination.name || '도착지'}</p>
      </div>

      <div className="absolute inset-0 z-10 overflow-y-auto scrollbar-hide">
        
        <div className="w-full h-[290px] flex-shrink-0" />

        <div className="bg-white rounded-t-[40px] min-h-[calc(100dvh-290px)] px-6 pt-10 pb-6 flex flex-col justify-between shadow-[0_-15px_30px_rgba(0,0,0,0.25)] relative">
          
          <div className="w-full max-w-md mx-auto space-y-9">
            
            <div className="text-center">
              <h2 className="text-[17px] font-extrabold text-gray-900 mb-2">경로 접근성은 어떠셨나요?</h2>
              <p className="text-[13px] text-gray-400 font-medium mb-5">평가가 다른 교통약자분들께 큰 도움이 됩니다</p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => setRating(star)}
                    className={`text-[42px] transition-all transform active:scale-90 ${
                      star <= rating ? 'grayscale-0 scale-110 drop-shadow-md' : 'grayscale opacity-30'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            <div>
              <h2 className="text-[16px] font-extrabold text-gray-900 mb-4">불편한 구간이 있었나요?</h2>
              <div className="grid grid-cols-2 gap-3">
                {issues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => toggleIssue(issue.label)}
                    className={`flex items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-left ${
                      selectedIssues.includes(issue.label)
                        ? 'border-orange-500 bg-orange-50 shadow-sm'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-xl drop-shadow-sm">{issue.icon}</span>
                    <span className={`text-[13px] font-bold ${
                      selectedIssues.includes(issue.label) ? 'text-orange-700' : 'text-gray-600'
                    }`}>
                      {issue.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-[16px] font-extrabold text-gray-900 mb-3">추가 의견 (선택)</h2>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="자유롭게 의견을 남겨주세요..."
                className="w-full h-28 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white resize-none font-medium placeholder-gray-400 transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 pb-safe">
            <button
              onClick={() => handleSubmitAndGoHome()}
              disabled={isSubmitting}
              className="w-full bg-white border-2 border-gray-200 text-gray-800 hover:bg-gray-50 rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-[16px] active:scale-95 transition-transform disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="animate-pulse">데이터 전송 중...</span>
              ) : (
                <>
                  <span>🏠</span>
                  홈으로 이동
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}