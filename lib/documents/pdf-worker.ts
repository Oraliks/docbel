// Same-origin worker URL. Loading the worker from a CDN (unpkg.com) fails on
// iOS Safari because module workers face stricter cross-origin / MIME rules.
export const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
