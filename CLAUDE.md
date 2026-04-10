# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Idioma de Comunicación

Toda la comunicación con el usuario debe ser en **español**. Esto incluye respuestas,
explicaciones, preguntas de clarificación y mensajes de commit (salvo que se indique lo contrario).

---

## Business Context: Newe Cloud

**Newe Cloud** (pronounced *"ni-ui"*) is a Salesforce + AI consultancy based in Spain,
serving SMBs (PYMEs) in Spain and Latin America. The name is an acronym for **"We Cloud"**.

- **Web:** https://newecloud.io
- **Market:** Spanish-speaking SMBs
- **Core expertise:** Salesforce architecture, implementation, and AI integration
- **Key differentiator:** Single senior point of contact per client (no rotating junior consultants)

### Service Models

1. **Admin as a Service** — Monthly hour packages for ongoing Salesforce maintenance and support
2. **On-Demand Consulting** — Per-hour/day engagement for specific tasks (Apex/LWC dev, integrations, audits)
3. **Hour Banks / Retainers** — Flexible blocks (3/6/12 months) consumed at the client's pace

### Typical Tech Stack

- **Platform:** Salesforce (Sales Cloud, Service Cloud, etc.)
- **Languages:** Apex, LWC, SOQL, SOSL
- **Integrations:** REST/SOAP APIs, Salesforce Connect, MuleSoft
- **AI:** Agentforce, Einstein AI, LLM integrations
- **CI/CD:** Salesforce DX (SFDX), GitHub Actions, Copado or Gearset (per project)

---

## Development Principles

1. **Salesforce best practices:** Governor limits, bulkification, layer separation, test coverage >= 85%
2. **Language convention:** Comments in Spanish for internal/client code; English for reusable libraries/components
3. **Pragmatic for SMBs:** No over-engineering — solutions must be maintainable by small teams
4. **Security:** CRUD/FLS enforced, Named Credentials for external integrations, no hardcoded secrets
5. **Team-ready:** Design for team rotation and client growth

---

## Build & Development Commands

### Website (Astro 5)

```bash
cd website

# Instalar dependencias
npm install

# Servidor de desarrollo
npx astro dev --port 4321

# Build de producción
npx astro build

# Preview del build
npx astro preview
```

**Variables de entorno requeridas** (`website/.env`):
- `ANTHROPIC_API_KEY` — API key de Anthropic para el consultor IA
- `UPSTASH_REDIS_REST_URL` — URL de Upstash Redis para rate limiting
- `UPSTASH_REDIS_REST_TOKEN` — Token de Upstash Redis

### Salesforce DX (futuro)

```bash
sf org login web --alias myorg
sf project deploy start --target-org myorg
sf apex run test --target-org myorg --wait 10
sf project retrieve start --target-org myorg
```

---

## Architecture

### Website (`website/`)

- **Framework:** Astro 5 + Tailwind CSS 4 + MDX
- **Adapter:** Vercel (serverless para API endpoints)
- **Hosting:** Pendiente deploy (Vercel o Hostinger FTP)

```
website/
├── src/
│   ├── components/
│   │   ├── layout/        # BaseHead, Header, Footer
│   │   ├── sections/      # Hero, Pilares, Servicios, CasosDeUso, etc.
│   │   └── ui/            # ConsultorIA, WhatsAppButton, ScrollAnimations
│   ├── content/
│   │   └── blog/          # Artículos MDX (Content Collections con glob loader)
│   ├── layouts/           # BaseLayout.astro
│   ├── pages/
│   │   ├── api/           # consultor.ts (SSR, prerender=false)
│   │   ├── blog/          # Listado y páginas dinámicas
│   │   └── index.astro    # Landing principal
│   └── styles/            # global.css (tema Tailwind, animaciones)
├── .env                   # Variables de entorno (no commitear)
└── astro.config.mjs       # Config: static + Vercel adapter + env schema
```

**Consultor IA** (`/api/consultor`):
- Endpoint SSR con `prerender = false`
- Claude API (claude-sonnet-4-20250514) con system prompt de consultor
- Rate limiting server-side: 1 consulta por email (30 días TTL) + 1 por IP/día (Upstash Redis)
- Variables de entorno declaradas en `astro.config.mjs` con `astro:env/server`

### Documentación (`docs/`)

- `PlanMarketing.md` — Plan de marketing y lista de prospectos
