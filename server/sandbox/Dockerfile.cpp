FROM gcc:15

RUN groupadd --gid 10001 sandbox \
    && useradd --uid 10001 --gid sandbox --no-create-home --shell /usr/sbin/nologin sandbox \
    && mkdir -p /workspace \
    && chown sandbox:sandbox /workspace

ENV HOME=/workspace TMPDIR=/tmp
WORKDIR /workspace
USER 10001:10001
CMD ["g++", "--version"]
