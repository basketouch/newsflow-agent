'use client'

import { useState, useRef, useEffect } from 'react'

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

const QUICK_PROMPTS = [
  'Genera posts de los últimos 3 artículos disponibles',
  'Genera posts para LinkedIn e Instagram del artículo más reciente',
  'Muéstrame los artículos disponibles',
  'Genera posts de los artículos de hoy',
]

const TOOL_LABELS: Record<string, string> = {
  leer_articulos: '📰 Leyendo artículos...',
  guardar_post: '💾 Guardando post...',
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentToolSteps, setCurrentToolSteps] = useState<ToolStep[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolSteps])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setCurrentToolSteps([])

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
            }

            if (event.type === 'message') {
              const assistantMessage: Message = {
                role: 'assistant',
                content: event.content,
                toolSteps: steps.length > 0 ? [...steps] : undefined,
              }
              setMessages(prev => [...prev, assistantMessage])
              setCurrentToolSteps([])
            }

            if (event.type === 'error') {
              const errorMessage: Message = {
                role: 'assistant',
                content: `❌ Error: ${event.message}`,
              }
              setMessages(prev => [...prev, errorMessage])
              setCurrentToolSteps([])
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Error de conexión: ${err instanceof Error ? err.message : 'desconocido'}`,
      }
      setMessages(prev => [...prev, errorMessage])
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

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-sm font-bold">
            N
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">NewsFlow Agent</h1>
            <p className="text-xs text-zinc-500">Contenido para redes sociales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-500">GPT-4o-mini</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4 text-3xl">
                ✨
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-2">Agente de Contenido</h2>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Genera posts para LinkedIn, Instagram, Twitter y TikTok<br />
                basados en los artículos guardados en NewsFlow.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-zinc-700 hover:border-purple-500/50 hover:bg-zinc-800 text-sm text-zinc-400 hover:text-zinc-200 transition-all"
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
              <div className="space-y-3">
                {msg.toolSteps && msg.toolSteps.length > 0 && (
                  <div className="space-y-2">
                    {msg.toolSteps.map((step, j) => (
                      <div key={j} className="flex items-start gap-3 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                        <span className="text-sm text-zinc-400 mt-0.5">
                          {TOOL_LABELS[step.tool] ?? `🔧 ${step.tool}`}
                        </span>
                        {step.result && (
                          <span className="text-xs text-zinc-600 ml-auto mt-0.5 truncate max-w-[200px]">
                            ✓ {step.result}
                          </span>
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

        {/* Live tool steps while loading */}
        {isLoading && (
          <div className="max-w-2xl mx-auto space-y-2">
            {currentToolSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <span className="text-sm text-zinc-400">
                  {TOOL_LABELS[step.tool] ?? `🔧 ${step.tool}`}
                </span>
                {step.result ? (
                  <span className="text-xs text-zinc-600 ml-auto truncate max-w-[200px]">✓ {step.result}</span>
                ) : (
                  <span className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            ))}
            {currentToolSteps.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs text-zinc-600">Pensando...</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... (Enter para enviar)"
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
        <p className="text-center text-xs text-zinc-700 mt-2">
          Shift+Enter para nueva línea · Los posts se guardan automáticamente en NewsFlow
        </p>
      </div>
    </div>
  )
}
