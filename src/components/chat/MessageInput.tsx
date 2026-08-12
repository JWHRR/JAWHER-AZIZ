import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (content: string, file?: File | null) => Promise<void>;
  onTyping?: () => void;
  draftMessage?: string;
}

const MAX_SIZE_MB = 5;

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onTyping, draftMessage }) => {
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!draftMessage) return;
    setContent(draftMessage);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        textareaRef.current.focus();
      }
    }, 50);
  }, [draftMessage]);

  const hasContent = content.trim().length > 0 || !!file;

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) return;
    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const clearFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!hasContent) return;
    setIsSending(true);
    try {
      await onSendMessage(content.trim(), file);
      setContent('');
      clearFile();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping?.();
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="px-3 py-2.5">
      {/* Image preview */}
      {previewUrl && (
        <div className="mb-2 ml-10">
          <div className="relative inline-flex rounded-2xl overflow-hidden border border-gray-200">
            <img src={previewUrl} alt="Preview" className="h-20 w-auto max-w-[180px] object-cover" />
            <button
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              onClick={clearFile}
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0 text-blue-500 transition-colors"
          title="Joindre une image"
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
        />

        {/* Text input */}
        <div className="flex-1 flex items-end bg-gray-100 rounded-[22px] px-4 py-2 gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message…"
            className="flex-1 resize-none bg-transparent border-0 outline-none text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 min-h-[22px] max-h-[120px] self-center"
            rows={1}
          />
          <button
            className="shrink-0 text-blue-400 hover:text-blue-500 transition-colors self-end mb-0.5"
            title="Emoji (bientôt)"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!hasContent || isSending}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 active:scale-90',
            hasContent
              ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-default'
          )}
        >
          {isSending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4 ml-0.5" />
          }
        </button>
      </div>
    </div>
  );
};
