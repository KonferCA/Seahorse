import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onSend: (text: string) => void;
}

const VoiceModal = ({ isOpen, onClose, onSave, onSend }: VoiceModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          setTranscript(transcript);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setTranscript('');
    }
    setIsListening(!isListening);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Voice Input</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="sr-only">close</span>
                ×
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] mb-4">
              {transcript || 'Start speaking...'}
            </div>

            <div className="flex gap-3">
              <button
                onClick={toggleListening}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-sky-500 hover:bg-sky-600 text-white'
                }`}
              >
                {isListening ? 'Stop Recording' : 'Start Recording'}
              </button>
              
              <button
                onClick={() => onSave(transcript)}
                disabled={!transcript}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
              >
                Save Note
              </button>
              
              <button
                onClick={() => onSend(transcript)}
                disabled={!transcript}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Send to Chat
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceModal;
