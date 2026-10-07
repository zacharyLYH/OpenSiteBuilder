FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server .

FROM alpine:3.20
COPY --from=build /app/server /app/server
EXPOSE 18081
ENTRYPOINT ["/app/server"]
