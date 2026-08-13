SHELL := /usr/bin/env bash
.PHONY: test generate-release-metadata test-install test-clean

test: generate-release-metadata test-install
	npm test --prefix test

generate-release-metadata:
	node scripts/generate-compatibility.js --check

test-install:
	npm ci --prefix test --loglevel=error

test-clean:
	rm -rf test/node_modules
