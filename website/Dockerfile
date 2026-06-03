FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY screenshots/ /usr/share/nginx/html/screenshots/
COPY og-image.png /usr/share/nginx/html/
COPY favicon.ico favicon.svg favicon-32x32.png favicon-16x16.png apple-touch-icon.png /usr/share/nginx/html/
# Large media (output_vhs.mp4, bg-audio.mp3) are bind-mounted at deploy — see infra/docker-stack.yml

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/health || exit 1
