# LAUNCH_CHECKLIST · MorrowAge

## Producto y modelo
- [ ] 18/18 golden vectors pasan en TypeScript.
- [ ] `<40`/`>69` aplicado en preview, web report, PDF y emails.
- [ ] No aparece riesgo absoluto 10y ni percentiles nacionales.
- [ ] Reaction protocol versionado y documentado.
- [ ] Copy ES/EN/PT revisado en las rutas críticas.

## Infraestructura
- [ ] Dominio final configurado.
- [ ] Vercel production env creado; Netlify solo como alternativa documentada.
- [ ] Supabase production project, backups y RLS verificados.
- [ ] Drive service account y folder compartido.
- [ ] `npm run drive:sync` pasa; checksum y fallback probados.
- [ ] Sentry y PostHog reciben solo datos permitidos.
- [ ] Turnstile y rate limit activos.

## Email
- [ ] Dominio de envío verificado en Resend.
- [ ] SPF publicado.
- [ ] DKIM publicado y verificado.
- [ ] DMARC publicado con política apropiada para la fase.
- [ ] `EMAIL_FROM` usa el dominio verificado.
- [ ] `OWNER_EMAIL` es un buzón operacional con acceso mínimo.
- [ ] Flujo real user + owner + PDF probado de punta a punta.

## Legal y privacidad
- [ ] Privacy Policy publicada.
- [ ] Terms publicados.
- [ ] Consentimiento de servicio separado de marketing.
- [ ] Retención/borrado configurados.
- [ ] Canal de derechos del titular visible.
- [ ] Revisión legal por mercado antes de cobro/tráfico pagado de salud.
- [ ] Si se opera en Perú, revisar/realizar inscripción de banco de datos cuando aplique bajo Ley 29733 y D.S. 016-2024-JUS.
- [ ] No afirmar HIPAA compliance sin evaluación específica.

## Stripe
- [ ] `MONETIZATION_MODE=validation` en lanzamiento inicial.
- [ ] `STRIPE_ENABLED=false` en producción inicial.
- [ ] Sandbox checkout/webhook pasa.
- [ ] Firma e idempotencia pasan.
- [ ] Activación solo tras thresholds de tracción y gates legales/safety.

## Calidad
- [ ] Lighthouse móvil >=90 en cuatro categorías.
- [ ] p95 route handlers <2 s.
- [ ] axe sin issues críticos + revisión manual teclado/lector.
- [ ] Logs escaneados sin PII/health/token.
- [ ] GitHub Actions verde.
- [ ] Rollback de app y last-known-good de Drive ensayados.
