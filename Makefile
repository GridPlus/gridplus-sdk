AGENT_SERIAL?=agent-0
BASE_URL?=http://localhost:80
DEBUG?=debug,info,warn,error,fatal
ETHEREUM_NODE_URI?=http://localhost:8545
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

ensure-serial:
	@if [ "$(AGENT_SERIAL)" = "" ]; then \
		echo "Please set an AGENT_SERIAL environment variable, inline or in your ~/.zshrc."; \
		exit 1; \
	fi

install:
	npm i

test:
	BASE_URL=$(BASE_URL) \
	ETHEREUM_NODE_URI=$(ETHEREUM_NODE_URI) \
	npm test

up-agent: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_URL) \
	docker-compose -f docker-compose.mac.yml up

up-agent-staging-mqtt: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_STAGING_URL) \
	docker-compose -f docker-compose.mac.yml up

up-bitcoin:
	docker-compose -f docker-compose.mac.yml up bcoin

up-bitcoin-and-ethereum:
	docker-compose -f docker-compose.mac.yml up bcoin ganache

up-ethereum:
	docker-compose -f docker-compose.mac.yml up ganache

up:
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_URL) \
	docker-compose -f docker-compose.mac.yml up # start all services

up-staging-mqtt:
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_STAGING_URL) \
	docker-compose -f docker-compose.mac.yml up # start all services

.PHONY: test