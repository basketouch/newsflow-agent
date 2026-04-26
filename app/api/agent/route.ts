import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { customToolDefinitions, executeTool } from '@/lib/tools'

const SYSTEM_PROMPT = `Eres el agente de contenido de Jorge Lorenzo, emprendedor especializado en liderazgo, inteligencia artificial, baloncesto, desarrollo personal y negocio digital.

Tu misión: generar posts de alta calidad para LinkedIn, Instagram, Twitter y TikTok.

PROCESO:
1. Si el usuario pide contenido sobre algo concreto (noticia, tema, persona), usa web_search para buscar información actualizada
2. Si el usuario pide generar de los artículos guardados, usa leer_articulos
3. Selecciona los artículos/noticias más relevantes (máximo 3 por petición)
4. Para cada tema, genera posts adaptados a cada plataforma
5. SIEMPRE guarda cada post con guardar_post antes de informar al usuario
6. Informa el resultado con los scores y un resumen de lo generado

CUÁNDO USAR CADA HERRAMIENTA:
- web_search: cuando el usuario menciona algo específico ("los Lakers anoche", "Apple hoy", "última noticia de IA") o quiere contenido fresco
- leer_articulos: cuando el usuario dice "de mis artículos", "de NewsFlow", "de lo que tengo guardado"
- Si no está claro, pregunta o usa leer_articulos por defecto

ESTILO DE JORGE:
- Voz directa, clara, auténtica
- Conecta siempre con liderazgo y alto rendimiento
- Escribe desde la experiencia, no desde la teoría
- Sin frases vacías ni adornos
- Frases cortas con ritmo y fuerza

PLATAFORMAS:
- LinkedIn: 300-600 chars, reflexivo, bullets, hashtags al final
- Instagram: 100-150 chars, hook visual, emojis, hashtags
- Twitter: max 280 chars, provocador, directo
- TikTok: guion 60s — hook (0-3s) + desarrollo + CTA

Cuando termines de generar y guardar, muestra un resumen con:
- Cuántos posts generaste
- Los temas
- Los scores promedio`

// Herramienta de búsqueda web nativa de Anthropic
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
}

const TOOL_LABELS: Record<string, string> = {
  web_search: '🌐 Buscando en la web...',
  leer_articulos: '📰 Leyendo artículos...',
  guardar_post: '💾 Guardando post...',
}

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { messages } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Convertir historial de mensajes al formato de Anthropic
        const conversationMessages: Anthropic.MessageParam[] = messages.map(
          (m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })
        )

        // Bucle agéntico
        while (true) {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: conversationMessages,
            tools: [WEB_SEARCH_TOOL, ...customToolDefinitions],
          })

          // Añadir respuesta completa al historial (incluye tool_use y tool_result de web_search)
          conversationMessages.push({
            role: 'assistant',
            content: response.content,
          })

          // Notificar al frontend sobre herramientas usadas
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const label = TOOL_LABELS[block.name] ?? `🔧 ${block.name}`
              send({ type: 'tool_start', tool: block.name, label, args: block.input })
            }
            // web_search_tool_result viene embebido en el contenido (server-side)
            if (block.type === 'web_search_tool_result') {
              send({ type: 'tool_result', tool: 'web_search', result: 'Resultados obtenidos ✓' })
            }
          }

          // Si el agente terminó → enviar respuesta final
          if (response.stop_reason === 'end_turn') {
            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map(b => b.text)
              .join('')
            send({ type: 'message', content: text })
            break
          }

          // Si hay tool_use de herramientas custom → ejecutarlas
          if (response.stop_reason === 'tool_use') {
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const block of response.content) {
              if (block.type !== 'tool_use') continue

              // web_search es server-side, Anthropic lo maneja; solo procesamos las custom
              if (block.name === 'web_search') continue

              // Ejecutar herramienta custom
              const result = await executeTool(block.name, block.input as Record<string, unknown>)
              send({ type: 'tool_result', tool: block.name, result: result.substring(0, 200) })

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              })
            }

            // Añadir resultados de herramientas custom al historial
            if (toolResults.length > 0) {
              conversationMessages.push({
                role: 'user',
                content: toolResults,
              })
            }

            continue
          }

          break
        }

        send({ type: 'done' })
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Error desconocido' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
