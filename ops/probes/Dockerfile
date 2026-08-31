FROM alpine:3.22

RUN apk add --no-cache bash ca-certificates curl jq \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app

WORKDIR /app
COPY run.sh entrypoint.sh ./
RUN chmod 0555 /app/run.sh /app/entrypoint.sh

USER 10001:10001
ENTRYPOINT ["/app/entrypoint.sh"]
