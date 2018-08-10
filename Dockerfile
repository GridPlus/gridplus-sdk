FROM docker.gridpl.us/gridplus/node-build AS build
WORKDIR /src
ADD . .
ARG NPM_TOKEN
RUN JOBS=MAX npm install --unsafe-perm \
  && npm run build \
  && npm cache clean --force \
  && rm -rf /tmp/*

# Install cURL for healthcheck
FROM node:9

ENV DIR=/usr/src/service
WORKDIR $DIR

COPY --from=build /src .

CMD ["echo override me in your integration test"]
