FROM denoland/deno:alpine-1.25.1

WORKDIR /app
USER deno

COPY deps.ts .
RUN deno cache deps.ts

COPY . .
RUN deno cache main.ts

CMD ["run", "--allow-env", "--allow-net=:8080,discord.com", "main.ts"]
