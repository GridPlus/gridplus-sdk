down: down-bitcoin-and-ethereum

down-bitcoin:
	docker-compose -f docker-compose.builder.yml down

down-bitcoin-and-ethereum:
	docker-compose -f docker-compose.builder.yml down

down-ethereum:
	docker-compose -f docker-compose.builder.yml down

up-bitcoin:
	docker-compose -f docker-compose.builder.yml up bcoin

up-bitcoin-and-ethereum:
	docker-compose -f docker-compose.builder.yml up bcoin ganache

up-ethereum:
	docker-compose -f docker-compose.builder.yml up ganache

up: up-bitcoin-and-ethereum