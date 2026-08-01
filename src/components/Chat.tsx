import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

type Message = { id: string; from: 'me' | 'them'; text: string; time: string }

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const REPLIES = [
  "Thanks for reaching out! I'll take a look and get back to you shortly.",
  'Got it — let me check that on my end.',
  'Happy to help. Could you share a bit more detail?',
  'Good question! I’ll follow up with the specifics soon.',
]

function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export default function Chat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm0',
      from: 'them',
      text: "Hi! I'm Sarah, your account manager. How can I help you today?",
      time: clock(),
    },
  ])
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, open])

  function send(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { id: `me-${Date.now()}`, from: 'me', text, time: clock() }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [
        ...m,
        { id: `them-${Date.now()}`, from: 'them', text: REPLIES[Math.floor(Math.random() * REPLIES.length)], time: clock() },
      ])
    }, 1400)
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-fuchsia text-white shadow-lg shadow-brand-fuchsia/30 transition-transform hover:scale-105"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[28rem] max-h-[calc(100dvh-7rem)] w-80 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96">
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia px-4 py-3 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-semibold">
              SK
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Sarah Klein</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Account manager · Online
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-white/80 transition-colors hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.from === 'me'
                      ? 'rounded-br-sm bg-brand-fuchsia text-white'
                      : 'rounded-bl-sm bg-white text-slate-700 shadow-sm'
                  }`}
                >
                  <p className="leading-snug">{m.text}</p>
                  <span className={`mt-1 block text-[10px] ${m.from === 'me' ? 'text-white/70' : 'text-slate-400'}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-fuchsia text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
