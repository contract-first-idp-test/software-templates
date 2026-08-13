SHELL := /usr/bin/env bash
.PHONY: test release-check generate-release-metadata test-install test-clean

DEVELOPER_CHARTS_DIR ?= ../developer-charts
PLATFORM_COMPONENTS_DIR ?= ../platform-components

test: generate-release-metadata test-install
	npm test --prefix test

release-check: test
	node scripts/validate-release.js
	DEVELOPER_CHARTS_DIR="$(DEVELOPER_CHARTS_DIR)" \
	PLATFORM_COMPONENTS_DIR="$(PLATFORM_COMPONENTS_DIR)" \
		npm run --prefix test test:compatibility

generate-release-metadata:
	node scripts/generate-compatibility.js --check

test-install:
	npm ci --prefix test --loglevel=error

test-clean:
	rm -rf test/node_modules
