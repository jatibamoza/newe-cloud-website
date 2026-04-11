export const prerender = false;

import type { APIRoute } from 'astro';
import { BREVO_API_KEY, BREVO_LIST_ID } from 'astro:env/server';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email válido requerido.' }),
        { status: 400, headers }
      );
    }

    const apiKey = BREVO_API_KEY;
    const listId = BREVO_LIST_ID;

    if (!apiKey || !listId) {
      console.warn('[suscripcion] Brevo no configurado — email recibido:', email);
      return new Response(
        JSON.stringify({ success: true, message: 'Suscripción registrada.' }),
        { status: 200, headers }
      );
    }

    // Crear/actualizar contacto en Brevo y añadirlo a la lista
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        listIds: [parseInt(listId, 10)],
        updateEnabled: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();

      // "Contact already exist" no es un error real
      if (errorData.code === 'duplicate_parameter') {
        return new Response(
          JSON.stringify({ success: true, message: 'Ya estás suscrito. ¡Gracias!' }),
          { status: 200, headers }
        );
      }

      console.error('[suscripcion] Error Brevo:', errorData);
      return new Response(
        JSON.stringify({ error: 'Error al procesar la suscripción.' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Suscripción exitosa. ¡Bienvenido!' }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('[suscripcion] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al procesar la suscripción.' }),
      { status: 500, headers }
    );
  }
};
