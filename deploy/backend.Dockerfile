# syntax=docker/dockerfile:1.7
FROM rust:1-bookworm AS build
WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src
COPY backend/ .
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/tek-api /app/tek-api
COPY backend/migrations /app/migrations
COPY backend/static /app/static
ENV BIND=0.0.0.0:8181 RUST_LOG=info
EXPOSE 8181
CMD ["/app/tek-api"]
