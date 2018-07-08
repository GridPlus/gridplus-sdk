AGENT_SERIAL?=agent-0
BASE_URL?=http://localhost:80
DEBUG?=debug,info,warn,error,fatal
DOCKER_PASS?=
DOCKER_USER?=
NPM_TOKEN?=`sed -n -e '/\/\/nexus.gridpl.us\/repository\/npm-group\/:_authToken=/ s/.*\= *//p' ~/.npmrc` #grabbing NPM_TOKEN from ~/.npmrc if its not already set as an env var
RABBIT_MQTT_STAGING_URL?=
RABBIT_MQTT_URL?=mqtt://rabbitmq:1883 #assumes you're running a servicebus stack locally

ensure-serial:
	@if [ "$(AGENT_SERIAL)" = "" ]; then \
		echo "Please set an AGENT_SERIAL environment variable, inline or in your ~/.zshrc."; \
		exit 1; \
	fi

build-builder:
	docker build -f Dockerfile .

clean-mac:
	docker-compose -f docker-compose.mac.yml down --remove-orphans

down-mac:
	docker-compose -f docker-compose.mac.yml down

up-mac: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_URL) \
	docker-compose -f docker-compose.mac.yml up

up-mac-staging-mqtt: ensure-serial
	AGENT_SERIAL=$(AGENT_SERIAL) \
	DEBUG=$(DEBUG) \
	NPM_TOKEN=$(NPM_TOKEN) \
	RABBIT_MQTT_URL=$(RABBIT_MQTT_STAGING_URL) \
	docker-compose -f docker-compose.mac.yml up

test:
	BASE_URL=$(BASE_URL) \
	npm run test

.PHONY : test