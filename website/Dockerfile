# Override NGINX_IMAGE in CI (mirror.gcr.io/library/nginx:1.27-alpine) to avoid Docker Hub timeouts.
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NGINX_IMAGE}

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY og-image.png /usr/share/nginx/html/
COPY bg-audio.mp3 output_vhs.mp4 /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/health || exit 1
