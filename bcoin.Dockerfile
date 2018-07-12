FROM node:9

ARG BCOIN_VERSION=v1.0.0-beta.15
ENV BCOIN_VERSION=${BCOIN_VERSION} \
    BCOIN_REPO=https://github.com/bcoin-org/bcoin.git \
    BCOIN_DIR=/code/bcoin

USER root

RUN mkdir -p $BCOIN_DIR /data

WORKDIR $BCOIN_DIR

RUN npm i bcoin@1.0.0-beta.15

CMD ["node_modules/.bin/bcoin"]