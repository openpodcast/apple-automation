.PHONY: run dev
run dev:
	node main.js

.PHONY: docker-build
docker-build: # Run Docker build
	docker build -t apple-automation .

.PHONY: docker-run
docker-run: docker-build # Run Docker container
	docker run -it --env-file .env --rm --name apple-automation apple-automation