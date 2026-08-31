FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod main.go main_test.go ./
RUN go test ./... \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /docker-proxy .

FROM scratch
COPY --from=build /docker-proxy /docker-proxy
EXPOSE 2375
ENTRYPOINT ["/docker-proxy"]
