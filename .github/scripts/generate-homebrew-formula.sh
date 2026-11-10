#!/bin/bash
# Generate Homebrew formula for han
# Usage: ./generate-homebrew-formula.sh v3.4.1

set -euo pipefail

VERSION="${1#v}"
REPO="TheBushidoCollective/han"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

DARWIN_ARM64_SHA=$(curl -fsSL "${BASE_URL}/han-darwin-arm64.sha256" | awk '{print $1}')
DARWIN_X64_SHA=$(curl -fsSL "${BASE_URL}/han-darwin-x64.sha256" | awk '{print $1}')
LINUX_ARM64_SHA=$(curl -fsSL "${BASE_URL}/han-linux-arm64.sha256" | awk '{print $1}')
LINUX_X64_SHA=$(curl -fsSL "${BASE_URL}/han-linux-x64.sha256" | awk '{print $1}')
DARWIN_ARM64_COORD_SHA=$(curl -fsSL "${BASE_URL}/han-coordinator-darwin-arm64.sha256" | awk '{print $1}')
DARWIN_X64_COORD_SHA=$(curl -fsSL "${BASE_URL}/han-coordinator-darwin-x64.sha256" | awk '{print $1}')
LINUX_ARM64_COORD_SHA=$(curl -fsSL "${BASE_URL}/han-coordinator-linux-arm64.sha256" | awk '{print $1}')
LINUX_X64_COORD_SHA=$(curl -fsSL "${BASE_URL}/han-coordinator-linux-x64.sha256" | awk '{print $1}')

cat << FORMULA
# typed: false
# frozen_string_literal: true

class Han < Formula
  desc "Sophisticated Claude Code Plugins with Superior Accuracy"
  homepage "https://han.guru"
  version "${VERSION}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-darwin-arm64"
      sha256 "${DARWIN_ARM64_SHA}"
      resource "coordinator" do
        url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-coordinator-darwin-arm64"
        sha256 "${DARWIN_ARM64_COORD_SHA}"
      end
    else
      url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-darwin-x64"
      sha256 "${DARWIN_X64_SHA}"
      resource "coordinator" do
        url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-coordinator-darwin-x64"
        sha256 "${DARWIN_X64_COORD_SHA}"
      end
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-linux-arm64"
      sha256 "${LINUX_ARM64_SHA}"
      resource "coordinator" do
        url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-coordinator-linux-arm64"
        sha256 "${LINUX_ARM64_COORD_SHA}"
      end
    else
      url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-linux-x64"
      sha256 "${LINUX_X64_SHA}"
      resource "coordinator" do
        url "https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-coordinator-linux-x64"
        sha256 "${LINUX_X64_COORD_SHA}"
      end
    end
  end

  def install
    bin.install Dir["han-*"].first => "han"
    resource("coordinator").stage do
      bin.install Dir["han-coordinator-*"].fetch(0) => "han-coordinator"
    end
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/han --version")
  end
end
FORMULA
