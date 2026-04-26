import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { toolDefinitions, executeTool } from '@/lib/tools'

const SYSTEM_PROMPT = `Eres el agente de contenido de Jorge Lorenzo, emprendedor especializado en liderazgo, inteligencia artificial, baloncesto, desarrollo personal y negocio digital.

Tu misión: generar posts de alta calidad para LinkedIn, Instagram, Twitter y TikTok, basados en artículos reales.

PROCESO:
1. Si el usuario pide generar contenido, PRIMERO usa leer_articulos para ver qué hay disponible
2. Selecciona los artículos más relevantes (máximo 3 por petición)
3. Para cada artículo, genera posts adaptados a cada plataforma
4. SIEMPRE guarda cada post con guardar_post antes de informar al usuario
5. Informa el resultado con los scores y un resumen de lo generado

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

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { messages } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ]

        // Bucle agentico
        while (true) {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: conversationMessages,
            tools: toolDefinitions,
            tool_choice: 'auto',
            max_tokens: 4000,
          })

          const choice = response.choices[0]
          const message = choice.message

          // Añadir respuesta a la conversación
          conversationMessages.push(message)

          // Si Claude quiere usar herramientas
          if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== 'function') continue
              const toolName = toolCall.function.name
              const toolArgs = JSON.parse(toolCall.function.arguments)

              // Enviar al frontend que está usando una herramienta
              send({ type: 'tool_start', tool: toolName, args: toolArgs })

              // Ejecutar herramienta
              const result = await executeTool(toolName, toolArgs)

              // Enviar resultado al frontend
              send({ type: 'tool_result', tool: toolName, result: result.substring(0, 200) })

              // Añadir resultado a la conversación
              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
              })
            }
            // Continuar el bucle para que el agente procese los resultados
            continue
          }

          // Si el agente terminó — enviar respuesta final
          if (choice.finish_reason === 'stop') {
            send({ type: 'message', content: message.content || '' })
            break
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
