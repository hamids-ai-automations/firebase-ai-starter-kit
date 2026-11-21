import { setGlobalOptions } from 'firebase-functions/v2';
import { REGION } from './config';

setGlobalOptions({ region: REGION, maxInstances: 10 });

// AI endpoints (server-side Gemini only; the key never reaches the browser)
export { aiGenerateText, aiGenerateStructured, aiChat, aiUsageSummary } from './endpoints/ai';

// Conversation management (ownership enforced server-side)
export { deleteConversation } from './endpoints/conversations';

// Profile bootstrap and updates
export { ensureUserProfile, updateUserProfile } from './endpoints/profile';

// Security demonstration endpoint
export { secureEcho } from './endpoints/security-demo';

// Health probe
export { apiHealth } from './endpoints/health';
