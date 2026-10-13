# Monetización — MorrowAge v2.0

## Principio

La monetización no debe vender certeza médica. El valor pago está en **contexto, sensibilidad, escenarios y plan de bienestar**, no en una cifra de mortalidad absoluta que todavía no está calibrada.

## Fase 1 · Validación

La vista gratuita entrega MorrowAge, delta frente a edad cronológica, hazard relativo, un gráfico y un driver. Después se ofrece **“Recibe tu informe completo”** a cambio de email y consentimiento de privacidad; el consentimiento de marketing debe ser separado y opcional.

El dueño recibe un evento/copia con ID de sesión anonimizado, inputs, outputs, flags de consentimiento y enlace al informe. No se debe replicar información personal innecesaria.

Umbrales propuestos antes de activar pago:
- ≥45% de finalización sobre al menos 500 inicios cualificados.
- ≥25% de conversión del email gate sobre al menos 300 calculadoras completadas.
- ≥45% de apertura del informe sobre al menos 100 informes entregados.
- ≥8% de intención de compra/WTP a US$19 sobre al menos 200 usuarios expuestos.
- Regla: cumplir al menos 3 de 4 durante dos cohortes semanales consecutivas y sin bloqueadores de QA/seguridad.

Estos umbrales son **hipótesis de operación**, no benchmarks de mercado.

## Fase 2 · Cobro

Precio ancla: **US$19 por informe completo**. Se conservan como hipótesis de etapa 1: UK £15, Canadá C$25, Australia A$29, Brasil R$49 y Perú S/39. Antes de activar cada país deben recalcularse con PPP de consumo privado del World Bank (`PA.NUS.PRVT.PP`) y test de willingness-to-pay local; hasta entonces su estado es preliminar.

Fuente PPP oficial y licencia CC BY 4.0:
https://data.worldbank.org/indicator/PA.NUS.PRVT.PP

Bundles propuestos: retest US$9 y pareja US$29. Suscripción US$39/año solo en V2 si aparece una necesidad real de seguimiento.

## Coste por informe y margen de referencia

Para un cobro US doméstico de US$19, Stripe publica 2,9% + US$0,30 por transacción. Eso equivale a **US$0.8510**. Resend Pro publica US$20 por 50.000 emails, equivalente a **US$0.000400 por email** a plena utilización del tier. Se reserva además US$0,001 como allowance conservador de cómputo.

Coste incremental modelado: **US$0.8524** por informe.  
Margen bruto técnico modelado antes de impuestos, soporte, chargebacks, storage, refunds y FX: **95.51%**.

Fuentes:
- Stripe: https://stripe.com/pricing
- Resend: https://resend.com/pricing?product=transactional
- Cloudflare Workers: https://www.cloudflare.com/plans/developer-platform/

## Qué no se regala

No se regalan la descomposición completa de drivers, la sensibilidad de medición, los escenarios what-if, el plan priorizado ni el apéndice metodológico. Esas capas responden “por qué me salió esto” y “qué cambia si modifico algo”, que es el valor que transforma una curiosidad gratuita en un informe útil.

No se vende ni se regala en v1 la probabilidad absoluta de muerte a 10 años: está bloqueada por rigor metodológico, no por paywall.


## Correcciones QA de Etapa 3

- `US$0.0004/email` se interpreta como **coste asignado medio** del plan Resend Pro a 50.000 envíos (`20/50000`), no como coste marginal dentro de la cuota. Los overages tienen otra tarifa.
- El evento/copia administrativa de Fase 1 **no contiene inputs de salud, resultado crudo ni enlace de informe**. Solo session ID seudónimo, locale/mercado, etapa del funnel, versión de modelo, consent flags y delivery status.
- Consentimiento de marketing separado y opcional; retención corta y enlaces de reporte expirables.
- Los precios por país siguen siendo hipótesis comerciales hasta validación de WTP/PPP; no se anuncian como paridad verificada.
