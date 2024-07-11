FROM denoland/deno:alpine-1.45.0

USER deno
WORKDIR /app

COPY deps.ts .
RUN deno cache deps.ts

COPY . .
RUN deno cache main.ts

CMD ["run", "--allow-env", "--allow-net=:8080,discord.com", "--unstable-kv", "main.ts"]
