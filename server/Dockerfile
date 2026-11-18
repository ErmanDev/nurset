# NurSet API server. Build from the repository root (the migrations are
# compiled into the binary):
#   docker build -f server/Dockerfile -t nurset-server .

FROM rust:1-bookworm AS build
WORKDIR /src
COPY database/postgres/migrations database/postgres/migrations
COPY server server
RUN cargo build --release --locked --manifest-path server/Cargo.toml

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 nurset
# Dates, deadlines, and daily limits use Philippine time; Render sets PORT.
ENV TZ=Asia/Manila \
    PORT=10000
COPY --from=build /src/server/target/release/nurset-server /usr/local/bin/nurset-server
USER nurset
EXPOSE 10000
CMD ["nurset-server"]
