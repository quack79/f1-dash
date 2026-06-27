FROM lukemathwalker/cargo-chef:latest-rust-alpine AS chef
RUN apk add --no-cache musl-dev pkgconfig openssl-libs-static openssl-dev

FROM chef AS planner
WORKDIR /usr/src/app
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
WORKDIR /usr/src/app
COPY --from=planner /usr/src/app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo b -r


FROM alpine:3 AS api
COPY --from=builder /usr/src/app/target/release/api .
CMD [ "/api" ]


FROM alpine:3 AS realtime
COPY --from=builder /usr/src/app/target/release/realtime .
CMD [ "/realtime" ]
