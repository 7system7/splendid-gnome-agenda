SHELL := /bin/sh
.DEFAULT_GOAL := help

UUID := gnome-splendid-agenda@splendidbear.org
EXTENSION_DIR := $(UUID)
BUILD_DIR := build
PACKAGE := $(BUILD_DIR)/$(UUID).shell-extension.zip
SCHEMA := schemas/org.gnome.shell.extensions.gnome-splendid-agenda.gschema.xml
JS_FILES := $(wildcard $(EXTENSION_DIR)/*.js $(EXTENSION_DIR)/ui/*.js $(EXTENSION_DIR)/utils/*.js)

.PHONY: help check test pack install uninstall enable disable prefs info logs isolated clean

help:
	@printf '%s\n' \
	  'make check      Check JavaScript syntax, schema, and unit tests' \
	  'make test       Run unit tests only' \
	  'make pack       Build the extension ZIP in build/' \
	  'make install    Pack and install/update for the current user' \
	  'make uninstall  Remove the extension for the current user' \
	  'make enable     Enable in the current Shell session' \
	  'make disable    Disable in the current Shell session' \
	  'make prefs      Open extension preferences' \
	  'make info       Show installation and status information' \
	  'make logs       Follow GNOME Shell journal messages (Ctrl-C to stop)' \
	  'make isolated   Start a nested Shell with Mutter Devkit (no install)' \
	  'make clean      Remove the generated extension ZIP'

check:
	@set -e; for file in $(JS_FILES); do node --check "$$file"; done
	glib-compile-schemas --strict --dry-run "$(EXTENSION_DIR)/schemas"
	$(MAKE) test

test:
	node --test tests/*.test.mjs

pack:
	mkdir -p "$(BUILD_DIR)"
	gnome-extensions pack --force --out-dir="$(BUILD_DIR)" \
	  --extra-source=ui --extra-source=utils \
	  --schema="$(SCHEMA)" "$(EXTENSION_DIR)"

install: pack
	gnome-extensions install --force "$(PACKAGE)"
	@printf '%s\n' 'Log out and back in under Wayland, then run make enable; for nested testing, restart the nested Shell.'

uninstall:
	gnome-extensions uninstall "$(UUID)"
	@printf '%s\n' 'Log out and back in to finish removal from a running Shell session.'

enable:
	gnome-extensions enable "$(UUID)"

disable:
	gnome-extensions disable "$(UUID)"

prefs:
	gnome-extensions prefs "$(UUID)"

info:
	gnome-extensions info "$(UUID)"

logs:
	journalctl --user -f -o cat /usr/bin/gnome-shell

isolated:
	@printf '%s\n' 'Install first with make install.' \
	  'Then, from a terminal inside the nested desktop and this repository, run: make enable' \
	  'The host session and nested session use different D-Bus buses; host-side make enable does not enable the nested Shell.' \
	  'This isolates the Shell/D-Bus session, not your home directory or settings.'
	dbus-run-session -- gnome-shell --devkit --wayland

clean:
	rm -f -- "$(PACKAGE)"
