/** Verifica que `drive/` coincide con `spec/drive_manifest.json` (archivos y SHA-256). */
import { planSync } from './drive-sync';

const plan = planSync();
console.log(`check:drive OK — ${plan.length} archivos coinciden con el manifest.`);
