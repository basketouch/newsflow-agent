import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Tool definitions para Claude (Anthropic format) ────────────────────────

export const customToolDefinitions = [
  {
    name: 'leer_articulos',
    description: 'Lee los artículos disponibles en Supabase. Úsalo para obtener noticias recientes guardadas desde RSS o URLs manuales. Si el usuario pide algo que no está en Supabase, usa web_search en su lugar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limite: {
          type: 'number',
          description: 'Número de artículos a leer (máximo 20). Por defecto 10.',
        },
        source_type: {
          type: 'string',
          enum: ['gmail', 'rss', 'url', 'todos'],
          description: 'Tipo de fuente. "todos" para ver todas.',
        },
        solo_no_usados: {
          type: 'boolean',
          description: 'Si true, solo artículos que no están en el newsletter.',
        },
      },
      required: [],
    },
  },
  {
    name: 'guardar_post',
    description: 'Guarda el contenido generado en Supabase (tabla content_daily). Llama a esta función una vez por tema, con todos los posts de las plataformas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Tema del post en 5-7 palabras',
        },
        source_url: {
          type: 'string',
          description: 'URL del artículo o búsqueda web que usaste como fuente',
        },
        linkedin_post: { type: 'string', description: 'Post para LinkedIn (300-600 chars)' },
        linkedin_score: { type: 'number', description: 'Score calidad LinkedIn (1-10)' },
        instagram_post: { type: 'string', description: 'Post para Instagram (100-150 chars)' },
        instagram_image_prompt: { type: 'string', description: 'Descripción imagen ideal en inglés' },
        instagram_score: { type: 'number', description: 'Score calidad Instagram (1-10)' },
        twitter_post: { type: 'string', description: 'Tweet max 280 chars' },
        twitter_score: { type: 'number', description: 'Score calidad Twitter (1-10)' },
        tiktok_script: { type: 'string', description: 'Guion TikTok 60 segundos' },
        tiktok_score: { type: 'number', description: 'Score calidad TikTok (1-10)' },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array de hashtags sin #',
        },
      },
      required: ['topic', 'linkedin_post', 'linkedin_score'],
    },
  },
]

// ─── Ejecución de herramientas custom ───────────────────────────────────────

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'leer_articulos': {
      const limite = (args.limite as number) || 10
      const sourceType = (args.source_type as string) || 'todos'
      const soloNoUsados = args.solo_no_usados as boolean

      const supabase = getSupabase()
      let query = supabase
        .from('articles')
        .select('id, title, description, summary, url, source_type, source_name, category, created_at')
        .order('created_at', { ascending: false })
        .limit(limite)

      if (sourceType !== 'todos') {
        query = query.eq('source_type', sourceType)
      }
      if (soloNoUsados) {
        query = query.eq('selected_for_newsletter', false)
      }

      const { data, error } = await query

      if (error) return `Error leyendo artículos: ${error.message}`
      if (!data || data.length === 0) return 'No hay artículos disponibles.'

      const resumen = data.map((a, i) =>
        `[${i + 1}] ${a.title}\nFuente: ${a.source_name} (${a.source_type})\nResumen: ${a.summary || a.description || '(sin resumen)'}\nURL: ${a.url}\n`
      ).join('\n')

      return `Encontré ${data.length} artículos:\n\n${resumen}`
    }

    case 'guardar_post': {
      const today = new Date().toISOString().split('T')[0]

      const record = {
        date: today,
        topic: args.topic,
        source_url: args.source_url || null,
        linkedin_post: args.linkedin_post || null,
        linkedin_score: args.linkedin_score || null,
        instagram_post: args.instagram_post || null,
        instagram_image_prompt: args.instagram_image_prompt || null,
        instagram_score: args.instagram_score || null,
        twitter_post: args.twitter_post || null,
        twitter_score: args.twitter_score || null,
        tiktok_script: args.tiktok_script || null,
        tiktok_score: args.tiktok_score || null,
        hashtags: args.hashtags || [],
        status: 'pending_review',
        published_to: [],
      }

      const { data, error } = await getSupabase()
        .from('content_daily')
        .insert(record)
        .select('id')
        .single()

      if (error) return `Error guardando: ${error.message}`
      return `Post guardado correctamente. ID: ${data.id}. Topic: "${args.topic}". Aparecerá en la app iOS en la sección IA.`
    }

    default:
      return `Herramienta desconocida: ${name}`
  }
}
