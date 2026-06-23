FROM nginx:1.27-alpine

COPY .coolify/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY nextinject.png /usr/share/nginx/html/nextinject.png

HEALTHCHECK --interval=30s --timeout=3s \
	CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
