import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createAiMiddleware } from './server/aiServer';
import { resolveAiConfiguration } from './server/aiConfiguration';

function localAiPlugin(configuration: ReturnType<typeof resolveAiConfiguration>): Plugin {
  return {
    name: 'goodcall-local-ai',
    configureServer(server) {
      const ai = createAiMiddleware(configuration);
      server.middlewares.use(ai.middleware);
      server.httpServer?.once('close', ai.dispose);
    },
    configurePreviewServer(server) {
      const ai = createAiMiddleware(configuration);
      server.middlewares.use(ai.middleware);
      server.httpServer.once('close', ai.dispose);
    },
  };
}

export default defineConfig(({ mode }) => {
  // These values stay in the Node process. Never define a VITE_ API key.
  const env = loadEnv(mode, process.cwd(), ['OPENAI_', 'ANTHROPIC_', 'AI_PROVIDER']);
  return {
    plugins: [react(), localAiPlugin(resolveAiConfiguration(env))],
    server: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1'], cors: false },
    preview: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1'], cors: false },
  };
});
