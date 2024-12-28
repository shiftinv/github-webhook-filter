FROM denoland/deno:alpine-1.46.3

RUN mkdir /data && chown deno:deno /data
VOLUME /data
ENV KV_PATH=/data/kv.sqlite3

USER deno
WORKDIR /app

COPY . .
RUN deno cache src/main.ts

CMD [\
    "run",\
    "--allow-env", "--allow-net=:8080,discord.com", "--allow-read=/data", "--allow-write=/data",\
    "--unstable-kv",\
    "src/main.ts"\
]
