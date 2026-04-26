'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '@/components/Nav'

// ─── Supabase client ────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────
interface ContentPost {
  id: string
  date: string
  topic: string
  source_url?: string
  linkedin_post?: string
  linkedin_score?: number
  instagram_post?: string
  instagram_score?: number
  twitter_post?: string
  twitter_score?: number
  tiktok_script?: string
  tiktok_score?: number
  hashtags: string[]
  status: string
  published_to: string[]
  created_at: string
}

interface ToolStep {
  tool: string
  args: Record<string, unknown>
  result?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolSteps?: ToolStep[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'Genera posts de los últimos 3 artículos',
  'Genera posts del artículo más reciente',
  'Muéstrame los artículos disponibles',
]

const TOOL_LABELS: Record<string, string> = {
  web_search: '🌐 Buscando en la web...',
  leer_articulos: '📰 Leyendo artículos...',
  guardar_post: '💾 Guardando post...',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_review:   { label: 'Pendiente',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  published_partial:{ label: 'Parcial',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  published_all:    { label: 'Publicado',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, label }: { score?: number; label: string }) {
  if (!score) return null
  const color = score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-6">{label}</span>
      <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-xs text-zinc-400 w-4">{score}</span>
    </div>
  )
}

// ─── Post detail modal ────────────────────────────────────────────────────────
function PostDetail({ post, onClose }: { post: ContentPost; onClose: () => void }) {
  const [tab, setTab] = useState<'linkedin' | 'instagram' | 'twitter' | 'tiktok'>('linkedin')
  const [copied, setCopied] = useState(false)

  const content = {
    linkedin: post.linkedin_post,
    instagram: post.instagram_post,
    twitter: post.twitter_post,
    tiktok: post.tiktok_script,
  }[tab]

  const copy = () => {
    if (content) {
      navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="font-semibold text-zinc-100 text-sm leading-snug">{post.topic}</h2>
            <p className="text-xs text-zinc-500 mt-1">{post.date}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 ml-4 flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Platform tabs */}
        <div className="flex border-b border-zinc-800">
          {(['linkedin', 'instagram', 'twitter', 'tiktok'] as const).map(p => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`flex-1 py-3 text-xs font-medium transition-colors capitalize ${
                tab === p
                  ? 'text-purple-400 border-b-2 border-purple-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p === 'linkedin' ? 'LinkedIn' : p === 'instagram' ? 'Instagram' : p === 'twitter' ? 'Twitter/X' : 'TikTok'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {content ? (
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <p className="text-sm text-zinc-600 italic">Sin contenido para esta plataforma</p>
          )}
        </div>

        {/* Scores */}
        <div className="px-5 py-4 border-t border-zinc-800 space-y-2">
          <ScoreBar score={post.linkedin_score}  label="LI" />
          <ScoreBar score={post.instagram_score} label="IG" />
          <ScoreBar score={post.twitter_score}   label="X" />
          <ScoreBar score={post.tiktok_score}    label="TK" />
        </div>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="px-5 pb-4 flex flex-wrap gap-1">
            {post.hashtags.map(h => (
              <span key={h} className="text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">
                #{h}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={copy}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar texto'}
          </button>
          {post.source_url && (
            <a
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-400 transition-colors"
            >
              Fuente ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  // Posts state
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentToolSteps, setCurrentToolSteps] = useState<ToolStep[]>([])

  // Nav
  const [activePanel, setActivePanel] = useState<'posts' | 'chat'>('chat')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Load posts ──
  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('content_daily')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPosts(data)
    setLoadingPosts(false)
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolSteps])

  // ── Stats ──
  const pending   = posts.filter(p => p.status === 'pending_review').length
  const published = posts.filter(p => p.status === 'published_all').length
  const today     = posts.filter(p => p.date === new Date().toISOString().split('T')[0]).length

  // ── Send message ──
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setCurrentToolSteps([])
    setActivePanel('chat')

    const steps: ToolStep[] = []

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'tool_start') {
              const step: ToolStep = { tool: event.tool, args: event.args }
              steps.push(step)
              setCurrentToolSteps([...steps])
            }

            if (event.type === 'tool_result') {
              const last = steps[steps.length - 1]
              if (last) {
                last.result = event.result
                setCurrentToolSteps([...steps])
              }
              // Reload posts after saving
              if (steps[steps.length - 1]?.tool === 'guardar_post') {
                loadPosts()
              }
            }

            if (event.type === 'message') {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: event.content,
                toolSteps: steps.length > 0 ? [...steps] : undefined,
              }])
              setCurrentToolSteps([])
              loadPosts()
            }

            if (event.type === 'error') {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Error: ${event.message}`,
              }])
              setCurrentToolSteps([])
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${err instanceof Error ? err.message : 'desconocido'}`,
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold">N</div>
          <div>
            <span className="text-sm font-semibold">NewsFlow</span>
            <span className="text-zinc-600 text-xs ml-2">· Jorge Lorenzo</span>
          </div>
        </div>
        <Nav />

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-zinc-100 leading-none">{posts.length}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Total</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400 leading-none">{pending}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Pendientes</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400 leading-none">{published}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Publicados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400 leading-none">{today}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Hoy</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-500">GPT-4o-mini</span>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Posts panel ── */}
        <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Posts generados</h2>
            <button
              onClick={loadPosts}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Actualizar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M13 1v4H9M1 13V9h4M2.5 5.5A5 5 0 0112 7M11.5 8.5A5 5 0 012 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingPosts ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <p className="text-xs text-zinc-600">Sin posts todavía.</p>
                <p className="text-xs text-zinc-700 mt-1">Usa el agente para generar.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {posts.map(post => {
                  const st = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.pending_review
                  const platforms = [
                    post.linkedin_post  && 'LI',
                    post.instagram_post && 'IG',
                    post.twitter_post   && 'X',
                    post.tiktok_script  && 'TK',
                  ].filter(Boolean)
                  const avgScore = [
                    post.linkedin_score,
                    post.instagram_score,
                    post.twitter_score,
                    post.tiktok_score,
                  ].filter(Boolean) as number[]
                  const avg = avgScore.length
                    ? Math.round(avgScore.reduce((a, b) => a + b, 0) / avgScore.length * 10) / 10
                    : null

                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="w-full text-left px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-zinc-200 font-medium leading-snug line-clamp-2 flex-1">
                          {post.topic}
                        </p>
                        {avg && (
                          <span className="text-xs font-bold text-purple-400 flex-shrink-0">{avg}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${st.color}`}>
                          {st.label}
                        </span>
                        <div className="flex gap-1">
                          {platforms.map(p => (
                            <span key={p} className="text-[10px] text-zinc-600 bg-zinc-800 px-1 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-zinc-700 ml-auto">{post.date}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Chat panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-6 max-w-lg mx-auto">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✨
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-100 mb-1">Agente de contenido</h2>
                  <p className="text-zinc-500 text-sm">
                    Genera posts para LinkedIn, Instagram, Twitter y TikTok basados en tus artículos de NewsFlow.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {QUICK_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-4 py-3 rounded-xl border border-zinc-700 hover:border-purple-500/50 hover:bg-zinc-800/50 text-sm text-zinc-400 hover:text-zinc-200 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`max-w-2xl mx-auto ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                {msg.role === 'user' ? (
                  <div className="bg-purple-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msg.toolSteps && msg.toolSteps.length > 0 && (
                      <div className="space-y-1.5">
                        {msg.toolSteps.map((step, j) => (
                          <div key={j} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs">
                            <span className="text-zinc-400">{TOOL_LABELS[step.tool] ?? `🔧 ${step.tool}`}</span>
                            {step.result && (
                              <span className="text-zinc-600 ml-auto truncate max-w-[180px]">✓ {step.result}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live tool steps */}
            {isLoading && (
              <div className="max-w-2xl mx-auto space-y-1.5">
                {currentToolSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs">
                    <span className="text-zinc-400">{TOOL_LABELS[step.tool] ?? `🔧 ${step.tool}`}</span>
                    {step.result
                      ? <span className="text-zinc-600 ml-auto truncate max-w-[180px]">✓ {step.result}</span>
                      : <span className="ml-auto flex gap-1">
                          {[0,1,2].map(d => (
                            <span key={d} className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"
                              style={{ animationDelay: `${d * 150}ms` }} />
                          ))}
                        </span>
                    }
                  </div>
                ))}
                {currentToolSteps.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto">
                    {[0,1,2].map(d => (
                      <span key={d} className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce"
                        style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                    <span className="text-xs text-zinc-600 ml-1">Pensando...</span>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0">
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
                  rows={1}
                  className="w-full resize-none bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2L5 8L2 14L14 8Z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Post detail modal ── */}
      {selectedPost && (
        <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  )
}
