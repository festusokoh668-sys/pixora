import express, { type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parsePngDataUrl, sanitizeQuickSaveFilename } from './src/utils/quickSave.ts';

const PORT = Number(process.env.PORT) || 3000;
const DOWNLOADS_DIR = path.resolve(process.cwd(), 'downloads');

async function startServer(): Promise<void> {
  const app = express();

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/quick-save', async (req: Request, res: Response) => {
    try {
      const { imageDataUrl, filename } = req.body ?? {};
      const pngBytes = parsePngDataUrl(imageDataUrl);
      if (!pngBytes) {
        res.status(400).json({ ok: false, error: 'Invalid PNG image payload.' });
        return;
      }

      const safeFilename = sanitizeQuickSaveFilename(filename);
      const targetPath = path.resolve(DOWNLOADS_DIR, safeFilename);
      if (!targetPath.startsWith(`${DOWNLOADS_DIR}${path.sep}`)) {
        res.status(400).json({ ok: false, error: 'Invalid export filename.' });
        return;
      }

      await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
      await fs.writeFile(targetPath, pngBytes);

      res.status(200).json({
        ok: true,
        filename: safeFilename,
        relativePath: `downloads/${safeFilename}`,
        bytes: pngBytes.length,
      });
    } catch (err) {
      console.error('Quick Save write failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to write PNG to downloads folder.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pixora Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
