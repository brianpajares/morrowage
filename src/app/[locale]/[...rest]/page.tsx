import { notFound } from 'next/navigation';

/** Captura rutas desconocidas dentro de /{locale}/… para mostrar el 404 localizado. */
export default function CatchAll() {
  notFound();
}
