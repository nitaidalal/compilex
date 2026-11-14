FROM node:24-alpine

RUN addgroup -g 10001 -S sandbox \
    && adduser -u 10001 -S -D -H -G sandbox sandbox \
    && mkdir -p /workspace \
    && chown sandbox:sandbox /workspace

ENV HOME=/workspace NODE_ENV=production
WORKDIR /workspace
USER 10001:10001
CMD ["node", "--version"]
