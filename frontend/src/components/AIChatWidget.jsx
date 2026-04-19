import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { chatWithCodebase } from '../services/api';

export default function AIChatWidget({ repoId, onFileClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am heavily acquainted with this architecture. What feature are you trying to locate?' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputVal.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputVal };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInputVal('');
    setIsLoading(true);

    try {
      const reply = await chatWithCodebase(repoId, newHistory.filter(m => m.role !== 'system'));
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-full p-4 shadow-2xl transition-transform hover:scale-110 flex items-center justify-center border-2 border-white/10"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[380px] h-[500px] bg-[#0f172a] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="h-14 bg-blue-600/20 border-b border-blue-500/20 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Bot className="w-5 h-5 text-blue-400" />
              Codebase Assistant
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#020617]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm flex gap-3 overflow-hidden ${msg.role === 'user' ? 'bg-blue-600/80 text-white rounded-br-sm' : 'bg-slate-800 border border-white/5 text-slate-200 rounded-bl-sm'}`}>
                   {msg.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />}
                   <div className="whitespace-pre-wrap break-words leading-relaxed overflow-hidden">
                     {msg.content.split('\`').map((part, i) => i % 2 === 1 ? (
                       <code 
                         key={i} 
                         onClick={() => onFileClick && onFileClick(part)}
                         className="bg-black/50 text-emerald-400 px-1 py-0.5 rounded text-xs break-all cursor-pointer hover:bg-emerald-500/20 transition-colors inline-block my-0.5"
                       >
                         {part}
                       </code>
                     ) : part)}
                   </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-3">
                   <Bot className="w-4 h-4 text-blue-400 shrink-0" />
                   <div className="flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                   </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[#0f172a] border-t border-white/5 shrink-0 flex items-center gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="E.g. Where is the login feature implemented?"
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputVal.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl p-2.5 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
