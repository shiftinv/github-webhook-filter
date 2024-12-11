FROM denoland/deno:alpine-1.45.0

USER deno
WORKDIR /app

COPY . .
RUN deno cache src/main.ts

CMD ["run", "--allow-env", "--allow-net=:8080,discord.com", "--unstable-kv", "src/main.ts"]
