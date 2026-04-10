export const prerender = false;

import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';
import type { APIRoute } from 'astro';
import { ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from 'astro:env/server';

// --- Configuración de límites ---
const MAX_MESSAGES_PER_EMAIL = 1;    // 1 consulta por email (de por vida)
const MAX_REQUESTS_PER_IP_DAY = 1;   // 1 consulta por IP por día (evita abuso con múltiples emails)
const IP_TTL_SECONDS = 86400;        // 24 horas
const EMAIL_TTL_SECONDS = 2592000;   // 30 días

// --- System prompt ---
const SYSTEM_PROMPT = `Eres el consultor IA de Newe Cloud, una consultora especializada en Salesforce e Inteligencia Artificial para PYMEs en España y Latinoamérica.

## Tu rol
Eres el primer punto de contacto con un prospect que está explorando cómo IA + Salesforce puede ayudar a su negocio. Tu objetivo es demostrar valor inmediato: que el prospect sienta que ya está recibiendo consultoría de primer nivel solo con esta conversación.

## Cómo respondes
1. **Escucha primero, diagnostica después.** Entiende el dolor real del prospect antes de proponer soluciones.
2. **Sé específico, no genérico.** No digas "la IA puede mejorar tus procesos". Di exactamente QUÉ proceso, CÓMO lo mejoraría, y QUÉ resultado esperar.
3. **Piensa en victorias tempranas.** Siempre propón algo que se pueda implementar en 2-4 semanas y que demuestre valor rápido. El prospect necesita ver ROI antes de comprometerse a un proyecto grande.
4. **Habla de resultados de negocio, no de tecnología.** Al prospect no le importa si usamos Einstein, Agentforce o un LLM. Le importa vender más, gastar menos, o retener clientes.
5. **Sé honesto.** Si algo no se puede hacer con Salesforce + IA, dilo. La confianza es más valiosa que una venta.

## Estructura de tu respuesta
Cuando el prospect describe su dolor o caso de uso:
1. **Valida su dolor** — muestra que entiendes el problema (1-2 frases)
2. **Victoria temprana** — propón UNA cosa concreta que se pueda implementar rápido (2-4 semanas) y que demuestre valor inmediato
3. **Visión completa** — describe brevemente cómo escalaríamos la solución a medio plazo (2-3 frases)
4. **Impacto estimado** — da una métrica concreta de lo que puede esperar
5. **Siguiente paso** — invita a una llamada de 20 minutos para profundizar, sin presión

## Tu tono
- Profesional pero cercano. Como un experto que te explica las cosas con claridad en un café.
- Confiado pero no arrogante. Datos y experiencia, no adjetivos vacíos.
- En español natural, sin jerga técnica innecesaria.
- Conciso. Máximo 250 palabras por respuesta.

## Contexto de Newe Cloud
- 150+ proyectos, 15+ años de experiencia, 100+ certificaciones Salesforce
- Equipo senior: un único punto de contacto por cliente
- Especialistas en: Sales Cloud, Service Cloud, Apex, LWC, integraciones REST/SOAP, Einstein AI, Agentforce, LLMs
- Mercado: PYMEs en España y Latinoamérica

## Importante
- NO inventes datos o estadísticas falsas sobre Newe Cloud
- NO prometas plazos exactos sin conocer el proyecto
- SÍ puedes dar rangos estimados basados en experiencia general
- Responde SIEMPRE en español
- Si el prospect pregunta algo fuera del ámbito Salesforce/IA, redirige amablemente`;

// --- Helpers ---

function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRedis(): Redis | null {
  const url = UPSTASH_REDIS_REST_URL;
  const token = UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// --- Endpoint ---

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { message, email, history = [] } = body;

    // Validar inputs
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Mensaje requerido.' }), { status: 400, headers });
    }
    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email válido requerido.' }), { status: 400, headers });
    }

    // Validar API key
    const apiKey = ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Servicio no disponible.' }), { status: 500, headers });
    }

    // --- Rate limiting server-side ---
    const redis = getRedis();
    console.log('[consultor] Redis connected:', !!redis, '| UPSTASH_URL exists:', !!UPSTASH_REDIS_REST_URL);

    if (redis) {
      const ip = getClientIP(request);
      const emailKey = `consultor:email:${email.toLowerCase().trim()}`;
      const ipKey = `consultor:ip:${ip}`;

      // 1. Verificar límite por email
      const emailCount = await redis.get<number>(emailKey);
      if (emailCount !== null && emailCount >= MAX_MESSAGES_PER_EMAIL) {
        return new Response(
          JSON.stringify({
            error: 'limit_reached',
            message: '¡Gracias por tu interés! Ya recibimos tu consulta anteriormente. Para profundizar en tu caso, te invitamos a una llamada gratuita de 20 minutos — sin compromiso.',
            remaining: 0,
          }),
          { status: 429, headers }
        );
      }

      // 2. Verificar límite por IP
      const ipCount = await redis.get<number>(ipKey);
      if (ipCount !== null && ipCount >= MAX_REQUESTS_PER_IP_DAY) {
        return new Response(
          JSON.stringify({
            error: 'rate_limited',
            message: '¡Gracias por tu interés! Ya hemos recibido una consulta desde tu conexión. Para darte una atención más personalizada, te invitamos a contactarnos directamente — estaremos encantados de ayudarte.',
            remaining: 0,
          }),
          { status: 429, headers }
        );
      }

      // Incrementar contadores
      const pipeline = redis.pipeline();
      if (emailCount === null) {
        pipeline.set(emailKey, 1, { ex: EMAIL_TTL_SECONDS });
      } else {
        pipeline.incr(emailKey);
      }
      if (ipCount === null) {
        pipeline.set(ipKey, 1, { ex: IP_TTL_SECONDS });
      } else {
        pipeline.incr(ipKey);
      }
      await pipeline.exec();

      // Calcular restantes para el cliente
      const currentEmailCount = (emailCount ?? 0) + 1;
      var remaining = MAX_MESSAGES_PER_EMAIL - currentEmailCount;
    } else {
      // Sin Redis: modo degradado (solo funciona, sin límites)
      var remaining = MAX_MESSAGES_PER_EMAIL;
    }

    // --- Llamada a Claude ---
    const client = new Anthropic({ apiKey });

    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return new Response(
      JSON.stringify({
        response: text,
        remaining: Math.max(0, remaining - 1),
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Error en consultor IA:', error);
    return new Response(
      JSON.stringify({ error: 'Error al procesar tu consulta. Inténtalo de nuevo.' }),
      { status: 500, headers }
    );
  }
};
