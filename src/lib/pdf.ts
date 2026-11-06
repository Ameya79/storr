let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      try {
        const workerModule = await import('pdfjs-dist/build/pdf.worker.min.js?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      } catch {
        // Fallback for non-Vite environments
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/**
 * Renders page 1 of a PDF Blob to a 480px-wide WebP/JPEG thumbnail.
 * Targets under 60 KB.
 */
export async function makeThumbnail(file: Blob): Promise<Blob> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const TARGET_WIDTH = 480;
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const scale = TARGET_WIDTH / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Draw white background for transparent PDF pages
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  // Export as WebP quality 0.82 with JPEG fallback
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback to JPEG
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob) resolve(jpegBlob);
              else reject(new Error('Failed to encode canvas to blob'));
            },
            'image/jpeg',
            0.82
          );
        }
      },
      'image/webp',
      0.82
    );
  });
}

/**
 * Lazy page rendering for Viewer.
 * Uses IntersectionObserver to lazily render each page onto a canvas
 * when it scrolls into view.
 */
export async function renderPages(
  file: Blob,
  container: HTMLElement,
  onPagesLoaded?: (numPages: number) => void
): Promise<() => void> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const numPages = pdf.numPages;
  onPagesLoaded?.(numPages);

  container.innerHTML = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const observers: IntersectionObserver[] = [];
  const renderedPages = new Set<number>();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pageWrapper = document.createElement('div');
    pageWrapper.className =
      'pdf-page-wrapper relative w-full mb-6 rounded-card overflow-hidden shadow-card bg-surface flex flex-col items-center justify-center min-h-[400px]';
    pageWrapper.dataset.pageNum = String(pageNum);

    // Placeholder skeleton
    const skeleton = document.createElement('div');
    skeleton.className =
      'absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-muted font-medium';
    skeleton.textContent = `Page ${pageNum} of ${numPages}`;
    pageWrapper.appendChild(skeleton);

    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-auto block relative z-10 transition-opacity duration-200 opacity-0';
    pageWrapper.appendChild(canvas);

    container.appendChild(pageWrapper);

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !renderedPages.has(pageNum)) {
          renderedPages.add(pageNum);
          observer.disconnect();

          try {
            const page = await pdf.getPage(pageNum);
            const containerWidth = container.clientWidth || 800;
            const unscaled = page.getViewport({ scale: 1.0 });
            const scale = (containerWidth / unscaled.width) * dpr;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              await page.render({
                canvasContext: ctx,
                viewport,
              }).promise;

              canvas.classList.remove('opacity-0');
              canvas.classList.add('opacity-100');
              skeleton.remove();
            }
          } catch {
            // Render error handling
          }
        }
      },
      { rootMargin: '300px 0px' }
    );

    observer.observe(pageWrapper);
    observers.push(observer);
  }

  // Cleanup function
  return () => {
    observers.forEach((obs) => obs.disconnect());
    try {
      loadingTask.destroy();
    } catch {
      // ignore
    }
  };
}

