FROM node:9

ARG BCOIN_VERSION=gridplus-fork-0.1
ENV BCOIN_VERSION=${BCOIN_VERSION} \
    BCOIN_REPO=https://github.com/gridplus/bcoin.git \
    BCOIN_DIR=/code/bcoin

USER root

RUN mkdir -p $BCOIN_DIR /data

WORKDIR $BCOIN_DIR

RUN npm i git+https://git@github.com/gridplus/bcoin.git

CMD ["node_modules/.bin/bcoin"]