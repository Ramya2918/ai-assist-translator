import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, History, Trash2, Languages, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translateAudio, TranslationResult } from './services/gemini';

interface HistoryItem extends TranslationResult {
  id: string;
  timestamp: number;
}

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<TranslationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('translator_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('translator_history', JSON.stringify(history));
  }, [history]);

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioProcessing(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please enable permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleAudioProcessing = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const result = await translateAudio(base64Audio, 'audio/webm');
        
        setCurrentResult(result);
        const newHistoryItem: HistoryItem = {
          ...result,
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          timestamp: Date.now(),
        };
        setHistory(prev => [newHistoryItem, ...prev]);
        setIsProcessing(false);
      };
    } catch (err) {
      console.error("Processing error:", err);
      setError("Failed to process audio. Please try again.");
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('translator_history');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4"
          >
            <Languages className="w-8 h-8 text-indigo-600" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold tracking-tight text-slate-900 mb-2"
          >
            AI Assist Translator
          </motion.h1>
          <p className="text-slate-500 text-lg">Speak in any language, get English instantly.</p>
        </header>

        {/* Main Section */}
        <main className="space-y-8">
          {/* Recording Card */}
          <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 0.2 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                        className="absolute inset-0 bg-red-500 rounded-full"
                      />
                    )}
                  </AnimatePresence>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                    className={`relative z-20 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 scale-110' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isRecording ? (
                      <MicOff className="w-10 h-10 text-white" />
                    ) : (
                      <Mic className="w-10 h-10 text-white" />
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">
                    {isRecording ? 'Listening...' : isProcessing ? 'Translating...' : 'Ready to Translate'}
                  </h2>
                  <p className="text-slate-400 font-mono text-sm">
                    {isRecording ? formatTime(recordingTime) : 'Click the mic to start'}
                  </p>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 text-red-600 bg-red-50 px-4 py-2 rounded-full text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </div>

              {/* Translation Display */}
              <AnimatePresence mode="wait">
                {(currentResult || isProcessing) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-12 pt-12 border-t border-slate-100 grid md:grid-cols-2 gap-8 text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Original Text</span>
                        {currentResult && (
                          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                            {currentResult.detectedLanguage}
                          </span>
                        )}
                      </div>
                      <div className="min-h-[100px] p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 leading-relaxed">
                        {isProcessing ? (
                          <div className="flex items-center space-x-2 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing speech...</span>
                          </div>
                        ) : (
                          currentResult?.originalText
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">English Translation</span>
                      <div className="min-h-[100px] p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-slate-900 font-medium leading-relaxed">
                        {isProcessing ? (
                          <div className="flex items-center space-x-2 text-indigo-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating translation...</span>
                          </div>
                        ) : (
                          currentResult?.translatedText
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Subtle background decoration */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-slate-100 rounded-full blur-3xl opacity-50" />
          </section>

          {/* History Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900">
                <History className="w-5 h-5" />
                <h3 className="text-lg font-bold">Recent Translations</h3>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="flex items-center space-x-1 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            <div className="grid gap-4">
              <AnimatePresence initial={false}>
                {history.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400"
                  >
                    No history yet. Start speaking to see your translations here.
                  </motion.div>
                ) : (
                  history.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                              {item.detectedLanguage} → English
                            </p>
                            <p className="text-[10px] text-slate-300">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-slate-500 text-sm italic">"{item.originalText}"</p>
                        <p className="text-slate-900 font-medium">{item.translatedText}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        <footer className="mt-20 text-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} AI Assist Translator. Powered by Gemini AI.</p>
        </footer>
      </div>
    </div>
  );
}
