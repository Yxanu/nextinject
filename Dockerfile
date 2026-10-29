FROM node:24-alpine AS site

WORKDIR /site
COPY appinfo/info.xml appinfo/info.xml
COPY README.en.md README.en.md
COPY site/ site/
COPY scripts/build-site.mjs scripts/build-site.mjs
COPY tests/site-build.test.mjs tests/site-build.test.mjs
COPY nextinject.png nextinject.png
RUN node --test tests/site-build.test.mjs && node scripts/build-site.mjs --out /public

FROM nginx:1.27-alpine

COPY .coolify/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=site /public/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s \
	CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
