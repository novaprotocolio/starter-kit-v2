FROM golang:1.11 AS build_base

# Set the Current Working Directory inside the container
WORKDIR /amm-bots

# We want to populate the module cache based on the go.{mod,sum} files.
COPY go.mod .
COPY go.sum .

RUN go mod download

COPY . /amm-bots


# Build the Go app
RUN go build -o bin/amm-bots -v -ldflags '-s -w' main.go

# Start fresh from a smaller image
FROM alpine
RUN mkdir /lib64 && ln -s /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2
RUN apk --no-cache add ca-certificates


COPY --from=build_base /amm-bots/bin/amm-bots /bin/

ENTRYPOINT /bin/amm-bots