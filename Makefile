AGENT_SERIAL?=agent-0
APP_SECRET?=`cat .app-secret`
APP_SECRET_TEXT=`head -c 24 /dev/random | base64 | sed 's/[^a-zA-Z0-9]//g' | cut -c -6`
BASE_URL?=http://localhost:80
BASE_URL_STAGING?=http://localhost:3000
DEBUG=gridplus-sdk,trace,debug,info,warn,error,fatal
ETHEREUM_NODE_URI?=http://localhost:8545
LOG_LEVEL?=debug
NPM_CONFIG_REGISTRY?=https://nexus.gridpl.us/repository/npm-group/
NPM_TOKEN?=`sed -n -e '/\/\/nexus.gridpl.us\/repository\/npm-group\/:_authToken=/ s/.*\= *//p' ~/.npmrc` #grabbing NPM_TOKEN from ~/.npmrc if its not already set as an env var
RABBIT_MQTT_STAGING_URL?=
RABBIT_MQTT_URL?=mqtt://rabbitmq:1883 #assumes you're running a servicebus stack locally

build:
	npm run build

build-image:
	docker build -f Dockerfile .

down:
	docker-compose -f docker-compose.mac.yml down

clean-agent:
	docker-compose -f docker-compose.mac.yml down --remove-orphans

ensure-app-secret:
	@-if [ ! -e .app-secret ]; then\
		echo $(APP_SECRET_TEXT) > .app-secret;\
	fi
	$(eval APP_SECRET := $(cat .app-secret))

ensure-serial:
	@if [ "$(AGENT_SERIAL)" = "" ]; then \
		echo "Please set an AGENT_SERIAL environment variable, inline or in your ~/.zshrc."; \
		exit 1; \
	fi

install:
	NPM_CONFIG_REGISTRY=$(NPM_CONFIG_REGISTRY) \
	NPM_TOKEN=$(NPM_TOKEN) \
	docker-compose -f docker-compose.builder.yml run install

link:
	meta npm link -all

mine:
	curl localhost:48332 \
  -X POST \
  --data '{"method": "generate","params": [ '1' ]}'

publish:
	NPM_CONFIG_REGISTRY=$(NPM_CONFIG_REGISTRY) \
	npm publish

test: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL) \
	DEBUG= \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm test

test-staging: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL_STAGING) \
	DEBUG= \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm test

test-debug: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL) \
	DEBUG=$(DEBUG) \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm test

test-debug-staging: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL_STAGING) \
	DEBUG=$(DEBUG) \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm test

test-watch: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL) \
	DEBUG= \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm run test:watch

test-watch-staging: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL_STAGING) \
	DEBUG= \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm run test:watch

test-watch-debug: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL) \
	DEBUG=$(DEBUG) \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm run test:watch

test-watch-debug-staging: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	BASE_URL=$(BASE_URL_STAGING) \
	DEBUG=$(DEBUG) \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm run test:watch

up-agent: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	DEBUG=$(DEBUG) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_URL) \
	docker-compose -f docker-compose.mac.yml up

up-agent-staging-mqtt-staging: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	DEBUG=$(DEBUG) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_STAGING_URL) \
	docker-compose -f docker-compose.staging.yml up

up-bitcoin:
	docker-compose -f docker-compose.mac.yml up bcoin

up-bitcoin-and-ethereum:
	docker-compose -f docker-compose.mac.yml up bcoin ganache

up-ethereum:
	docker-compose -f docker-compose.mac.yml up ganache

up:
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	DEBUG=$(DEBUG) \
	LOG_LEVEL=$(LOG_LEVEL) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_URL) \
	docker-compose -f docker-compose.mac.yml up # start all services

up-staging-mqtt:
	AGENT_SERIAL=$(AGENT_SERIAL) \
	APP_SECRET=$(APP_SECRET) \
	DEBUG=$(DEBUG) \
	LOG_LEVEL=$(LOG_LEVEL) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_STAGING_URL) \
	docker-compose -f docker-compose.mac.yml up # start all services

.PHONY: test
